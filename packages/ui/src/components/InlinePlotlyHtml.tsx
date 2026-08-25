import React, { useEffect, useRef } from "react";

let instanceCounter = 0;

// Global Plotly loader — avoids duplicate <script> tags across component instances.
// Loads the vendored runtime from the framework's core static mount
// (backend/veloiq_framework/static_assets/plotly.min.js, served at
// /veloiq-assets/plotly.min.js in every host app) instead of the cdn.plot.ly CDN,
// so chart rendering never depends on internet access.
let _plotlyLoadPromise: Promise<void> | null = null;
const ensurePlotly = (): Promise<void> => {
    if ((window as any).Plotly) return Promise.resolve();
    if (_plotlyLoadPromise) return _plotlyLoadPromise;
    _plotlyLoadPromise = new Promise<void>((resolve) => {
        const existing = document.querySelector('script[data-jm-plotly-loader="1"]');
        if (existing) {
            existing.addEventListener('load', () => resolve());
            return;
        }
        const s = document.createElement('script');
        s.src = '/veloiq-assets/plotly.min.js';
        s.async = true;
        s.setAttribute('data-jm-plotly-loader', '1');
        s.onload = () => resolve();
        s.onerror = () => resolve(); // don't block forever on CDN failure
        document.head.appendChild(s);
    });
    return _plotlyLoadPromise;
};

/**
 * Renders Plotly HTML inline (no iframe) by:
 * 1. Stripping Plotly CDN <script> tags (loaded dynamically below)
 * 2. Making card button IDs unique per instance to avoid DOM ID conflicts
 * 3. Injecting the remaining HTML via dangerouslySetInnerHTML
 * 4. Ensuring Plotly is loaded before executing inline <script> tags
 */
// Default floor: below this, a shrunk card is judged too small to be usable
// and the component falls back to letting the outer wrapper's overflow:auto
// scroll the (now min-scaled) content instead of shrinking it further.
// Callers that want a different tradeoff (e.g. the dashboard's "Fit page"
// density, which prioritizes zero scrolling over legibility) pass their own
// `minScale` prop instead.
const DEFAULT_MIN_CARD_SCALE = 0.6;

export const InlinePlotlyHtml: React.FC<{
    html: string;
    style?: React.CSSProperties;
    minScale?: number;
}> = ({ html, style, minScale = DEFAULT_MIN_CARD_SCALE }) => {
    // `outerRef` is the sized box the dashboard grid hands us (its height
    // tracks the cell-size slider in ViewsGrid.tsx); `containerRef` holds
    // the injected HTML at its natural size. Keeping them separate is what
    // lets the scale-to-fit effect below measure "natural content height"
    // via containerRef.scrollHeight without that measurement being
    // affected by the very CSS transform it applies — a transform changes
    // paint, not layout box size, so scrollHeight stays a stable read even
    // while a previous scale is already in effect.
    const outerRef = useRef<HTMLDivElement>(null);
    // Sits between outerRef and containerRef; see the scale-to-fit effect
    // below for why it exists.
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceIdRef = useRef<string>("");

    // Assign a unique instance ID once per mount
    if (!instanceIdRef.current) {
        instanceCounter += 1;
        instanceIdRef.current = `iph-${instanceCounter}-${Date.now()}`;
    }
    const instanceId = instanceIdRef.current;

    // Strip the vendored/local (and, for any already-cached older HTML, CDN)
    // Plotly loader <script src="..."> tag — Plotly.js is loaded once globally
    // via ensurePlotly() above instead.
    let cleanedHtml = html.replace(
        /<script[^>]*src=["'][^"']*(?:cdn\.plot\.ly|\/veloiq-assets\/plotly\.min\.js)[^"']*["'][^>]*><\/script>/gi,
        "",
    );

    // Make card container/card IDs unique per instance by appending the instanceId.
    // The backend generates HTML with patterns like:
    //   id="cardContainer{number}"   id="myCard{number}"
    //   onclick="reduceCardWidth({number})"  etc.
    // We rewrite these so each InlinePlotlyHtml instance has unique IDs.
    cleanedHtml = cleanedHtml.replace(
        /\b(id=["'](?:cardContainer|myCard))(\d+)(["'])/g,
        (match, prefix, suffix, quote) => `${prefix}${suffix}-${instanceId}${quote}`,
    );
    // Rewrite onclick handlers for card buttons that pass the numeric suffix.
    // Only target the known card manipulation functions to avoid breaking other onclick handlers.
    // The suffix must be wrapped in quotes so JS treats it as a string, not arithmetic.
    cleanedHtml = cleanedHtml.replace(
        /\b(onclick=["'][^"']*(?:reduceCardWidth|increaseCardWidth|optimizeCardSizeInViewPort|maximizeCardSize|minimizeCardSize|flipCard)\()(\d+)\)(["'])/g,
        (match, before, suffix, quote) => `${before}'${suffix}-${instanceId}')${quote}`,
    );
    // Rewrite document.getElementById('myCard' + suffix) patterns inside <script> tags.
    // The backend code uses: document.getElementById('myCard' + 53330500000100)
    // We need to rewrite the numeric suffix to include the instanceId.
    // The suffix must be wrapped in quotes so JS treats it as a string, not arithmetic.
    cleanedHtml = cleanedHtml.replace(
        /(getElementById\(['"])(cardContainer|myCard)(['"]\s*\+\s*)(\d+)\)/g,
        (match, open, prefix, plus, suffix) => `${open}${prefix}${plus}'${suffix}-${instanceId}')`,
    );
    // Rewrite direct function calls with the numeric suffix inside <script> tags
    // (e.g., optimizeCardSizeInViewPort(53330500000100))
    // The suffix must be wrapped in quotes so JS treats it as a string, not arithmetic.
    cleanedHtml = cleanedHtml.replace(
        /((?:reduceCardWidth|increaseCardWidth|optimizeCardSizeInViewPort|maximizeCardSize|minimizeCardSize|flipCard)\()(\d+)\)/g,
        (match, func, suffix) => `${func}'${suffix}-${instanceId}')`,
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // `html` can be a partial, still-streaming string (see NLChatShow/
        // NLSentenceShow, which append chunks as they arrive). Setting
        // dangerouslySetInnerHTML with an unclosed <script> tag makes the
        // browser's HTML parser consume everything to end-of-input as that
        // script's (syntactically incomplete) text content — executing it
        // then throws a real SyntaxError ("Unexpected end of input") instead
        // of quietly no-op'ing. Skip this pass entirely when a <script> is
        // still open; a later chunk that closes it will re-trigger this
        // effect and execute the complete script correctly.
        const openTags = (cleanedHtml.match(/<script\b/gi) || []).length;
        const closeTags = (cleanedHtml.match(/<\/script>/gi) || []).length;
        if (openTags !== closeTags) return;

        const scripts = Array.from(container.querySelectorAll("script"));
        const needsPlotly = scripts.some(
            (s) => (s.text || "").includes("Plotly")
        );

        const executeScripts = () => {
            for (const oldScript of scripts) {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.text = oldScript.text || "";
                oldScript.parentNode?.replaceChild(newScript, oldScript);
            }
        };

        if (!needsPlotly) {
            executeScripts();
            return;
        }

        // Plotly scripts need the library loaded first.
        // Load it once globally, then execute all scripts.
        ensurePlotly().then(executeScripts);
    }, [html, instanceId]);

    // The dashboard grid's cell-size slider (ViewsGrid.tsx) changes this
    // component's outer box size by adjusting the CSS grid's row track
    // height. Two different kinds of content need two different responses:
    //
    // - A real Plotly figure never repaints itself on a container resize
    //   unless explicitly told to, so re-run Plotly's own resize routine on
    //   any graph divs found.
    // - Plain server-rendered card HTML (IQVigilant's NL Sentence cards,
    //   Advanced Development's journey cards) has no such API — instead,
    //   shrink it uniformly with a CSS transform so it fits the available
    //   height without needing to scroll, down to the `minScale` floor.
    //   Below that floor the card would become illegible, so overflow:auto on the
    //   outer wrapper (set by the caller's `style` prop) is left as the
    //   final fallback — and since browsers compute scrollable overflow
    //   from an element's *transformed* geometry — that held on the
    //   Chromium/Linux build this was developed against, but testing found
    //   Windows Chrome/Edge do NOT shrink an ancestor's computed scrollable
    //   overflow to match a transformed descendant: the classic (always-
    //   reserved-space) Windows scrollbar kept rendering even once the
    //   scaled content measurably fit with margin to spare. `scaleWrapperRef`
    //   below sidesteps that entirely by giving the scaled-down size a real,
    //   unambiguous CSS height instead of relying on transform-aware
    //   overflow math anywhere.
    useEffect(() => {
        const outer = outerRef.current;
        const content = containerRef.current;
        const scaleWrapper = scaleWrapperRef.current;
        if (!outer || !content || !scaleWrapper) return;

        const recompute = () => {
            const plotly = (window as any).Plotly;
            const graphDivs = content.querySelectorAll<HTMLElement>(".js-plotly-plot");

            const outerStyle = window.getComputedStyle(outer);
            const verticalPadding = parseFloat(outerStyle.paddingTop || "0") + parseFloat(outerStyle.paddingBottom || "0");
            const availableHeight = outer.clientHeight - verticalPadding;

            if (graphDivs.length > 0) {
                // A real chart manages its own sizing — never CSS-scale it,
                // that would just blur the rendered plot. But `content` can
                // still be taller overall than `availableHeight` even after
                // Plotly resizes its own graph (e.g. a card with a table
                // *and* a chart, where the graph is only part of the
                // content) — leaving scaleWrapper's height unconstrained in
                // that case reintroduces the exact redundant outer
                // scrollbar this wrapper exists to prevent. A maxHeight
                // (rather than a fixed height, since a shorter chart
                // shouldn't be stretched) with the overflow:hidden already
                // on scaleWrapper caps that without touching the chart's
                // own transform/resize handling above.
                content.style.transform = "";
                scaleWrapper.style.height = "";
                scaleWrapper.style.maxHeight = availableHeight > 0 ? `${Math.floor(availableHeight)}px` : "";
                if (plotly?.Plots?.resize) {
                    graphDivs.forEach((graphDiv) => {
                        try {
                            plotly.Plots.resize(graphDiv);
                        } catch {
                            // A graph mid-(re)render can throw here; safe to
                            // ignore since the next resize tick will retry.
                        }
                    });
                }
                return;
            }

            scaleWrapper.style.maxHeight = "";
            // scrollHeight reads the content's own unscaled layout box — a
            // CSS transform (including one this same effect applied on a
            // previous tick) never changes it, so this is always the true
            // "natural" height to compare against, not a moving target.
            const naturalHeight = content.scrollHeight;

            if (availableHeight <= 0 || naturalHeight <= availableHeight) {
                content.style.transform = "";
                scaleWrapper.style.height = "";
                return;
            }

            const scale = Math.max(minScale, availableHeight / naturalHeight);
            content.style.transform = `scale(${scale})`;
            content.style.transformOrigin = "top center";
            // scaleWrapper's own border box is what `outer` actually looks
            // at when deciding whether it needs to scroll — giving it this
            // real (floored, never rounded up) pixel height is what makes
            // that decision unambiguous on every browser/OS scrollbar style,
            // instead of depending on each one to notice the transform.
            scaleWrapper.style.height = `${Math.floor(naturalHeight * scale)}px`;
        };

        recompute();
        const observer = new ResizeObserver(recompute);
        observer.observe(outer);
        observer.observe(content);
        return () => observer.disconnect();
    }, [html, minScale]);

    return (
        <div ref={outerRef} style={style}>
            <div ref={scaleWrapperRef} style={{ overflow: "hidden" }}>
                <div
                    ref={containerRef}
                    dangerouslySetInnerHTML={{ __html: cleanedHtml }}
                />
            </div>
        </div>
    );
};

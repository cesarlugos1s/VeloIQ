import React, { useEffect, useRef } from "react";
import { theme } from "antd";
import { ensurePlotly, getPlotly } from "../utils/plotlyLoader";
import { applyChartThemeToGraph } from "./DynamicResource/analysis/chartTheme";
import { isDarkColor } from "./DynamicResource/utils/colors";

let instanceCounter = 0;

// ---------------------------------------------------------------------------
// Resize-churn circuit breaker
// ---------------------------------------------------------------------------
// A Plotly chart (or flip-card) redrawn against an "auto"-height grid row can,
// if Plotly's own auto-margin computation doesn't converge in one corrective
// pass, keep nudging its own container's natural content height on every
// resize. That re-triggers this file's ResizeObservers, which schedule another
// corrective resize, indefinitely (seen as a grid cell that keeps growing and
// shrinking, with "<rect> attribute height: Expected length, 'NaN'" console
// errors). Cap how many corrective-resize attempts any single element gets
// within a short rolling window; the window resets after a quiet period, so a
// later genuine resize (a real container-size change, a browser window resize)
// still gets its own fresh attempts.
const RESIZE_CHURN_LIMIT = 6;
const RESIZE_CHURN_WINDOW_MS = 3000;
const resizeChurnTracker = new WeakMap<HTMLElement, { count: number; windowStart: number }>();

/** True while `el` still has corrective-resize attempts left in the current window. */
function allowResizeAttempt(el: HTMLElement): boolean {
    const now = Date.now();
    const entry = resizeChurnTracker.get(el);
    if (!entry || now - entry.windowStart > RESIZE_CHURN_WINDOW_MS) {
        resizeChurnTracker.set(el, { count: 1, windowStart: now });
        return true;
    }
    entry.count += 1;
    return entry.count <= RESIZE_CHURN_LIMIT;
}

// Shared, deduplicated resize scheduler across every <InlinePlotlyHtml>
// instance on the page. When many grid cells' ResizeObservers fire around the
// same moment (a density switch, a carousel settling), independent per-instance
// debounces land a few ms apart and resize the SAME chart several times in a
// row, re-triggering Plotly's auto-margin computation before it converges
// ("WARN: Too many auto-margin redraws"). One global debounce with a Set
// resizes each chart div at most once per settle cycle.
const pendingPlotlyResizeDivs = new Set<HTMLElement>();
let plotlyResizeFlushTimer: number | null = null;
/** Queue a Plotly.Plots.resize() of `div` for the next shared settle cycle. */
function schedulePlotlyResize(div: HTMLElement) {
    if (!allowResizeAttempt(div)) return;
    pendingPlotlyResizeDivs.add(div);
    if (plotlyResizeFlushTimer) window.clearTimeout(plotlyResizeFlushTimer);
    plotlyResizeFlushTimer = window.setTimeout(() => {
        plotlyResizeFlushTimer = null;
        const Plotly = (window as any).Plotly;
        const divs = Array.from(pendingPlotlyResizeDivs);
        pendingPlotlyResizeDivs.clear();
        if (!Plotly?.Plots?.resize) return;
        divs.forEach((plotDiv) => {
            if (!plotDiv.isConnected) return;
            try { Plotly.Plots.resize(plotDiv); } catch { /* a graph mid-(re)render can throw; the next tick retries */ }
        });
    }, 400);
}

// Same idea as schedulePlotlyResize, for the flip-card sizing script the
// backend embeds (jm_render_flipping_card_initialization_scripts, defining
// window.optimizeCardSizeInViewPort). That script measures the card's clipping
// ancestor only a few times right after it first runs and bakes the result into
// the card's `--card-height`; nothing re-runs it when the available space later
// changes (a cell maximized or restored, a density switch). Re-running it
// whenever the container genuinely resizes keeps the card in step.
const pendingCardResizeContainers = new Set<HTMLElement>();
let cardResizeFlushTimer: number | null = null;
/** Queue a re-run of the flip-card sizing script for every card inside `container`. */
function scheduleCardResize(container: HTMLElement) {
    if (!allowResizeAttempt(container)) return;
    pendingCardResizeContainers.add(container);
    if (cardResizeFlushTimer) window.clearTimeout(cardResizeFlushTimer);
    cardResizeFlushTimer = window.setTimeout(() => {
        cardResizeFlushTimer = null;
        const optimize = (window as any).optimizeCardSizeInViewPort;
        const containers = Array.from(pendingCardResizeContainers);
        pendingCardResizeContainers.clear();
        if (typeof optimize !== "function") return;
        containers.forEach((cardsContainer) => {
            if (!cardsContainer.isConnected) return;
            cardsContainer.querySelectorAll<HTMLElement>('.container[id^="cardContainer"]').forEach((cardEl) => {
                const suffix = cardEl.id.slice("cardContainer".length);
                if (!suffix) return;
                try { optimize(suffix); } catch { /* noop */ }
            });
        });
    }, 400);
}


/**
 * Renders backend-built HTML (Plotly charts, flipping answer cards) inline (no iframe) by:
 * 1. Stripping Plotly.js loader <script> tags (loaded once globally below)
 * 2. Making card button IDs unique per instance to avoid DOM ID conflicts
 * 3. Injecting the remaining HTML via dangerouslySetInnerHTML
 * 4. Ensuring Plotly is loaded, and the container has a real size, before
 *    executing inline <script> tags
 * 5. Keeping charts and cards sized to their container as it resizes
 * 6. Re-colouring the charts for the page's light/dark theme (chartTheme)
 *
 * This is the one Plotly host component for VeloIQ and its extensions.
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
    /** Smallest CSS scale scale-to-fit may shrink plain card HTML to. */
    minScale?: number;
    /**
     * Shrink plain card HTML so it fits the outer box's height (dashboard cells).
     * Pass false where the content should keep its natural size and the page
     * scrolls instead (e.g. IQVigilant's NL Sentence and NL Chat pages).
     */
    scaleToFit?: boolean;
}> = ({ html, style, minScale = DEFAULT_MIN_CARD_SCALE, scaleToFit = true }) => {
    const { token } = theme.useToken();
    const dark = isDarkColor(token.colorBgContainer);
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

    // Strip any Plotly.js loader <script src="..."> tag — the CDN one or a
    // vendored plotly.min.js copy, which older stored HTML (e.g. saved NL
    // answers) may still reference — Plotly.js is loaded once globally via
    // ensurePlotly() (utils/plotlyLoader) instead.
    let cleanedHtml = html.replace(
        /<script[^>]*src=["'][^"']*(?:cdn\.plot\.ly|\/plotly\.min\.js)[^"']*["'][^>]*><\/script>/gi,
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

        // A Plotly chart drawn while this container is mid-layout (width or
        // height still 0) gets built from a 0-size bounding box: Plotly then
        // emits <rect height="NaN"> and the chart never recovers. Wait for a
        // real, non-zero size before running any embedded script (Plotly or
        // not) instead of racing that transient state.
        let cancelled = false;
        let sizeObserver: ResizeObserver | null = null;
        const runWhenSized = (fn: () => void) => {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                fn();
                return;
            }
            sizeObserver = new ResizeObserver((entries) => {
                if (cancelled) return;
                for (const entry of entries) {
                    if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                        sizeObserver?.disconnect();
                        sizeObserver = null;
                        fn();
                        return;
                    }
                }
            });
            sizeObserver.observe(container);
        };

        if (!needsPlotly) {
            runWhenSized(executeScripts);
        } else {
            // Plotly scripts need the library loaded first.
            // Load it once globally, then execute all scripts.
            ensurePlotly().then(() => {
                if (cancelled) return;
                runWhenSized(executeScripts);
            });
        }

        return () => {
            cancelled = true;
            sizeObserver?.disconnect();
        };
    }, [html, instanceId]);

    // Backend charts are drawn with the light theme's colours; re-colour them for the page
    // theme once they have been drawn (scripts run asynchronously, after Plotly loads and the
    // container has a size) and again whenever the theme changes.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const applyTheme = () => {
            const Plotly = getPlotly();
            container.querySelectorAll<HTMLElement>(".js-plotly-plot").forEach((graphDiv) => applyChartThemeToGraph(graphDiv, dark, Plotly));
        };
        const timers = [0, 400, 1500].map((delay) => window.setTimeout(applyTheme, delay));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [html, dark, instanceId]);

    // The dashboard grid's cell-size slider (ViewsGrid.tsx) changes this
    // component's outer box size by adjusting the CSS grid's row track
    // height. Two different kinds of content need two different responses:
    //
    // - A real Plotly figure never repaints itself on a container resize
    //   unless explicitly told to, so re-run Plotly's own resize routine on
    //   any graph divs found (through the shared, churn-limited scheduler).
    //   Flipping cards' own sizing script is re-run the same way.
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
            const graphDivs = content.querySelectorAll<HTMLElement>(".js-plotly-plot");
            graphDivs.forEach((graphDiv) => schedulePlotlyResize(graphDiv));
            scheduleCardResize(content);

            if (!scaleToFit) {
                // Natural size: no transform and no height cap; the page scrolls.
                content.style.transform = "";
                scaleWrapper.style.height = "";
                scaleWrapper.style.maxHeight = "";
                return;
            }

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
    }, [html, minScale, scaleToFit]);

    return (
        <div ref={outerRef} style={style}>
            <div ref={scaleWrapperRef} style={{ overflow: scaleToFit ? "hidden" : "visible" }}>
                <div
                    ref={containerRef}
                    dangerouslySetInnerHTML={{ __html: cleanedHtml }}
                />
            </div>
        </div>
    );
};

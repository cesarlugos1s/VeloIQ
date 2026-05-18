import React, { useEffect, useRef } from "react";

let instanceCounter = 0;

/**
 * Renders Plotly HTML inline (no iframe) by:
 * 1. Stripping Plotly CDN <script> tags (Plotly.js is loaded globally once)
 * 2. Making card button IDs unique per instance to avoid DOM ID conflicts
 * 3. Injecting the remaining HTML via dangerouslySetInnerHTML
 * 4. Executing any inline <script> tags after render
 */
export const InlinePlotlyHtml: React.FC<{
    html: string;
    style?: React.CSSProperties;
}> = ({ html, style }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceIdRef = useRef<string>("");

    // Assign a unique instance ID once per mount
    if (!instanceIdRef.current) {
        instanceCounter += 1;
        instanceIdRef.current = `iph-${instanceCounter}-${Date.now()}`;
    }
    const instanceId = instanceIdRef.current;

    // Strip Plotly CDN script tags — Plotly.js is loaded globally via index.html
    let cleanedHtml = html.replace(
        /<script[^>]*src=["'][^"']*cdn\.plot\.ly[^"']*["'][^>]*><\/script>/gi,
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

        // Find and execute any inline <script> tags in the injected HTML
        const scripts = Array.from(container.querySelectorAll("script"));
        for (const oldScript of scripts) {
            const newScript = document.createElement("script");
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.text = oldScript.text || "";
            oldScript.parentNode?.replaceChild(newScript, oldScript);
        }
    }, [html, instanceId]);

    return (
        <div
            ref={containerRef}
            dangerouslySetInnerHTML={{ __html: cleanedHtml }}
            style={style}
        />
    );
};

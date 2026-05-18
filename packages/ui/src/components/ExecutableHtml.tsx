import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ColorModeContext } from "../contexts/ColorModeContext";

type ExecutableHtmlProps = {
    html?: string;
    htmlChunks?: string[];
    resetToken?: string;
    style?: React.CSSProperties;
    mode?: "inline" | "iframe";
    minHeight?: number;
    title?: string;
    inheritTypography?: boolean;
    inheritTabRowBackground?: boolean;
    fontSizeOverride?: string;
};

/* ------------------------------------------------------------------ */
/* JM CSS custom-property definitions — duplicated from overrides.css  */
/* so iframes (which are isolated documents) also get them.            */
/* ------------------------------------------------------------------ */
const JM_CSS_VARS_LIGHT = `
  --jm-bg: #ffffff;
  --jm-bg-secondary: #f5fbff;
  --jm-bg-tertiary: #f3f6f9;
  --jm-bg-elevated: #ffffff;
  --jm-text-primary: #0f172a;
  --jm-text-secondary: #475569;
  --jm-text-tertiary: #6b7280;
  --jm-text-link: #1677FF;
  --jm-border: #dbe3ef;
  --jm-border-secondary: #d1d5db;
  --jm-border-cell: #eef2f7;
  --jm-separator: #e0e0e0;
  --jm-card-bg: #ffffff;
  --jm-card-border: #cfe0eb;
  --jm-card-header-from: #f5fbff;
  --jm-card-header-to: #eff8ff;
  --jm-card-shadow: rgba(18, 47, 64, 0.10);
  --jm-card-back-bg: #f8fcff;
  --jm-card-back-border: #e2eef6;
  --jm-btn-bg: #fff;
  --jm-btn-border: #d9d9d9;
  --jm-btn-text: rgba(0,0,0,0.88);
  --jm-btn-hover-bg: #ffffff;
  --jm-input-bg: #ffffff;
  --jm-input-text: #111111;
  --jm-input-placeholder: #9aa7b5;
  --jm-input-editable-bg: #f3f6f9;
  --jm-kpi-banner-bg: #F2FFFF;
  --jm-kpi-user-bg: #d6f0ff;
  --jm-kpi-ask-bg: #edf7ff;
  --jm-kpi-label: #3f5565;
  --jm-kpi-value: #1677FF;
  --jm-kpi-paragraph: #333;
  --jm-tone-soft: #dbeafe;
  --jm-tone-softer: #eff6ff;
  --jm-carousel-btn-bg: #ffffff;
  --jm-carousel-btn-text: #456277;
  --jm-carousel-btn-border: #b8d0e0;
  --jm-carousel-active-bg: #eaf5ff;
  --jm-carousel-active-border: #8eb3ca;
  --jm-carousel-active-text: #194f6f;
  --jm-carousel-header-from: #f6fafc;
  --jm-carousel-header-to: #eef5f8;
  --jm-filter-popover-bg: #fff;
  --jm-filter-popover-shadow: rgba(17,24,39,.16);
  --jm-sort-arrow: #9ca3af;
  --jm-filter-icon: #6b7280;
  --jm-numeric-bar: rgba(37,99,235,.16);
  --jm-no-results: #6b7280;
`;

const JM_CSS_VARS_DARK = `
  --jm-bg: #141414;
  --jm-bg-secondary: #1a1a2e;
  --jm-bg-tertiary: #1f1f33;
  --jm-bg-elevated: #1c1c1c;
  --jm-text-primary: #e4e4e7;
  --jm-text-secondary: #a1a1aa;
  --jm-text-tertiary: #71717a;
  --jm-text-link: #4ea4f6;
  --jm-border: #2e2e3a;
  --jm-border-secondary: #3f3f50;
  --jm-border-cell: #232336;
  --jm-separator: #2e2e3a;
  --jm-card-bg: #1c1c2e;
  --jm-card-border: #2e3d4f;
  --jm-card-header-from: #1a1a2e;
  --jm-card-header-to: #1e2230;
  --jm-card-shadow: rgba(0, 0, 0, 0.30);
  --jm-card-back-bg: #181828;
  --jm-card-back-border: #2a2a40;
  --jm-btn-bg: #23233a;
  --jm-btn-border: #3f3f50;
  --jm-btn-text: rgba(228,228,231,0.88);
  --jm-btn-hover-bg: #2a2a44;
  --jm-input-bg: #1a1a2e;
  --jm-input-text: #e4e4e7;
  --jm-input-placeholder: #6b6b80;
  --jm-input-editable-bg: #1f1f33;
  --jm-kpi-banner-bg: #141828;
  --jm-kpi-user-bg: #162030;
  --jm-kpi-ask-bg: #161e30;
  --jm-kpi-label: #8fa4b5;
  --jm-kpi-value: #4ea4f6;
  --jm-kpi-paragraph: #b0b0c0;
  --jm-tone-soft: #1e2a40;
  --jm-tone-softer: #181e30;
  --jm-carousel-btn-bg: #23233a;
  --jm-carousel-btn-text: #8fa4b5;
  --jm-carousel-btn-border: #2e3d4f;
  --jm-carousel-active-bg: #1a2840;
  --jm-carousel-active-border: #3a5570;
  --jm-carousel-active-text: #a0c8e8;
  --jm-carousel-header-from: #1a1a2e;
  --jm-carousel-header-to: #1e2230;
  --jm-filter-popover-bg: #1c1c2e;
  --jm-filter-popover-shadow: rgba(0,0,0,.40);
  --jm-sort-arrow: #6b6b80;
  --jm-filter-icon: #71717a;
  --jm-numeric-bar: rgba(78,164,246,.20);
  --jm-no-results: #71717a;
`;

// --- PERFORMANCE TRACING (shared with custom_show.tsx) ---
const traceLog = (label: string, detail?: string) => {
  if (typeof window === 'undefined' || sessionStorage.getItem('jm_trace') !== '1') return;
  const now = performance.now();
  console.log(`[JM_TRACE ${now.toFixed(1)}ms] ${label}${detail ? ' | ' + detail : ''}`);
};

export const ExecutableHtml: React.FC<ExecutableHtmlProps> = ({
    html,
    htmlChunks,
    resetToken = "",
    style,
    mode = "inline",
    minHeight = 600,
    title = "legacy-rendered-view",
    inheritTypography = false,
    inheritTabRowBackground = false,
    fontSizeOverride,
}) => {
    const htmlRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);
    const appendedChunksRef = useRef(0);
    const scriptIdRef = useRef(0);
    const syncHeightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSetHeightRef = useRef(0);
    const [fontFamily, setFontFamily] = useState("Arial, sans-serif");
    const [fontSize, setFontSize] = useState("14px");
    const [lineHeight, setLineHeight] = useState("1.5715");
    const [tabRowBackground, setTabRowBackground] = useState("#fafafa");
    const { mode: colorMode } = useContext(ColorModeContext);
    const isDark = colorMode === "dark";
    const mountTimeRef = useRef(performance.now());
    const instanceId = useRef(Math.random().toString(36).slice(2, 6));
    const htmlRefForEffect = useRef(html);
    htmlRefForEffect.current = html;
    traceLog('ExecutableHtml', `[${instanceId.current}] mount mode=${mode} title=${title} htmlLen=${(html||'').length}`);

    const executeScriptNodesSequentially = useCallback(async (
        doc: Document,
        scriptNodes: HTMLScriptElement[],
        isCancelled?: () => boolean,
    ) => {
        for (const oldScript of scriptNodes) {
            if (isCancelled?.()) return;
            const newScript = doc.createElement("script");
            Array.from(oldScript.attributes).forEach((attr) => {
                if (attr.name === "data-jm-script-id") return;
                newScript.setAttribute(attr.name, attr.value);
            });
            if (!oldScript.src) {
                newScript.text = oldScript.text || "";
                newScript.async = false;
                oldScript.parentNode?.replaceChild(newScript, oldScript);
                continue;
            }
            await new Promise<void>((resolve) => {
                newScript.onload = () => resolve();
                newScript.onerror = () => resolve();
                newScript.async = false;
                oldScript.parentNode?.replaceChild(newScript, oldScript);
            });
        }
    }, []);

    useEffect(() => {
        if (mode !== "inline") return;
        const container = htmlRef.current;
        if (!container || !html) return;
        const scripts = Array.from(container.querySelectorAll("script"));
        let cancelled = false;
        void executeScriptNodesSequentially(document, scripts, () => cancelled);
        return () => {
            cancelled = true;
        };
    }, [html, mode, executeScriptNodesSequentially]);

    useEffect(() => {
        if (mode !== "iframe") return;
        if (!inheritTypography && !inheritTabRowBackground) return;
        if (typeof window === "undefined") return;
        const bodyStyle = window.getComputedStyle(document.body);

        if (inheritTypography) {
            const nextFontFamily = String(bodyStyle?.fontFamily || "").trim();
            const nextFontSize = fontSizeOverride || String(bodyStyle?.fontSize || "").trim();
            const nextLineHeight = String(bodyStyle?.lineHeight || "").trim();
            if (nextFontFamily) setFontFamily(nextFontFamily);
            if (nextFontSize) setFontSize(nextFontSize);
            if (nextLineHeight && nextLineHeight !== "normal") setLineHeight(nextLineHeight);
        }

        if (inheritTabRowBackground) {
            const isTransparent = (value: string): boolean => {
                const normalized = String(value || "").replace(/\s+/g, "").toLowerCase();
                return !normalized || normalized === "transparent" || normalized === "rgba(0,0,0,0)";
            };
            const tabEl = document.querySelector(".ant-tabs-tab") as HTMLElement | null;
            const navEl = document.querySelector(".ant-tabs-nav") as HTMLElement | null;
            const tabBg = tabEl ? window.getComputedStyle(tabEl).backgroundColor : "";
            const navBg = navEl ? window.getComputedStyle(navEl).backgroundColor : "";
            const resolvedBg = !isTransparent(tabBg) ? tabBg : (!isTransparent(navBg) ? navBg : "");
            if (resolvedBg) setTabRowBackground(resolvedBg);
        }
    }, [inheritTabRowBackground, inheritTypography, mode]);

    // Build the iframe shell with CSS vars baked into the <head> so they are
    // available immediately — no dependency on backend HTML containing them.
    const htmlShell = useMemo(() => (
        `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
:root {
${isDark ? JM_CSS_VARS_DARK : JM_CSS_VARS_LIGHT}
}
html, body {
  margin: 0;
  padding: 0;
  background: var(--jm-bg, #ffffff);
  color: var(--jm-text-primary, #0f172a);
  font-size: ${fontSize};
  line-height: ${lineHeight};
}
body, table, th, td, input, button, select, textarea, div, span, p, li, ul, ol {
  font-family: ${fontFamily} !important;
}
.jm-fileview-name-row {
  background-color: ${tabRowBackground} !important;
  color: ${isDark ? '#e4e4e7' : '#0f172a'} !important;
}
.jm-fileview-description {
  font-size: 12px !important;
  line-height: 1.45 !important;
}
</style>
</head>
<body></body>
</html>`
    ), [fontFamily, fontSize, lineHeight, tabRowBackground, isDark]);

    const syncHeight = useCallback(() => {
        if (syncHeightTimerRef.current) clearTimeout(syncHeightTimerRef.current);
        syncHeightTimerRef.current = setTimeout(() => {
            syncHeightTimerRef.current = null;
            const iframe = iframeRef.current;
            const doc = iframe?.contentDocument;
            if (!iframe || !doc) return;
            const rawHeight = Math.max(
                doc.body?.scrollHeight || 0,
                doc.documentElement?.scrollHeight || 0,
                minHeight,
            );
            const nextHeight = rawHeight + 8;
            // Skip if the only change is our own +8 padding (breaks autosize feedback loop)
            if (Math.abs(nextHeight - lastSetHeightRef.current) <= 8) return;
            lastSetHeightRef.current = nextHeight;
            iframe.style.height = `${nextHeight}px`;
        }, 100);
    }, [minHeight]);

    const appendHtmlChunk = useCallback(async (chunk: string): Promise<boolean> => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || !doc.body || !chunk) return false;

        const host = doc.createElement("div");
        host.innerHTML = chunk;
        const scriptIds: string[] = [];
        Array.from(host.querySelectorAll("script")).forEach((scriptNode) => {
            const nextId = String(++scriptIdRef.current);
            scriptNode.setAttribute("data-jm-script-id", nextId);
            scriptIds.push(nextId);
        });
        while (host.firstChild) {
            doc.body.appendChild(host.firstChild);
        }
        if (scriptIds.length) {
            const pendingScripts = scriptIds
                .map((id) => doc.querySelector(`script[data-jm-script-id="${id}"]`) as HTMLScriptElement | null)
                .filter(Boolean) as HTMLScriptElement[];
            await executeScriptNodesSequentially(doc, pendingScripts);
        }
        syncHeight();
        return true;
    }, [syncHeight, executeScriptNodesSequentially]);

    useEffect(() => {
        if (mode !== "iframe") return;
        const iframe = iframeRef.current;
        if (!iframe) return;
        appendedChunksRef.current = 0;
        lastSetHeightRef.current = 0;

        const loadStartTime = performance.now();
        iframe.srcdoc = htmlShell;
        traceLog('ExecutableHtml', `[${instanceId.current}] iframe srcdoc set, waiting for load event`);
        const onLoad = () => {
            const loadElapsed = performance.now() - loadStartTime;
            traceLog('ExecutableHtml', `[${instanceId.current}] iframe load event fired after ${loadElapsed.toFixed(0)}ms`);
            const doc = iframe.contentDocument;
            if (!doc) return;
            if (observerRef.current) observerRef.current.disconnect();
            const observer = new MutationObserver(syncHeight);
            observer.observe(doc.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true,
            });
            observerRef.current = observer;

            void (async () => {
                const currentHtml = htmlRefForEffect.current;
                if (htmlChunks && htmlChunks.length > 0) {
                    let appendedCount = 0;
                    for (const chunk of htmlChunks) {
                        if (await appendHtmlChunk(chunk)) appendedCount += 1;
                    }
                    appendedChunksRef.current = appendedCount;
                } else if (currentHtml) {
                    await appendHtmlChunk(currentHtml);
                } else {
                    syncHeight();
                }
            })();
        };

        iframe.addEventListener("load", onLoad);
        return () => {
            iframe.removeEventListener("load", onLoad);
        };
    }, [htmlShell, resetToken, appendHtmlChunk, syncHeight, mode]);

    useEffect(() => {
        if (mode !== "iframe") return;
        if (!htmlChunks || htmlChunks.length <= appendedChunksRef.current) return;
        const nextChunks = htmlChunks.slice(appendedChunksRef.current);
        void (async () => {
            let appendedCount = 0;
            for (const chunk of nextChunks) {
                if (await appendHtmlChunk(chunk)) appendedCount += 1;
            }
            appendedChunksRef.current += appendedCount;
        })();
    }, [htmlChunks, appendHtmlChunk, mode]);

    useEffect(() => {
        return () => {
            if (observerRef.current) observerRef.current.disconnect();
            observerRef.current = null;
            if (syncHeightTimerRef.current) clearTimeout(syncHeightTimerRef.current);
        };
    }, []);

    if (mode === "iframe") {
        return (
            <iframe
                ref={iframeRef}
                title={title}
                style={{ width: "100%", minHeight, border: 0, ...style }}
            />
        );
    }

    return <div ref={htmlRef} dangerouslySetInnerHTML={{ __html: html || "" }} style={style} />;
};

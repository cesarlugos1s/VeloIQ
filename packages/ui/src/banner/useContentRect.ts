import { useEffect, useState } from "react";
import { clipToViewport } from "./layout";
import type { ContentRect } from "./types";

/** Element the banners are placed over: the page content of an Ant Design layout. */
export const DEFAULT_CONTENT_SELECTOR = ".ant-layout-content";

/** Elements kept clear at the top of the content area: a sticky page header. */
export const DEFAULT_HEADER_SELECTOR = ".ant-layout-header";

const viewportRect = (): ContentRect => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

/**
 * Measures the content area: the visible part of the element matching
 * *contentSelector*, below any visible header matching *headerSelector*.
 * Without such an element (a page with no Ant Design layout), the whole window.
 */
const measure = (contentSelector: string, headerSelector: string): ContentRect => {
    const element = document.querySelector(contentSelector);
    if (!element) return viewportRect();
    const r = element.getBoundingClientRect();
    const clipped = clipToViewport({ left: r.left, top: r.top, width: r.width, height: r.height }, window.innerWidth, window.innerHeight);
    let headerBottom = 0;
    document.querySelectorAll(headerSelector).forEach((header) => {
        const h = header.getBoundingClientRect();
        if (h.bottom > 0 && h.top < window.innerHeight) headerBottom = Math.max(headerBottom, h.bottom);
    });
    if (headerBottom <= clipped.top) return clipped;
    const bottom = clipped.top + clipped.height;
    return { ...clipped, top: headerBottom, height: Math.max(0, bottom - headerBottom) };
};

/**
 * The content area banners are placed in, kept current as the side menu
 * collapses, the layout mounts or changes, the window resizes and the page scrolls.
 *
 * @param contentSelector CSS selector of the content element.
 * @param headerSelector CSS selector of headers to keep clear at the top.
 */
export function useContentRect(
    contentSelector: string = DEFAULT_CONTENT_SELECTOR,
    headerSelector: string = DEFAULT_HEADER_SELECTOR,
): ContentRect {
    const [rect, setRect] = useState<ContentRect>(() =>
        typeof window === "undefined" ? { left: 0, top: 0, width: 0, height: 0 } : measure(contentSelector, headerSelector));

    useEffect(() => {
        let frame = 0;
        let observed: Element | null = null;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const next = measure(contentSelector, headerSelector);
                setRect((prev) => (prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next));
            });
        };
        const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
        // The content element may mount later or be replaced on layout changes.
        const attach = () => {
            const element = document.querySelector(contentSelector);
            if (element !== observed) {
                if (observed) resizeObserver?.unobserve(observed);
                observed = element;
                if (element) resizeObserver?.observe(element);
            }
            update();
        };
        attach();
        const mutationObserver = new MutationObserver(attach);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [contentSelector, headerSelector]);

    return rect;
}

import { useEffect, useState } from "react";

/**
 * Attribute that marks a `position: fixed; bottom: 0` bar (e.g. an extension's
 * alerts bar) that floats over page content instead of reserving space for
 * itself. Layouts that size themselves to the bottom of the window subtract
 * the height of every marked element so their content stays reachable.
 */
export const BOTTOM_OVERLAY_ATTR = "data-veloiq-bottom-overlay";

/** Sums the rendered height of every marked bottom overlay currently in the DOM. */
function measureBottomOverlays(): number {
    let total = 0;
    document.querySelectorAll<HTMLElement>(`[${BOTTOM_OVERLAY_ATTR}]`).forEach((el) => {
        total += el.getBoundingClientRect().height;
    });
    return total;
}

/**
 * Returns the combined height in px of the bottom overlays marked with
 * `data-veloiq-bottom-overlay`, kept current as they mount/unmount (they may
 * load asynchronously) and as they resize (e.g. their text wraps on narrow
 * windows).
 */
export function useBottomOverlayInset(): number {
    const [inset, setInset] = useState(0);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => update()) : null;
        let observed: HTMLElement[] = [];

        const update = () => {
            setInset(measureBottomOverlays());
            // Re-observe the current set of overlays so their resizes are tracked.
            const current = Array.from(document.querySelectorAll<HTMLElement>(`[${BOTTOM_OVERLAY_ATTR}]`));
            if (resizeObserver && (current.length !== observed.length || current.some((el, i) => el !== observed[i]))) {
                resizeObserver.disconnect();
                current.forEach((el) => resizeObserver.observe(el));
                observed = current;
            }
        };

        update();
        const mutationObserver = new MutationObserver(update);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("resize", update);
        return () => {
            mutationObserver.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);

    return inset;
}

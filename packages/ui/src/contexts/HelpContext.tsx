import { createContext, useContext, useEffect } from "react";

/**
 * Tracks which page_key the app-shell Help drawer should show content for,
 * plus the current record id (when the page is about one specific record —
 * Show/Edit — so Help actions like "Pin to Dashboard" or "Go to Edit" know
 * what to act on). List/Create pages have no single record, so recordId is
 * null there.
 *
 * Dynamic pages (List/Show/Edit/Create) set this automatically via
 * useSetHelpPageKey — no per-page wiring needed. Bespoke/custom pages can
 * call the same hook with any string of their own choosing.
 */
export interface HelpContextValue {
    pageKey: string | null;
    recordId: string | number | null;
    setPageKey: (key: string | null, recordId?: string | number | null) => void;
}

export const HelpContext = createContext<HelpContextValue>({
    pageKey: null,
    recordId: null,
    setPageKey: () => {},
});

/**
 * Registers *pageKey* (and, for Show/Edit pages, the current *recordId*) as
 * the current page's help content key while this component is mounted,
 * clearing both on unmount. Normal route transitions unmount the outgoing
 * page before the incoming one mounts, so the brief null window in between
 * is not observable in practice.
 *
 * Passing `null` is a no-op, not a clear: embedded/nested renders (a
 * relation list inside a Show page, a Dashboard cell's embedded DynamicList)
 * call this with `null` to opt OUT of owning the ambient page_key — they
 * must not stomp whatever the actual enclosing page already set. Only a
 * real (non-null) pageKey ever writes to the shared context.
 */
export function useSetHelpPageKey(pageKey: string | null, recordId: string | number | null = null): void {
    const { setPageKey } = useContext(HelpContext);
    useEffect(() => {
        if (pageKey == null) return;
        setPageKey(pageKey, recordId);
        return () => setPageKey(null, null);
    }, [pageKey, recordId, setPageKey]);
}

import { useState } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../utils/authenticatedFetch";

export interface HelpDocResponse {
    found: boolean;
    title?: string;
    body?: string;
    actions?: { label: string; action_key: string }[];
}

/**
 * Fetches curated help content for one page_key on demand (no caching, same
 * "regenerate every time it opens" behavior as the rest of the framework's
 * on-open content fetches). Shared by the Dashboard cell/tab mini-help
 * popovers, which — unlike the main HelpDrawer — don't go through the
 * shared HelpContext (see Phase-2 plan: N cells/tabs render concurrently,
 * so there's no single "current page" for a shared context to represent).
 */
export function useHelpContent(pageKey: string) {
    const apiUrl = useApiUrl();
    const [loading, setLoading] = useState(false);
    const [doc, setDoc] = useState<HelpDocResponse | null>(null);

    const fetchContent = () => {
        setLoading(true);
        setDoc(null);
        authenticatedFetch(`${apiUrl}/help-documents/by-page/${encodeURIComponent(pageKey)}`)
            .then((res) => res.json())
            .then((data) => setDoc(data))
            .catch(() => setDoc({ found: false }))
            .finally(() => setLoading(false));
    };

    return { loading, doc, fetchContent };
}

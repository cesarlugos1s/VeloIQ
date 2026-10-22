import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { anchorGroupStyle, groupBannersByAnchor } from "./layout";
import { ModelBanner } from "./ModelBanner";
import { DEFAULT_CONTENT_SELECTOR, DEFAULT_HEADER_SELECTOR, useContentRect } from "./useContentRect";
import type { BannerPageContext, BannerPayload, BannerPosition } from "./types";

/** Builds the URL of the banners endpoint for one page. */
export const bannersUrl = (apiUrl: string, context: BannerPageContext): string => {
    const params = new URLSearchParams();
    (["resource", "module", "site"] as const).forEach((key) => {
        if (context[key]) params.set(key, context[key]!);
    });
    const query = params.toString();
    return `${apiUrl.replace(/\/$/, "")}/veloiq/banners${query ? `?${query}` : ""}`;
};

export interface BannerHostProps {
    /** The page the banners are asked for. */
    context: BannerPageContext;
    /** Base URL of the backend API (default "/api"). */
    apiUrl?: string;
    /** Fetch function carrying the app's or website's own authentication (default ``fetch``). */
    fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
    onOpenRow?: (resource: string, eid: number | string) => void;
    onViewAll?: (resource: string) => void;
    /** CSS selector of the element whose visible area holds the banners. */
    contentSelector?: string;
    /** CSS selector of headers the banners keep clear of at the top. */
    headerSelector?: string;
    /** Changing this value fetches the banners again (e.g. after the page's data changed). */
    refreshKey?: unknown;
    /** Stacking level of the banners (default 1000); an expanded banner is drawn above the others. */
    zIndex?: number;
    /** Expanding a banner collapses the others, so expanded panels never cover one another (default true). */
    singleExpanded?: boolean;
}

/**
 * BannerHost — draws every banner of ``banners.json`` that the current page shows.
 *
 * Fetches ``GET {apiUrl}/veloiq/banners`` for the page, then places each
 * banner at its anchor of the content area. Banners sharing an anchor are
 * stacked by priority instead of overlapping; an expanded banner is drawn
 * above the others, and with ``singleExpanded`` only one is expanded at a time.
 * Positions the user picks with a banner's arrows last until the page reloads.
 *
 * The host app renders it once (see ``AppBannerHost``); an external website
 * renders it with its own ``site`` key and ``fetcher``.
 */
export const BannerHost: React.FC<BannerHostProps> = ({
    context,
    apiUrl = "/api",
    fetcher,
    onOpenRow,
    onViewAll,
    contentSelector = DEFAULT_CONTENT_SELECTOR,
    headerSelector = DEFAULT_HEADER_SELECTOR,
    refreshKey,
    zIndex = 1000,
    singleExpanded = true,
}) => {
    const contentRect = useContentRect(contentSelector, headerSelector);
    const [banners, setBanners] = useState<BannerPayload[]>([]);
    const [moved, setMoved] = useState<Record<string, BannerPosition>>({});
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const url = bannersUrl(apiUrl, context);
    // Kept in a ref so a fetcher passed inline (a new function each render) doesn't refetch in a loop.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    useEffect(() => {
        let cancelled = false;
        (fetcherRef.current ?? fetch)(url)
            .then((response) => (response.ok ? response.json() : { banners: [] }))
            .then((data) => { if (!cancelled) setBanners(Array.isArray(data?.banners) ? data.banners : []); })
            // A banner never breaks the page: on any error the page simply shows none.
            .catch(() => { if (!cancelled) setBanners([]); });
        return () => { cancelled = true; };
    }, [url, refreshKey]);

    const setExpanded = useCallback((key: string, expanded: boolean) => {
        setExpandedKeys((prev) => {
            if (!expanded) return prev.filter((k) => k !== key);
            return singleExpanded ? [key] : [...prev.filter((k) => k !== key), key];
        });
    }, [singleExpanded]);

    const groups = useMemo(() => Array.from(groupBannersByAnchor(banners, moved).entries()), [banners, moved]);

    if (banners.length === 0 || contentRect.width === 0 || contentRect.height === 0) return null;

    return (
        <>
            {groups.map(([anchor, group]) => {
                const hasExpanded = group.banners.some((b) => expandedKeys.includes(b.key));
                return (
                    <div key={anchor} data-banner-anchor={anchor} style={{ ...anchorGroupStyle(group.position, contentRect), zIndex: hasExpanded ? zIndex + 1 : zIndex }}>
                        {group.banners.map((banner) => (
                            <ModelBanner
                                key={banner.key}
                                banner={banner}
                                position={group.position}
                                contentRect={contentRect}
                                expanded={expandedKeys.includes(banner.key)}
                                onExpandedChange={(expanded) => setExpanded(banner.key, expanded)}
                                onMove={(position) => setMoved((prev) => ({ ...prev, [banner.key]: position }))}
                                onOpenRow={onOpenRow ? (resource, eid) => { setExpanded(banner.key, false); onOpenRow(resource, eid); } : undefined}
                                onViewAll={onViewAll ? (resource) => { setExpanded(banner.key, false); onViewAll(resource); } : undefined}
                            />
                        ))}
                    </div>
                );
            })}
        </>
    );
};

export default BannerHost;

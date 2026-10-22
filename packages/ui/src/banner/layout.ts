import type { CSSProperties } from "react";
import type { BannerPayload, BannerPosition, ContentRect, HorizontalPosition, VerticalPosition } from "./types";

/**
 * Layout rules of the collapsible banners, kept free of React and the DOM so
 * they can be unit-tested.
 *
 * A banner sits at one of nine anchors of the page's content area: a
 * horizontal edge (left, center, right) crossed with a vertical edge (top,
 * middle, bottom). Banners sharing an anchor are stacked in one flex column,
 * the highest priority nearest the edge, so they never overlap each other.
 */

/** Distance in px between a banner group and the content area's edges. */
export const BANNER_EDGE_MARGIN = 16;

/** Gap in px between banners stacked at the same anchor. */
export const BANNER_STACK_GAP = 8;

/** The key grouping the banners that share an anchor. */
export const anchorKey = (position: BannerPosition): string => `${position.vertical}-${position.horizontal}`;

/**
 * Groups banners by anchor, using the position the user moved a banner to
 * when there is one, and orders each group by priority (highest first).
 *
 * @param banners The banners of the page.
 * @param moved Positions the user moved banners to in this session, by banner key.
 */
export const groupBannersByAnchor = (
    banners: ReadonlyArray<BannerPayload>,
    moved: Readonly<Record<string, BannerPosition>>,
): Map<string, { position: BannerPosition; banners: BannerPayload[] }> => {
    const groups = new Map<string, { position: BannerPosition; banners: BannerPayload[] }>();
    banners.forEach((banner) => {
        const position = moved[banner.key] ?? banner.position;
        const key = anchorKey(position);
        if (!groups.has(key)) groups.set(key, { position, banners: [] });
        groups.get(key)!.banners.push(banner);
    });
    groups.forEach((group) => group.banners.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.key.localeCompare(b.key)));
    return groups;
};

/**
 * Fixed-position style of an anchor's group: placed against the anchor's
 * edges of the content area, and stacking its banners away from that edge.
 */
export const anchorGroupStyle = (position: BannerPosition, rect: ContentRect): CSSProperties => {
    const horizontal: Record<HorizontalPosition, { left: number; translateX: string; align: CSSProperties["alignItems"] }> = {
        left: { left: rect.left + BANNER_EDGE_MARGIN, translateX: "0", align: "flex-start" },
        center: { left: rect.left + rect.width / 2, translateX: "-50%", align: "center" },
        right: { left: rect.left + rect.width - BANNER_EDGE_MARGIN, translateX: "-100%", align: "flex-end" },
    };
    const vertical: Record<VerticalPosition, { top: number; translateY: string; direction: CSSProperties["flexDirection"] }> = {
        top: { top: rect.top + BANNER_EDGE_MARGIN, translateY: "0", direction: "column" },
        middle: { top: rect.top + rect.height / 2, translateY: "-50%", direction: "column" },
        // Bottom groups grow upwards: the first (highest priority) banner stays nearest the edge.
        bottom: { top: rect.top + rect.height - BANNER_EDGE_MARGIN, translateY: "-100%", direction: "column-reverse" },
    };
    const h = horizontal[position.horizontal];
    const v = vertical[position.vertical];
    return {
        position: "fixed",
        left: h.left,
        top: v.top,
        transform: `translate(${h.translateX}, ${v.translateY})`,
        display: "flex",
        flexDirection: v.direction,
        alignItems: h.align,
        gap: BANNER_STACK_GAP,
        // The group never outgrows the content area, so stacked banners shrink instead of overlapping.
        maxWidth: Math.max(0, rect.width - 2 * BANNER_EDGE_MARGIN),
        maxHeight: Math.max(0, rect.height - 2 * BANNER_EDGE_MARGIN),
        pointerEvents: "none",
    };
};

/** Converts a banner's percentage sizes to px of the content area. */
export const percentSize = (sizes: { max_width: number; max_height: number }, rect: ContentRect): { maxWidth: number; maxHeight: number } => ({
    maxWidth: Math.max(0, (rect.width * sizes.max_width) / 100),
    maxHeight: Math.max(0, (rect.height * sizes.max_height) / 100),
});

/** One of the moves offered by a banner's arrows: the position it leads to and its tooltip. */
export interface BannerMove {
    id: "left" | "right" | "center" | "top" | "bottom" | "middle";
    label: string;
    to: (position: BannerPosition) => BannerPosition;
}

/**
 * The six moves of the position arrows. Each changes one axis and keeps the other,
 * so "move to the top" keeps a left banner on the left.
 */
export const bannerMoves = (translate: (text: string) => string): BannerMove[] => [
    { id: "left", label: translate("Move to the left edge"), to: (p) => ({ ...p, horizontal: "left" }) },
    { id: "center", label: translate("Move to the center"), to: (p) => ({ ...p, horizontal: "center" }) },
    { id: "right", label: translate("Move to the right edge"), to: (p) => ({ ...p, horizontal: "right" }) },
    { id: "top", label: translate("Move to the top"), to: (p) => ({ ...p, vertical: "top" }) },
    { id: "middle", label: translate("Move to the middle"), to: (p) => ({ ...p, vertical: "middle" }) },
    { id: "bottom", label: translate("Move to the bottom"), to: (p) => ({ ...p, vertical: "bottom" }) },
];

/** True when *move* would leave the banner where it is (its arrow is then disabled). */
export const isCurrentPosition = (move: BannerMove, position: BannerPosition): boolean =>
    anchorKey(move.to(position)) === anchorKey(position);

/** Intersection of an element's rect with the viewport, as the banners' content area. */
export const clipToViewport = (rect: ContentRect, viewportWidth: number, viewportHeight: number): ContentRect => {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewportWidth, rect.left + rect.width);
    const bottom = Math.min(viewportHeight, rect.top + rect.height);
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};

/**
 * Collapsible model-based banners — the light entry point
 * ``@juicemantics/veloiq-ui/banner``.
 *
 * Depends only on React, Ant Design and its icons, so external websites of a
 * host app (which don't use Refine or the rest of this package) can render the
 * banners of ``banners.json`` with ``<BannerHost context={{ site: "..." }} />``.
 * The host app itself uses ``AppBannerHost`` from the main entry point.
 */
export { BannerHost, bannersUrl } from "./BannerHost";
export type { BannerHostProps } from "./BannerHost";
export { CollapsibleBanner } from "./CollapsibleBanner";
export type { CollapsibleBannerProps } from "./CollapsibleBanner";
export { ModelBanner, bannerIcon } from "./ModelBanner";
export type { ModelBannerProps } from "./ModelBanner";
export { useContentRect, DEFAULT_CONTENT_SELECTOR, DEFAULT_HEADER_SELECTOR } from "./useContentRect";
export {
    anchorGroupStyle,
    anchorKey,
    bannerMoves,
    clipToViewport,
    groupBannersByAnchor,
    isCurrentPosition,
    percentSize,
    BANNER_EDGE_MARGIN,
    BANNER_STACK_GAP,
} from "./layout";
export type { BannerMove } from "./layout";
export type {
    BannerCollapsedContent,
    BannerColumn,
    BannerPageContext,
    BannerPayload,
    BannerPosition,
    BannerSizes,
    BannerTone,
    ContentRect,
    HorizontalPosition,
    VerticalPosition,
} from "./types";

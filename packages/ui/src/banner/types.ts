/**
 * Shapes of the collapsible model-based banners, as returned by
 * ``GET /api/veloiq/banners`` (see ``veloiq_framework/banners``).
 */

export type HorizontalPosition = "left" | "center" | "right";
export type VerticalPosition = "top" | "middle" | "bottom";

/** Where a banner sits in the page's content area. */
export interface BannerPosition {
    horizontal: HorizontalPosition;
    vertical: VerticalPosition;
}

/** Maximum size of a banner, in percent of the content area's width and height. */
export interface BannerSizes {
    max_width: number;
    max_height: number;
}

/** What the collapsed banner shows next to its icon. */
export type BannerCollapsedContent = "count" | "title" | "title_and_count" | "icon";

/** Colour family of a banner. */
export type BannerTone = "neutral" | "info" | "success" | "warning" | "error";

/** One column the expanded banner shows for each row. */
export interface BannerColumn {
    key: string;
    label: string;
}

/** A banner with its rows, ready to draw. */
export interface BannerPayload {
    key: string;
    title: string;
    /** Name of an Ant Design icon, e.g. "WarningOutlined". */
    icon: string;
    tone: BannerTone;
    position: BannerPosition;
    collapsed: BannerSizes;
    expanded: BannerSizes;
    collapsed_content: BannerCollapsedContent;
    movable: boolean;
    priority: number;
    /** Resource whose Show page a row opens (rows carry ``eid``); null when rows open nothing. */
    row_resource: string | null;
    /** Resource whose list the "View all" link opens; null hides the link. */
    view_all_resource: string | null;
    hide_when_empty: boolean;
    /** Number of rows the banner's query selects. */
    count: number;
    columns: BannerColumn[];
    /** The first ``max_rows`` rows. */
    rows: Array<Record<string, any>>;
}

/** The page a ``BannerHost`` asks banners for. */
export interface BannerPageContext {
    /** The host app page's model or named query resource. */
    resource?: string;
    /** The page's module, for pages that are not a model page. */
    module?: string;
    /** The external website's key (e.g. "candidate-portal"); set by external websites only. */
    site?: string;
}

/** Area of the window banners are placed in, in viewport px. */
export interface ContentRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

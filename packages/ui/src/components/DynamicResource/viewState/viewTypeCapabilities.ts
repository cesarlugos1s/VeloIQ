/**
 * What each view type supports. Shared controls render only the supported
 * options; options a view type does not support stay in the state (dormant) and
 * apply again when the user returns to a view type that supports them.
 * Adding a view type means adding one declaration here.
 */

export interface ViewTypeCapabilities {
    filters: boolean;
    multiSort: boolean;
    advancedFilter: boolean;
    pagination: boolean;
    fieldSequence: boolean;
    summaries: boolean;
    analyze: boolean;
}

const NONE: ViewTypeCapabilities = {
    filters: false, multiSort: false, advancedFilter: false, pagination: false,
    fieldSequence: false, summaries: false, analyze: false,
};

const RECORD_ROWS: ViewTypeCapabilities = {
    filters: true, multiSort: true, advancedFilter: true, pagination: true,
    fieldSequence: true, summaries: false, analyze: false,
};

const withOverrides = (overrides: Partial<ViewTypeCapabilities>): ViewTypeCapabilities => ({ ...RECORD_ROWS, ...overrides });

const TABLE = withOverrides({ analyze: true });
const LIST = withOverrides({ analyze: true });
const CSV = withOverrides({});
const TOTALS_DETAILS = withOverrides({ summaries: true, analyze: true });
const CROSSTAB = withOverrides({ pagination: false, summaries: true, analyze: true });
const KANBAN = withOverrides({ analyze: true });
const GALLERY = withOverrides({});
const CALENDAR = withOverrides({ pagination: false });
const PRIMARY: ViewTypeCapabilities = { ...NONE, fieldSequence: true };

const CAPABILITIES_BY_VIEW_TYPE: Record<string, ViewTypeCapabilities> = {
    "table": TABLE,
    "editable-table": TABLE,
    "list": LIST,
    "editable-list": LIST,
    "read-and-edit-list": LIST,
    "csv": CSV,
    "editable-csv": CSV,
    "read-and-edit-csv": CSV,
    "totals-details": TOTALS_DETAILS,
    "totalsdetails": TOTALS_DETAILS,
    "totaldetails": TOTALS_DETAILS,
    "crosstab": CROSSTAB,
    "editable-crosstab": CROSSTAB,
    "kanban": KANBAN,
    "gallery": GALLERY,
    "image": GALLERY,
    "calendar": CALENDAR,
    "primary": PRIMARY,
    "primary-carousel": PRIMARY,
};

/** The capabilities of a view type; an unknown view type supports nothing. */
export function getViewTypeCapabilities(viewType: string | undefined | null): ViewTypeCapabilities {
    return (viewType ? CAPABILITIES_BY_VIEW_TYPE[viewType] : undefined) ?? NONE;
}

/**
 * Capabilities for deciding what the page shows: a view type without a
 * declaration (for example tree) keeps the table's options, so a missing
 * declaration never removes a control that was available before.
 */
export function getViewTypeCapabilitiesForPage(viewType: string | undefined | null): ViewTypeCapabilities {
    return (viewType ? CAPABILITIES_BY_VIEW_TYPE[viewType] : undefined) ?? TABLE;
}

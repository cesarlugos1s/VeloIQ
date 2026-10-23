import React from "react";

export interface VisibilityCondition {
    field: string;
    operator: "eq" | "ne" | "in" | "not_in" | "truthy" | "falsy" | "gt" | "lt" | "gte" | "lte" | "ilike";
    value?: any;
}

export interface FieldDef {
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "date" | "datetime" | "time" | "image_url";
    isPk?: boolean;
    required?: boolean;
    reference?: string;
    referencePath?: string;
    optionLabel?: string;
    options?: { label: string; value: any }[];
    optionsUrl?: string;
    /** False leaves the field out of lists' default columns (e.g. long descriptions);
     *  it stays in the column selector and on the record's page. */
    showInList?: boolean;
    /** The field holds a list of values (shown as tags, edited with a multi-select). */
    multiple?: boolean;
    valueColors?: Record<string, string>;
    default?: any;
    defaultValue?: any;
    default_value?: any;
    description?: string;
    constraints?: string[];
    formula?: string;
    readOnly?: boolean;
    unique?: boolean;
    nullable?: boolean;
    showViewType?: string;
    editViewType?: string;
    /** Roles allowed to read this field (absent = all roles). Emitted by veloiq_field(read_roles=…). */
    readRoles?: string[];
    /** Roles allowed to write this field (absent = all roles). Emitted by veloiq_field(write_roles=…). */
    writeRoles?: string[];
    /**
     * Key of another field of the same row whose value is this field's type for
     * that row: a FieldDef type ("number", "boolean", ...) or a field view type
     * token ("color", "editable-color", ...). Used by parameter lists, where each
     * row's value has its own type.
     */
    typeFromField?: string;
    /** Key of another field of the same row holding this field's allowed values for that row. */
    optionsFromField?: string;
    /** For a reference to a resource with a composite key: the target key field this field holds. */
    referenceKey?: string;
}

export type RelationViewType = "table" | "editable-table" | "crosstab" | "editable-crosstab" | "editable-list" | "list" | "csv" | "read-and-edit-list" | "read-and-edit-csv" | "editable-csv" | "gallery" | "image" | "calendar" | "primary" | "totals-details" | "tree" | "tree-details";

export interface MillerLeafConfig {
    relationPath: string;
    targetKey: string;
    otherKey: string;
    resource: string;
    resourcePath?: string;
}

export interface RelationDef {
    resource: string;
    resourcePath?: string;
    targetKey: string;
    label: string;
    otherKey?: string;
    otherResource?: string;
    otherResourcePath?: string;
    relationName?: string;
    polymorphicType?: string;
    isRecursive?: boolean;
    minItems?: number;
    maxItems?: number;
    showViewType?: RelationViewType;
    editViewType?: RelationViewType;
    showViewTypeFromCsv?: boolean;
    editViewTypeFromCsv?: boolean;
    showCustomPageName?: string;
    editCustomPageName?: string;
    /** When false, the list table is hidden by default (only the Analyze panel shows). Controlled by DataDetail slider level. */
    defaultListVisible?: boolean;
    showTab?: string;
    editTab?: string;
    description?: string;
    // Miller columns (tree / tree-details) leaf configuration — single source (legacy)
    millerLeafResource?: string;
    millerLeafResourcePath?: string;
    millerLeafRelationPath?: string;
    millerLeafTargetKey?: string;
    millerLeafOtherKey?: string;
    // Miller columns — multiple leaf sources (takes precedence over single-source fields)
    millerLeafConfigs?: MillerLeafConfig[];
}

/**
 * A tab a model adds after the generated tabs of its Show and/or Edit page.
 * The Edit component stays mounted while the user switches tabs, and can take
 * part in the page's Save with `useBeforeEditSave`.
 */
export interface ModelExtraTab {
    key: string;
    /** Catalog msgid, translated when the page renders. */
    label: string;
    show?: React.ComponentType<{ record: any }>;
    edit?: React.ComponentType<{ record: any }>;
}

export interface ModelDef {
    name: string;
    label: string;
    module?: string;
    fields: FieldDef[];
    relations?: RelationDef[];
    hideInMenu?: boolean;
    /** Extra Show/Edit tabs (see ModelExtraTab). */
    extraTabs?: ModelExtraTab[];
    resource?: string;
    description?: string;
    pkField?: string;
    listViewType?: "table" | "editable-table" | "gallery" | "image" | "calendar" | "totals-details" | "primary" | "list" | "editable-list";
    /** Field keys whose values compose this model's record title (space-joined).
     *  Configured via `veloiq set-title` and stored on the model's
     *  `__veloiq_ui__["titleFields"]`; mirrors the backend `dc_title()`/`__str__`. */
    titleFields?: string[];
    /** True when this ModelDef represents a NamedQuery rather than a plain model table. */
    isNamedQuery?: boolean;
    /** Resource name of the primary model (for show/edit navigation and write routing). */
    primaryResource?: string;
    /** Default sort applied on first load when no saved preference exists. */
    defaultSort?: { field: string; order: "asc" | "desc" };
    /**
     * True for a non-model data resource: non-model data (a JSON file, settings, an
     * external service) served by the backend with the REST contract of a model.
     * Its ModelDef comes from GET /api/veloiq/non-model-data-resources at runtime.
     */
    isNonModelData?: boolean;
    /**
     * The resource holds exactly one record (a settings form). In the "primary"
     * view type DynamicList shows that record's form instead of a list.
     */
    isSingleRecord?: boolean;
    /** The key fields of a row. With more than one, `pkField` is "eid" (built from them by the backend). */
    pkFields?: string[];
    /** A non-model data resource whose source assigns new rows' keys (key fields aren't asked for on create). */
    sourceGeneratesKeys?: boolean;
    /**
     * False hides the Analyze section (charts and summaries) and its toggle on the
     * resource's lists, e.g. for configuration lists where it adds nothing.
     */
    showAnalyzeSection?: boolean;
    /** Which writes the resource accepts (absent = all, as for models). */
    capabilities?: { create?: boolean; update?: boolean; delete?: boolean };
    /**
     * Fields offered as filters in the list's Filters panel: each field with
     * options gets a multi-select, and the list shows the rows having any of the
     * chosen values (for a multi-valued field, any of its values).
     */
    quickFilterFields?: string[];
    /** Rows per page a list of the resource starts with (default 10). */
    defaultPageSize?: number;
}

export type PrimaryShowRendererProps = { model: ModelDef; id: string | number; allModels: ModelDef[]; viewName?: string };
export const PrimaryShowContext = React.createContext<React.ComponentType<PrimaryShowRendererProps> | null>(null);

/**
 * A custom button in a list row's Actions column (e.g. "Promote to registry").
 * After it runs, the list is refreshed; an error's message is shown.
 */
export interface RowActionDef {
    key: string;
    /** Tooltip (a catalog msgid, translated when shown). */
    label: string;
    icon: React.ReactNode;
    onExecute: (record: any) => Promise<void>;
    /** Whether the row shows the button (default: every row). */
    isVisible?: (record: any) => boolean;
    /** Other resources whose lists the action changes, refreshed after it runs. */
    refreshesResources?: string[];
    /** Asked before the action runs (a catalog msgid), e.g. for actions that can't be undone. */
    confirmMessage?: string;
}

export interface BulkActionDef {
    key: string;
    label: string;
    icon?: React.ReactNode;
    /** Called once per selected record during bulk execution. */
    onExecuteOne: (record: any) => Promise<void>;
    /** Extra content of the confirmation for the selected records (e.g. their summed token savings). */
    describeSelectedRecords?: (records: any[]) => React.ReactNode;
}

/**
 * Represents a related-model list page appended below the current DynamicList.
 * Created via the "Append related list" bulk action.
 */
export interface AppendedListDef {
    /** Unique identifier for this appended list instance. */
    id: string;
    /** The resource name of the related model to display. */
    modelResource: string;
    /** The filter key (e.g., "proveedor_id") used to filter the related list. */
    filterKey: string;
    /** The row IDs from the parent list that drive the filter. */
    filterIds: (string | number)[];
    /** The id of the parent list (used for nesting / removal). */
    parentListId: string | null;
}

export interface ViewConfigRow {
    view_type: string;
    subject_name: string;
    relation_name: string;
    object_name: string;
    form_type: string;
    section: string;
    section_id?: string | null;
    section_grid_row?: number | null;
    section_grid_col?: number | null;
    tab_name?: string | null;
    section_css_class?: string | null;
    section_html_snippet?: string | null;
    /** Section description (a catalog msgid) shown under its title. */
    section_description?: string | null;
    /** AntD icon name shown before the section title. */
    section_icon?: string | null;
    /** Color of the section's title and icon. */
    section_accent_color?: string | null;
    vid?: string;
    show_vid?: string;
    edit_vid?: string;
    showVid?: string;
    editVid?: string;
    limit?: number | null;
    row?: number | null;
    column?: number | null;
    show_label?: boolean;
    reload?: boolean;
    html_format?: string;
    /**
     * "attribute": a field of the record; "relation": one of its relations;
     * "nlsentence": an NL sentence; "view": a list of another resource (a model,
     * a named query or a non-model data resource named by `object_name`), shown with
     * the list view type of `vid` / `show_vid` / `edit_vid`, not tied to the record.
     */
    attribute_or_relation_type: "attribute" | "relation" | "nlsentence" | "view";
    nl_sentence_eid?: number | null;
    nl_sentence_title?: string | null;
    name: string;
    visibility_condition?: VisibilityCondition | null;
    read_only_in_edit?: boolean;
}

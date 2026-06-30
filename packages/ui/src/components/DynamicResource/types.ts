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
}

export type RelationViewType = "table" | "editable-table" | "crosstab" | "editable-crosstab" | "editable-list" | "list" | "csv" | "read-and-edit-list" | "read-and-edit-csv" | "editable-csv" | "gallery" | "calendar" | "primary" | "totals-details" | "tree" | "tree-details";

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

export interface ModelDef {
    name: string;
    label: string;
    module?: string;
    fields: FieldDef[];
    relations?: RelationDef[];
    hideInMenu?: boolean;
    resource?: string;
    description?: string;
    pkField?: string;
    listViewType?: "table" | "gallery" | "calendar" | "totals-details";
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
}

export type PrimaryShowRendererProps = { model: ModelDef; id: string | number; allModels: ModelDef[]; viewName?: string };
export const PrimaryShowContext = React.createContext<React.ComponentType<PrimaryShowRendererProps> | null>(null);

export interface BulkActionDef {
    key: string;
    label: string;
    icon?: React.ReactNode;
    /** Called once per selected record during bulk execution. */
    onExecuteOne: (record: any) => Promise<void>;
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
    attribute_or_relation_type: "attribute" | "relation" | "nlsentence";
    nl_sentence_eid?: number | null;
    nl_sentence_title?: string | null;
    name: string;
    visibility_condition?: VisibilityCondition | null;
    read_only_in_edit?: boolean;
}

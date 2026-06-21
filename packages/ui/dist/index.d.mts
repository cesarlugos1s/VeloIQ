import * as React$1 from 'react';
import React__default, { PropsWithChildren } from 'react';
import { ListProps, ShowProps } from '@refinedev/antd';
import * as _refinedev_core from '@refinedev/core';
import { AuthProvider, AccessControlProvider } from '@refinedev/core';
import * as axios from 'axios';
import * as react_jsx_runtime from 'react/jsx-runtime';
import * as _tanstack_query_core from '@tanstack/query-core';
import * as antd from 'antd';

/** One entry in navigation.config.json — one per module or model. */
interface NavConfigEntry {
    /** Refine resource key: "module:tasks", "task", "dashboard" */
    key: string;
    /** Human-readable display label */
    label: string;
    /** Ant Design icon component name, e.g. "UserOutlined" */
    icon: string;
    /** Display order — lower numbers appear first; ties keep original registration order */
    sequence: number;
    /** "module" for a top-level group, "model" for a leaf resource */
    type: "module" | "model";
}
type NavConfig = NavConfigEntry[];
/** Guess an Ant Design icon name from a resource name or label. */
declare function guessIcon(text: string, isModule?: boolean): string;
/** Resolve an icon name string to a React element using the AntD icon registry. */
declare function resolveIcon(iconName: string): React__default.ReactNode;
/** Find a NavConfigEntry by exact resource key. */
declare function getNavEntry(navConfig: NavConfig, key: string): NavConfigEntry | undefined;
/**
 * Sort items by the `sequence` values in navConfig.
 * Items without a matching entry sort to the end (sequence = 999).
 * Original array order serves as a stable tiebreaker.
 */
declare function sortItemsByNavConfig<T extends {
    key?: string;
    name?: string;
}>(items: T[], navConfig: NavConfig): T[];

interface LayoutWrapperProps {
    children?: React__default.ReactNode;
    /** Logo element or image URL shown in header and sider. */
    logo?: React__default.ReactNode | string;
    /** App name shown next to the logo when the sider is expanded. */
    appTitle?: string;
    /** Optional extra items added to the user dropdown (before logout). */
    extraUserMenuItems?: Array<{
        key: string;
        label: React__default.ReactNode;
        icon?: React__default.ReactNode;
        onClick?: () => void;
    }>;
    /** Navigation config loaded from navigation.config.json — drives icons and sort order. */
    navConfig?: NavConfig;
}
declare const LayoutWrapper: React__default.FC<LayoutWrapperProps>;

interface CommandCenterPortalProps {
    open: boolean;
    onClose: () => void;
    navConfig?: NavConfig;
}
declare const CommandCenterPortal: React__default.FC<CommandCenterPortalProps>;

declare const MultiPaneLayout: React__default.FC<{
    children: React__default.ReactNode;
}>;

declare const StandardShow: React__default.FC<ShowProps>;
declare const StandardList: React__default.FC<ListProps>;

interface HierarchyViewProps {
    resource: string;
    recordId: number;
    fallback?: React__default.ReactNode;
}
declare const HierarchyView: React__default.FC<HierarchyViewProps>;

declare const GlobalSearch: React__default.FC;

declare const CustomSider: React__default.FC<{
    collapsed?: boolean;
    logo?: React__default.ReactNode | string;
    appTitle?: string;
    navConfig?: NavConfig;
}>;

declare const HorizontalMenu: React__default.FC<{
    navConfig?: NavConfig;
}>;

type ExecutableHtmlProps = {
    html?: string;
    htmlChunks?: string[];
    resetToken?: string;
    style?: React__default.CSSProperties;
    mode?: "inline" | "iframe";
    minHeight?: number;
    title?: string;
    inheritTypography?: boolean;
    inheritTabRowBackground?: boolean;
    fontSizeOverride?: string;
};
declare const ExecutableHtml: React__default.FC<ExecutableHtmlProps>;

/**
 * Renders Plotly HTML inline (no iframe) by:
 * 1. Stripping Plotly CDN <script> tags (Plotly.js is loaded globally once)
 * 2. Making card button IDs unique per instance to avoid DOM ID conflicts
 * 3. Injecting the remaining HTML via dangerouslySetInnerHTML
 * 4. Executing any inline <script> tags after render
 */
declare const InlinePlotlyHtml: React__default.FC<{
    html: string;
    style?: React__default.CSSProperties;
}>;

interface VisibilityCondition {
    field: string;
    operator: "eq" | "ne" | "in" | "not_in" | "truthy" | "falsy" | "gt" | "lt" | "gte" | "lte" | "ilike";
    value?: any;
}
interface FieldDef {
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "date" | "datetime" | "time" | "image_url";
    isPk?: boolean;
    required?: boolean;
    reference?: string;
    referencePath?: string;
    optionLabel?: string;
    options?: {
        label: string;
        value: any;
    }[];
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
type RelationViewType = "table" | "editable-table" | "crosstab" | "editable-crosstab" | "editable-list" | "list" | "csv" | "read-and-edit-list" | "read-and-edit-csv" | "editable-csv" | "gallery" | "calendar" | "primary" | "totals-details" | "tree" | "tree-details";
interface MillerLeafConfig {
    relationPath: string;
    targetKey: string;
    otherKey: string;
    resource: string;
    resourcePath?: string;
}
interface RelationDef {
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
    showTab?: string;
    editTab?: string;
    description?: string;
    millerLeafResource?: string;
    millerLeafResourcePath?: string;
    millerLeafRelationPath?: string;
    millerLeafTargetKey?: string;
    millerLeafOtherKey?: string;
    millerLeafConfigs?: MillerLeafConfig[];
}
interface ModelDef {
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
    defaultSort?: {
        field: string;
        order: "asc" | "desc";
    };
}
type PrimaryShowRendererProps = {
    model: ModelDef;
    id: string | number;
    allModels: ModelDef[];
    viewName?: string;
};
declare const PrimaryShowContext: React__default.Context<React__default.ComponentType<PrimaryShowRendererProps> | null>;
interface BulkActionDef {
    key: string;
    label: string;
    icon?: React__default.ReactNode;
    /** Called once per selected record during bulk execution. */
    onExecuteOne: (record: any) => Promise<void>;
}
interface ViewConfigRow {
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

declare const useMetadataModal: (model: ModelDef, allModels?: ModelDef[]) => {
    metadataButton: react_jsx_runtime.JSX.Element;
    metadataModal: react_jsx_runtime.JSX.Element;
};

declare const useShowEditableForm: (resource: string, id?: string | number) => {
    formProps: antd.FormProps<{}>;
    saveButtonProps: antd.ButtonProps & {
        onClick: () => void;
    };
    queryResult: _tanstack_query_core.QueryObserverResult<_refinedev_core.GetOneResponse<_refinedev_core.BaseRecord>, _refinedev_core.HttpError>;
    record: _refinedev_core.BaseRecord | undefined;
    recordId: any;
};

declare const buildShowTabFormOptions: (formProps: any, model: ModelDef | undefined, allModels?: ModelDef[]) => {
    formProps: any;
    effectiveFields: FieldDef[];
};

declare const ShowFooterButtons: React__default.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    recordId: any;
    saveButtonProps: any;
}>;

declare const ModelHeading: React__default.FC<{
    model: Pick<ModelDef, "name" | "label" | "resource"> & {
        module?: string;
    };
    title: React__default.ReactNode;
    actionLabel?: string;
}>;

declare const useShowActionsPreferences: (model: ModelDef, allModels?: ModelDef[], record?: any, saveButtonProps?: any, configureLayoutButtonRef?: {
    current: React__default.ReactNode;
}, saveLayoutRef?: {
    current: () => void;
}) => {
    actionsState: {
        showActions: boolean;
        showCreate: boolean;
    };
    headerButtons: ({ defaultButtons }: {
        defaultButtons: React__default.ReactNode;
    }) => react_jsx_runtime.JSX.Element;
};

declare const ReferenceField: React__default.FC<{
    id: string | number;
    resource: string;
    onLabel?: (label: string) => void;
}>;

declare const DynamicShow: React__default.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    idOverride?: string;
    embedded?: boolean;
    beforeTabs?: React__default.ReactNode;
}>;

interface JourneyCallbacks$1 {
    onSave: (record: any) => void;
    onCancel: () => void;
}
declare const DynamicCreate: React__default.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    journeyCallbacks?: JourneyCallbacks$1;
    injectedValues?: Record<string, any>;
}>;

interface JourneyCallbacks {
    onSave: (record: any) => void;
    onCancel: () => void;
}
declare const DynamicEdit: React__default.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    topContent?: React__default.ReactNode;
    extraHeaderButtons?: React__default.ReactNode;
    journeyCallbacks?: JourneyCallbacks;
    idOverride?: string;
}>;

declare const useStandardShowTabs: (model: ModelDef | undefined, record: any, allModels: ModelDef[], actionsState?: {
    showActions: boolean;
    showCreate: boolean;
}, editForm?: {
    formProps?: any;
    effectiveFields?: FieldDef[];
}, overrideConfigRows?: ViewConfigRow[]) => {
    tabs: {
        key: string;
        label: React__default.ReactNode;
        children: React__default.ReactNode;
    }[];
    layoutConfig: {
        isConfiguring: boolean;
        enterConfigMode: () => void;
        saveLayout: () => void;
        cancelLayout: () => void;
        hasConfig: boolean;
    };
};

declare const renderRelationBlock: ({ rel, relationModel, relatedModel, record, mode, parentResource, allModels, showLabel, showActions, showCreate, relationViewTypeDefaults, labelStyle, valueStyle, fieldLayoutStyle, }: {
    rel: RelationDef;
    relationModel: ModelDef;
    relatedModel?: ModelDef;
    record: any;
    mode: "show" | "edit";
    parentResource: string;
    allModels?: ModelDef[];
    showLabel?: boolean;
    showActions?: boolean;
    showCreate?: boolean;
    relationViewTypeDefaults?: {
        show: RelationViewType;
        edit: RelationViewType;
    };
    labelStyle?: React__default.CSSProperties;
    valueStyle?: React__default.CSSProperties;
    fieldLayoutStyle?: React__default.CSSProperties;
}) => react_jsx_runtime.JSX.Element;

declare const DynamicList: React__default.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    filter?: any;
    relationConfig?: RelationDef;
    isEmbedded?: boolean;
    showActions?: boolean;
    showCreate?: boolean;
    layoutPreferenceType?: "ShowLayout" | "EditLayout";
    listViewType?: "table" | "gallery" | "calendar" | "totals-details" | "crosstab" | "editable-crosstab";
    rowSelection?: any;
    extraHeaderButtons?: React__default.ReactNode;
    bulkActions?: BulkActionDef[];
    preferencesResourceOverride?: string;
    defaultListVisible?: boolean;
}>;

/**
 * Refine AuthProvider implementation for VeloIQ.
 *
 * Uses JWT Bearer tokens stored in localStorage.  The backend issues
 * tokens via ``POST /auth/login`` and validates them on every
 * request through its auth middleware.
 */

declare const authProvider: AuthProvider;

/**
 * Refine AccessControlProvider for VeloIQ.
 *
 * Three-layer permission model (mirrors the backend):
 *   Layer 1 — Role global permissions (fetched from /auth/roles on login,
 *              stored as jm_role_permissions in localStorage).
 *   Layer 2 — Model-level exceptions (fetched from /auth/resource-permissions
 *              on login, stored as jm_resource_permissions).
 *   Layer 3 — Field-level exceptions (readRoles/writeRoles emitted by the
 *              schema generator into FieldDef; handled by CanAccess wrappers).
 *
 * Falls back to built-in Admin/Manager/Viewer defaults when the cached
 * permissions are absent (e.g. on first load before a login).
 */

declare const accessControlProvider: AccessControlProvider;

/**
 * Axios HTTP client with automatic Bearer token injection.
 *
 * Passed to the ``@refinedev/simple-rest`` data provider so that every
 * API request includes the JWT from localStorage.
 */
declare const httpClient: axios.AxiosInstance;

declare const API_URL = "/api";

declare const AllModelsProvider: React__default.FC<{
    models: ModelDef[];
    children: React__default.ReactNode;
}>;
declare const useAllModels: () => ModelDef[];

declare const ColorModeContext: React$1.Context<{
    mode: "light" | "dark";
    setMode: (mode: "light" | "dark") => void;
    /** Increments every time the color schema (plain-color / color-coded / hex)
     *  changes via setColorSchemas().  Components that depend on derived tones
     *  use this to re-render when the schema updates. */
    schemaVersion: number;
}>;

declare const ColorModeContextProvider: React.FC<PropsWithChildren>;

interface PaneNavigationValue {
    isInMultiPane: boolean;
    paneIndex: number;
    openDetail: (resource: string, id: string | number) => void;
}
declare const PaneNavigationContext: React$1.Context<PaneNavigationValue | null>;
declare const usePaneNavigation: () => PaneNavigationValue | null;

interface ResourceContextValue {
    allResources: any[];
    allSystemModels: any[];
}
declare const ResourceContext: React$1.Context<ResourceContextValue>;

/**
 * Makes the app's navigation.config.json available to any component rendered
 * inside LayoutWrapper (including extension-contributed routes). This is the
 * authoritative list of modules ("module:{name}" entries) and their labels.
 */
declare const NavConfigContext: React$1.Context<NavConfig>;
declare const useNavConfig: () => NavConfig;
/** Convenience: module entries from the nav config as {value, label} options. */
declare function useNavModules(): {
    value: string;
    label: string;
}[];

interface LoginPageProps {
    /** App title shown on the login card. Defaults to "VeloIQ". */
    appTitle?: string;
    /** Logo element or image URL shown above the title. */
    logo?: React__default.ReactNode | string;
}
declare const LoginPage: React__default.FC<LoginPageProps>;

declare const DashboardPage: React__default.FC;

type CellSourceType = "model" | "named_query" | "field" | "relation" | "custom";
interface DashboardCell {
    id: string;
    model: string;
    source_type: CellSourceType;
    row: number;
    col: number;
    view_type: string | null;
    html_style: string;
    min_width: string | null;
    max_width: string | null;
    min_height: string | null;
    max_height: string | null;
    section_name?: string;
    section_id?: string;
}
interface DashboardTab {
    id: string;
    name: string;
    module?: string;
    cells: DashboardCell[];
}
interface DashboardConfig {
    tabs: DashboardTab[];
}

interface Props$1 {
    config: DashboardConfig;
    allModels: ModelDef[];
    onConfigChange: (next: DashboardConfig) => void;
}
declare const ViewsGrid: React__default.FC<Props$1>;

interface Props {
    cells: DashboardCell[];
    config: DashboardConfig;
    tabId: string;
    renderContent: (cell: DashboardCell) => React__default.ReactNode;
    onConfigChange: (next: DashboardConfig) => void;
    isConfiguring?: boolean;
}
declare const SectionsGrid: React__default.FC<Props>;

declare const RecentActivityPanel: React__default.FC;

declare const PinnedRecordsPanel: React__default.FC;

interface RecentRecord {
    id: string | number;
    _label: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
interface RecentActivityGroup {
    model_name: string;
    resource: string;
    records: RecentRecord[];
}
interface RecentActivityData {
    groups: RecentActivityGroup[];
    days: number;
}

type ShortcutDef = {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    handler: () => void;
    /** Set to false to allow default browser behavior. Defaults to true. */
    preventDefault?: boolean;
    /** If true, the shortcut will NOT fire when a modal is open. Defaults to true for Escape. */
    skipWhenModalOpen?: boolean;
};
declare function useKeyboardShortcuts(shortcuts: ShortcutDef[]): void;

interface RecordResult {
    id: number | string;
    label: string;
}
interface ModelSearchResult {
    modelName: string;
    modelLabel: string;
    resource: string;
    records: RecordResult[];
}
interface UseRecordSearchReturn {
    results: ModelSearchResult[];
    searching: boolean;
    search: (query: string) => void;
    clear: () => void;
}
declare function useRecordSearch(): UseRecordSearchReturn;

interface ResourceDef {
    name: string;
    list: string;
    create: string;
    edit: string;
    show: string;
    meta: {
        canDelete: boolean;
        label: string;
        hide?: boolean;
        parent?: string;
        icon?: React.ReactNode;
    };
}
/**
 * Convert a module's ModelDef array into Refine resource definitions.
 * Pass the module name to group models under a shared parent resource.
 * Always prepends a parent group entry so Refine renders a clean module
 * label (not the raw "module:X" string).
 */
declare function generateResources(models: ModelDef[], moduleName: string, options?: {
    icon?: React.ReactNode;
    hideRelations?: boolean;
    moduleLabel?: string;
}): ResourceDef[];

/**
 * Drop-in replacement for ``fetch()`` that injects the JWT Bearer token
 * from localStorage into the ``Authorization`` header.
 *
 * Existing custom_show / custom_edit pages that use raw ``fetch()`` can
 * switch to this wrapper so requests are authenticated.
 */
declare const authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;

declare function useAuthenticatedFileUrl(rawUrl: string): string;
declare const AuthenticatedImage: React__default.FC<{
    url: string;
    alt?: string;
    style?: React__default.CSSProperties;
}>;

type ModelTone = {
    solid: string;
    soft: string;
    softer: string;
    text: string;
    border: string;
    shadow: string;
};
declare const setColorSchemas: (schemas: {
    modulesColorSchema?: string;
    modelsColorSchema?: string;
    plainColorBaseHex?: string;
}) => void;
declare const normalizeToneKey: (value?: string) => string;
declare const getModelTone: (modelLike?: string | {
    resource?: string;
    name?: string;
    label?: string;
}, darkMode?: boolean) => ModelTone;

declare const authSystemModels: ModelDef[];

export { API_URL, AllModelsProvider, AuthenticatedImage, type BulkActionDef, type CellSourceType, ColorModeContext, ColorModeContextProvider, CommandCenterPortal, type CommandCenterPortalProps, CustomSider, type DashboardCell, type DashboardConfig, DashboardPage, type DashboardTab, DynamicCreate, DynamicEdit, DynamicList, DynamicShow, ExecutableHtml, type FieldDef, GlobalSearch, HierarchyView, HorizontalMenu, InlinePlotlyHtml, LayoutWrapper, type LayoutWrapperProps, LoginPage, type LoginPageProps, type MillerLeafConfig, type ModelDef, ModelHeading, type ModelSearchResult, MultiPaneLayout, type NavConfig, NavConfigContext, type NavConfigEntry, PaneNavigationContext, PinnedRecordsPanel, PrimaryShowContext, type PrimaryShowRendererProps, type RecentActivityData, type RecentActivityGroup, RecentActivityPanel, type RecentRecord, type RecordResult, ReferenceField, type RelationDef, ResourceContext, type ResourceDef, SectionsGrid, ShowFooterButtons, StandardList, StandardShow, type UseRecordSearchReturn, type ViewConfigRow, ViewsGrid, accessControlProvider, authProvider, authSystemModels, authenticatedFetch, buildShowTabFormOptions, generateResources, getModelTone, getNavEntry, guessIcon, httpClient, normalizeToneKey, renderRelationBlock, resolveIcon, setColorSchemas, sortItemsByNavConfig, useAllModels, useAuthenticatedFileUrl, useKeyboardShortcuts, useMetadataModal, useNavConfig, useNavModules, usePaneNavigation, useRecordSearch, useShowActionsPreferences, useShowEditableForm, useStandardShowTabs };

// ── Core components ────────────────────────────────────────────────────────
export { LayoutWrapper } from "./components/LayoutWrapper";
export type { LayoutWrapperProps } from "./components/LayoutWrapper";

export { MultiPaneLayout } from "./components/MultiPane";
export { StandardShow, StandardList } from "./components/StandardCrud";
export { HierarchyView } from "./components/HierarchyView";
export { GlobalSearch } from "./components/GlobalSearch";
export { CustomSider } from "./components/CustomSider";
export { HorizontalMenu } from "./components/HorizontalMenu";
export { ExecutableHtml } from "./components/ExecutableHtml";
export { InlinePlotlyHtml } from "./components/InlinePlotlyHtml";

// ── DynamicResource ────────────────────────────────────────────────────────
export {
    DynamicList,
    DynamicShow,
    DynamicCreate,
    DynamicEdit,
    PrimaryShowContext,
    ModelHeading,
    ShowFooterButtons,
    ReferenceField,
    renderRelationBlock,
    useMetadataModal,
    useShowEditableForm,
    useShowActionsPreferences,
    useStandardShowTabs,
    buildShowTabFormOptions,
} from "./components/DynamicResource";

export type {
    FieldDef,
    RelationDef,
    ModelDef,
    PrimaryShowRendererProps,
    ViewConfigRow,
    BulkActionDef,
    MillerLeafConfig,
} from "./components/DynamicResource";

// ── Providers ──────────────────────────────────────────────────────────────
export { authProvider } from "./providers/authProvider";
export { accessControlProvider } from "./providers/accessControlProvider";
export { httpClient } from "./providers/httpClient";
export { API_URL } from "./providers/constants";

// ── Contexts ───────────────────────────────────────────────────────────────
export { AllModelsProvider, useAllModels } from "./contexts/AllModelsContext";
export { ColorModeContext } from "./contexts/ColorModeContext";
export { ColorModeContextProvider } from "./contexts/color-mode";
export { PaneNavigationContext, usePaneNavigation } from "./contexts/PaneNavigationContext";
export { ResourceContext } from "./contexts/ResourceContext";

// ── Pages ──────────────────────────────────────────────────────────────────
export { LoginPage } from "./pages/auth/LoginPage";
export type { LoginPageProps } from "./pages/auth/LoginPage";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// ── Utilities ──────────────────────────────────────────────────────────────
export { generateResources } from "./utils/generateResources";
export type { ResourceDef } from "./utils/generateResources";
export { authenticatedFetch } from "./utils/authenticatedFetch";
export { getModelTone, normalizeToneKey, setColorSchemas } from "./utils/modelTone";

// ── Auth models ────────────────────────────────────────────────────────────
export { authSystemModels } from "./models/authModels";

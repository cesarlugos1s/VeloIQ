// ── Core components ────────────────────────────────────────────────────────
export { LayoutWrapper } from "./components/LayoutWrapper";
export type { LayoutWrapperProps } from "./components/LayoutWrapper";
export { LicenseGate } from "./components/LicenseGate";
export { CommandCenterPortal } from "./components/CommandCenterPortal";
export type { CommandCenterPortalProps } from "./components/CommandCenterPortal";

export { MultiPaneLayout } from "./components/MultiPane";
export { StandardShow, StandardList } from "./components/StandardCrud";
export { HierarchyView } from "./components/HierarchyView";
export { GlobalSearch } from "./components/GlobalSearch";
export { HelpButton } from "./components/Help/HelpButton";
export { HelpDrawer } from "./components/Help/HelpDrawer";
export type { HelpDrawerProps } from "./components/Help/HelpDrawer";
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
    useStandardEditTabs,
    buildShowTabFormOptions,
    useDataDetailLevel,
    DataDetailSlider,
    SampleRowsTable,
} from "./components/DynamicResource";

export type {
    FieldDef,
    RelationDef,
    ModelDef,
    PrimaryShowRendererProps,
    ViewConfigRow,
    BulkActionDef,
    MillerLeafConfig,
    DataDetailLevelState,
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
export { NavConfigContext, useNavConfig, useNavModules } from "./contexts/NavConfigContext";
export { HelpContext, useSetHelpPageKey } from "./contexts/HelpContext";
export type { HelpContextValue } from "./contexts/HelpContext";

// ── Pages ──────────────────────────────────────────────────────────────────
export { LoginPage } from "./pages/auth/LoginPage";
export type { LoginPageProps } from "./pages/auth/LoginPage";
export { DashboardPage } from "./pages/dashboard/DashboardPage";
export { LandingRedirect } from "./pages/dashboard/LandingRedirect";
export { ViewsGrid } from "./pages/dashboard/ViewsGrid";
export { SectionsGrid } from "./pages/dashboard/SectionsGrid";
export { RecentActivityPanel } from "./pages/dashboard/RecentActivityPanel";
export { PinnedRecordsPanel } from "./pages/dashboard/PinnedRecordsPanel";
export type { DashboardConfig, DashboardTab, DashboardCell, CellSourceType } from "./pages/dashboard/hooks/useDashboardConfig";
export type { RecentActivityData, RecentActivityGroup, RecentRecord } from "./pages/dashboard/hooks/useRecentActivity";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
export { useRecordSearch } from "./hooks/useRecordSearch";
export type { RecordResult, ModelSearchResult, UseRecordSearchReturn } from "./hooks/useRecordSearch";
export { useLicensePool } from "./hooks/useLicensePool";
export type { LicensePool, LicenseWarning } from "./hooks/useLicensePool";

// ── Utilities ──────────────────────────────────────────────────────────────
export { generateResources } from "./utils/generateResources";
export type { ResourceDef } from "./utils/generateResources";
export { authenticatedFetch } from "./utils/authenticatedFetch";
export { useAuthenticatedFileUrl, AuthenticatedImage } from "./components/DynamicResource/utils/gallery";
export { getModelTone, normalizeToneKey, setColorSchemas } from "./utils/modelTone";
export { guessIcon, resolveIcon, getNavEntry, resolveNavKey, sortItemsByNavConfig, resolveFallbackLandingPath } from "./utils/navConfig";
export type { NavConfigEntry, NavConfig } from "./utils/navConfig";

// ── Auth models ────────────────────────────────────────────────────────────
export { authSystemModels } from "./models/authModels";

// ── Help models ────────────────────────────────────────────────────────────
export { helpSystemModels } from "./models/helpModels";

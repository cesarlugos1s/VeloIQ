import "./offlineMode";

// ── Core components ────────────────────────────────────────────────────────
export { LayoutWrapper } from "./components/LayoutWrapper";
export type { LayoutWrapperProps } from "./components/LayoutWrapper";
export { LicenseGate } from "./components/LicenseGate";
export { NoAccessResult, ResourceAccessGate } from "./components/AccessGate";
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
export { SingleItemCarousel, CarouselPositionBadge } from "./components/DynamicResource/utils/singleItemCarousel";
export type { SingleItemCarouselProps } from "./components/DynamicResource/utils/singleItemCarousel";

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
    RowActionDef,
    MillerLeafConfig,
    DataDetailLevelState,
} from "./components/DynamicResource";
export type { ModelExtraTab } from "./components/DynamicResource/types";
export { useBeforeEditSave } from "./components/DynamicResource/hooks/useBeforeEditSave";
export type { BeforeEditSave } from "./components/DynamicResource/hooks/useBeforeEditSave";

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
export type { SectionsGridHandle } from "./pages/dashboard/SectionsGrid";
export { RecentActivityPanel } from "./pages/dashboard/RecentActivityPanel";
export { PinnedRecordsPanel } from "./pages/dashboard/PinnedRecordsPanel";
export type { DashboardConfig, DashboardTab, DashboardCell, CellSourceType } from "./pages/dashboard/hooks/useDashboardConfig";
export type { RecentActivityData, RecentActivityGroup, RecentRecord } from "./pages/dashboard/hooks/useRecentActivity";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
export { useRecordSearch } from "./hooks/useRecordSearch";
export type { RecordResult, ModelSearchResult, UseRecordSearchReturn } from "./hooks/useRecordSearch";
export { useLicensePool } from "./hooks/useLicensePool";
// Shared access decision (licensing + role methods + access policies + @model_access).
export { useAccess, filterMenuItemsByAccess, useAccessQueryInvalidation } from "./hooks/useAccess";
export type { UseAccessReturn } from "./hooks/useAccess";
export {
    evaluateAccess,
    isModuleLicensedIn,
    isModuleWriteAllowedIn,
    moduleKeyForName,
    ACCESS_ACTIONS,
    REFINE_TO_ACTION,
} from "./access/evaluateAccess";
export type {
    AccessAction,
    AccessContext,
    AccessDecision,
    AccessPolicy,
    AccessPolicyEntry,
} from "./access/evaluateAccess";
export { refreshAccess, getAccessSnapshot, clearAccess } from "./access/accessStore";
export type { EffectivePermissions } from "./access/accessStore";
export { useBottomOverlayInset, BOTTOM_OVERLAY_ATTR } from "./hooks/useBottomOverlayInset";

// ── Collapsible model-based banners (also at "@juicemantics/veloiq-ui/banner") ──
export * from "./banner";
export { AppBannerHost, pageContextFromPath } from "./components/AppBannerHost";
export type { AppBannerHostProps } from "./components/AppBannerHost";
export type { LicensePool, LicenseWarning } from "./hooks/useLicensePool";

// ── Utilities ──────────────────────────────────────────────────────────────
export { generateResources } from "./utils/generateResources";
export type { ResourceDef } from "./utils/generateResources";
export { authenticatedFetch } from "./utils/authenticatedFetch";
// Row actions of a resource wherever it is listed.
export { registerResourceRowActions } from "./components/DynamicResource/registerResourceRowActions";
// Pages and Refine resources of the non-model data resources (wired once in App.tsx).
export { NonModelDataResourcePages, NON_MODEL_DATA_RESOURCE_ROUTE_PARAMETER } from "./components/DynamicResource/pages/NonModelDataResourcePages";
export type { ShowHeaderButtonsForResource } from "./components/DynamicResource/pages/NonModelDataResourcePages";
export { useRefineResourcesIncludingNonModelData } from "./hooks/useRefineResourcesIncludingNonModelData";
export { useRefineResourcesIncludingNavigationPages } from "./hooks/useRefineResourcesIncludingNavigationPages";
export { useFrameworkUiFeatures, resetFrameworkUiFeatures, FrameworkUiFeaturesOverride } from "./hooks/useFrameworkUiFeatures";
export type { FrameworkUiFeatures } from "./hooks/useFrameworkUiFeatures";
export { useLayoutMenuItems } from "./hooks/useLayoutMenuItems";
// External portals: the site shell, its public settings and the per-site sign-in session.
export { VeloIQPortalApp } from "./portal/VeloIQPortalApp";
export type { VeloIQPortalAppProps, PortalModuleRegistration, PortalPageRoute, PortalPageOverrides } from "./portal/VeloIQPortalApp";
export { usePortalPublicSettings } from "./portal/usePortalPublicSettings";
export type { PortalPublicSettings, PortalRuntimeConfiguration } from "./portal/usePortalPublicSettings";
export { setSignInStorageNamespace, signInStorageKeys, readAccessToken, siteScopedStorageKey } from "./utils/signInStorageKeys";
export { setPortalRequestContext, portalSiteOfRequests, signedOutVisitorsAllowed, PORTAL_REQUEST_HEADER } from "./utils/portalRequestContext";
// Rows that exist only in the page, served to the standard views from a browser store.
export { useInPageRowsStore } from "./hooks/useInPageRowsStore";
export type { InPageRowsStoreHandle } from "./hooks/useInPageRowsStore";
export { IN_PAGE_ROWS_RESOURCE_PREFIX, createInPageRowsStore, removeInPageRowsStore } from "./utils/serveInPageRowsStores";
export type { InPageRowsStore } from "./utils/serveInPageRowsStores";
export { getActiveLocale } from "./utils/activeLocale";
export { useAuthenticatedFileUrl, AuthenticatedImage } from "./components/DynamicResource/utils/gallery";
export { getModelTone, normalizeToneKey, setColorSchemas } from "./utils/modelTone";
export { guessIcon, resolveIcon, getNavEntry, resolveNavKey, sortItemsByNavConfig, resolveFallbackLandingPath } from "./utils/navConfig";
export type { NavConfigEntry, NavConfig } from "./utils/navConfig";

// ── Auth models ────────────────────────────────────────────────────────────
export { authSystemModels } from "./models/authModels";

// ── Help models ────────────────────────────────────────────────────────────
export { helpSystemModels } from "./models/helpModels";
export { mergeUiModelSchemas } from "./models/mergeUiModelSchemas";
export type { FieldOverride, RelationOverride, ModelOverride } from "./models/mergeUiModelSchemas";

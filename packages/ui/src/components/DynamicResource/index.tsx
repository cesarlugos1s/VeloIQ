import React, { useEffect, useMemo, useState, useCallback, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import { usePaneNavigation } from "../../contexts/PaneNavigationContext";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { useShow, useOne, useGo, useApiUrl, useWarnAboutChange, useInvalidate, useCan } from "@refinedev/core";
import {
    List,
    Edit,
    Create,
    Show,
    useTable,
    useForm,
    DeleteButton,
    ListButton,
    EditButton,
    useSelect
} from "@refinedev/antd";
import { StandardShow, StandardList } from "../StandardCrud";
import { ExecutableHtml } from "../ExecutableHtml";
import {
    Table,
    Form,
    Input,
    DatePicker,
    Checkbox,
    InputNumber,
    Space,
    Tabs,
    Typography,
    Skeleton,
    Card,
    Select,
    Alert,
    Button,
    Tooltip,
    Popover,
    Collapse,
    Tree,
    Spin,
    theme,
    Modal,
    Empty,
    Tag,
    Switch,
    Pagination,
    Upload,
    Menu,
    message
} from "antd";
import { EyeOutlined, SearchOutlined, PlusOutlined, EditOutlined, BugOutlined, DownOutlined, ShareAltOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, CloseOutlined, BarChartOutlined, DownloadOutlined, FilePdfOutlined, UnorderedListOutlined, FilterOutlined, ColumnHeightOutlined, SwapOutlined, SaveOutlined, SettingOutlined, DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined, InfoCircleOutlined, UploadOutlined, LinkOutlined } from "@ant-design/icons";
import { useSearchParams, useNavigate, useParams, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { HierarchyView } from "../HierarchyView";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { getContrastingTextColor, getModelTone, setColorSchemas, useModelTone, type ModelTone } from "../../utils/modelTone";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const { Title } = Typography;
import { renderWrappedPageTitle, wrappedPageTitleStyle, formatNumberValue, formatDateValue, formatDateTimeValue, formatTimeValue, escapeHtml, parseInlineStyle } from "./utils/formatting";

import {
    asDisplayText,
    translateText,
    getModuleLabel,
    getFieldLabel,
    getRelationLabel,
    getModelLabel,
    applyI18nLabelsToModel,
    applyI18nLabelsToModels,
    translateRelationKey,
} from "./utils/i18n";

import {
    normalizeFilterRules,
    normalizeColumnSortPreference,
    normalizeSorterPayload,
    resolveNextColumnSort,
    getSortPriority,
} from "./utils/sorting";
import type {
    ColumnSortOrder,
    ColumnSortState,
    ColumnSortIntent,
    TotalsSummaryFn,
} from "./utils/sorting";
import {
    IMAGE_EXTENSIONS,
    isImageRecord,
    recordHasData,
    getGalleryItemId,
    getGalleryItemLabel,
    getGalleryItemContentUrl,
    renderSharedGalleryCard,
} from "./utils/gallery";
import {
    openPdfWindow,
    buildStatsHtml,
    buildStatsSummary,
    renderStatBar,
    renderNumericValueBar,
} from "./utils/statistics";
import {
    INLINE_RELATION_MAX_ITEMS,
    GALLERY_RELATION_MAX_ITEMS,
    POLYMORPHIC_RELATION_MAX_ROWS,
    filterIdsByPolymorphicType,
    fetchPolymorphicGroups,
} from "./utils/polymorphic";
import {
    INLINE_DEFAULT_PAGE_SIZE,
    INLINE_PAGE_SIZE_OPTIONS,
    useRelatedInlineItems,
    useRelatedGalleryRecords,
} from "./relations/hooks";
import { RelatedObjectPreview } from "./relations/RelatedObjectPreview";
import { RelatedObjectPrimaryCard } from "./relations/RelatedObjectPrimaryCard";
import { RelatedObjectsPrimaryView } from "./relations/RelatedObjectsPrimaryView";
import { RelatedObjectsInlineValues } from "./relations/RelatedObjectsInlineValues";
import { RelatedObjectsGallery } from "./relations/RelatedObjectsGallery";
import { RelatedObjectsCalendar } from "./relations/RelatedObjectsCalendar";
import { RelatedObjectsEditableList } from "./relations/RelatedObjectsEditableList";
import { RelationsExplorer } from "./relations/RelationsExplorer";
import {
    DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    DEFAULT_EDIT_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
    getRelationViewType,
    getRelationTabName,
    getTabDisplayLabel,
} from "./relations/helpers";
import { AnalysisChart } from "./analysis/AnalysisChart";
import { CrosstabTable } from "./analysis/CrosstabTable";
import { PolymorphicRelatedObjectsTable, RelatedObjectsTable } from "./relations/RelatedObjectsTable";
import { MetadataModal } from "./MetadataModal";
import { useMetadataModal } from "./hooks/useMetadataModal";
import { useShowEditableForm } from "./hooks/useShowEditableForm";
import { buildShowTabFormOptions } from "./hooks/buildShowTabFormOptions";
import { ShowFooterButtons } from "./ShowFooterButtons";
export { useMetadataModal, useShowEditableForm, buildShowTabFormOptions, ShowFooterButtons };
import { ModelHeading, renderModelHeading } from "./ModelHeading";
export { ModelHeading };
import { useShowActionsPreferences } from "./hooks/useShowActionsPreferences";
export { useShowActionsPreferences };

import type { FieldDef, RelationDef, ModelDef, PrimaryShowRendererProps, ViewConfigRow, BulkActionDef, MillerLeafConfig, AppendedListDef } from "./types";
import { PrimaryShowContext } from "./types";
export type { FieldDef, RelationDef, ModelDef, PrimaryShowRendererProps, ViewConfigRow, BulkActionDef, MillerLeafConfig, AppendedListDef };
export { PrimaryShowContext };
import {
    DETAILS_TAB_NAME,
    getDefaultViewName,
    normalizeViewName,
    splitRelations,
    useViewConfigurations,
    useViewSettings,
    filterConfigRowsForMode,
    groupConfigRowsBySection,
    normalizeSectionRows,
    resolveFieldFromConfig,
    buildRelationNameVariants,
    findRelationContextForModel,
    applyRelationFieldOverrides,
    resolveRelationFromConfig,
    buildConfiguredRelationKeys,
    relationMatchesConfigured,
    getRelationIdentityKeys,
    buildConfiguredResolvedRelationKeys,
    normalizeLooseRelationKey,
    buildConfiguredRelationDisplayKeys,
    isRelationConfiguredForDetails,
    getConfigVid,
    isAttributeValueEditable,
    normalizeRelationViewType,
    applyRelationViewOverride,
    normalizeFieldViewType,
} from "./utils/viewConfig";
import type { ViewSettings, NormalizedViewConfigRow } from "./utils/viewConfig";
import { ActionsButtonStack, VerticalActionsLayout } from "./utils/verticalActionsBar";
import { buildColumnFilterOptions, matchesColumnFilterValue } from "./utils/columnFilters";
import { RelationSelect } from "./fields/RelationSelect";
import { ReferenceField } from "./fields/ReferenceField";
import { FileUploadInput } from "./fields/FileUploadInput";
import { renderInput } from "./fields/renderInput";
import { renderFieldValue } from "./fields/renderFieldValue";
export { ReferenceField };

import type { RelationViewType } from "./types";
import { isInlineRelationViewType, usesTableRelationBehavior } from "./relations/helpers";



import {
    ToneSharedStyles,
    toneScopeStyle,
    renderToneTabLabel,
    isDarkColor,
    getFieldValueColors,
    getFallbackColor,
    renderOptionTag,
} from "./utils/colors";





import {
    getListViewFields,
    hasReferenceModel,
    normalizeModelKey,
    resolveModelByEntityType,
    matchesPolymorphicType,
    isFileModel,
    findModelByName,
    resolveResourcePath,
    resolveModelName,
    getPolymorphicReferenceInfo,
    getRecordDisplayLabel,
    isPkField,
    isReferenceField,
    getNavigableRelations,
    getRecordId,
    type NavigableRelation,
} from "./utils/model";





import {
    CALENDAR_WEEKDAYS,
    isCalendarDateField,
    getCalendarDateFieldOptions,
    getCalendarRecordDate,
} from "./utils/calendar";

import { extractButtonLabel, renderIconOnlyButtons } from "./utils/buttons";

import { getShowHref, shouldHandleLinkClick } from "./utils/navigation";
import { useRoleFilteredModel } from "./utils/roleAccess";




export const DynamicList: React.FC<{
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
    extraHeaderButtons?: React.ReactNode;
    bulkActions?: BulkActionDef[];
    preferencesResourceOverride?: string;
    defaultListVisible?: boolean;
}> = ({ model: modelProp, allModels, filter, relationConfig, isEmbedded = false, showActions = true, showCreate = true, layoutPreferenceType, listViewType, rowSelection, extraHeaderButtons, bulkActions, preferencesResourceOverride, defaultListVisible }) => {
    const model = useRoleFilteredModel(modelProp);
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const navigate = useNavigate();
    const location = useLocation();
    const go = useGo();
    const paneNav = usePaneNavigation();
    const invalidate = useInvalidate();
    const apiUrl = useApiUrl();
    // Stable resource identifier used by useTable, useCan, etc.
    const resourceIdentifier = resolveResourcePath(model.resource || model.name, allModels);
    // Separate key used exclusively for preferences load/save, allowing dashboard cells
    // to maintain independent preferences from the standalone list page.
    const prefsKey = preferencesResourceOverride ?? resourceIdentifier;
    const { data: canDeleteData } = useCan({ resource: resourceIdentifier, action: "delete" });
    const { data: canEditData } = useCan({ resource: resourceIdentifier, action: "edit" });
    const canBulkDelete = canDeleteData?.can !== false;
    const canBulkEdit = canEditData?.can !== false;
    const { settings: viewSettings } = useViewSettings();
    const actionsPosition = viewSettings?.generalActionsButtonPosition || "top-right";
    const [actionsBarEl, setActionsBarEl] = useState<HTMLDivElement | null>(null);
    const resolvedLayoutPreferenceType = layoutPreferenceType ?? "ShowLayout";

    // --- Select mode: activated when navigated here with ?select_mode=1&relate_* params ---
    const [searchParams] = useSearchParams();
    const selectMode = searchParams.get("select_mode") === "1";
    const selectModeFk = searchParams.get("select_mode_fk") === "1";
    const selectModeRelateResource = searchParams.get("relate_resource");
    const selectModeRelateTargetKey = searchParams.get("relate_target_key");
    const selectModeRelateOtherKey = searchParams.get("relate_other_key");
    const selectModeRelateTargetId = searchParams.get("relate_target_id");
    const selectModeReturnTo = searchParams.get("returnTo");

    // --- Pre-filter from URL params (?field__in=id1,id2) for navigate-to-related ---
    const urlPreFilters = useMemo(() => {
        const preFilters: Array<{ field: string; operator: "eq"; value: any }> = [];
        for (const [key, value] of searchParams.entries()) {
            if (key.endsWith("__in")) {
                const field = key.slice(0, -4);  // strip __in suffix
                const values = String(value).split(",").map((v) => v.trim()).filter(Boolean);
                if (values.length > 0) {
                    // Use the full key (field__in) as the field name with eq operator
                    // so the backend receives ?field__in=1,2,3 which is handled by _build_where_clauses
                    preFilters.push({
                        field: key,     // e.g. "project_id__in"
                        operator: "eq" as const,
                        value: values.join(","),
                    });
                }
            }
        }
        return preFilters;
    }, [searchParams]);

    // Keyboard shortcuts: Ctrl+N to create new record
    useKeyboardShortcuts(useMemo(() => isEmbedded ? [] : [
        { key: "n", ctrl: true, handler: () => go({ to: { resource: model.resource || model.name, action: "create" } }) },
    ], [model.name, model.resource, go, isEmbedded]));
    const { token } = theme.useToken();
    const modelTone = useModelTone(model);
    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const statsLabelStyle: React.CSSProperties = {
        background: valueBackground,
        borderRadius: 4,
        padding: "2px 6px",
        display: "inline-block",
    };
    const statsHeaderStyle: React.CSSProperties = {
        background: valueBackground,
    };
    const statsTitleStyle: React.CSSProperties = {
        color: modelTone.solid,
        margin: 0,
    };
    const searchField = model.fields.find(f => f.type === 'string' && !f.key.includes('_id') && !f.key.includes('eid'))
        || model.fields.find(f => f.type === 'string')
        || model.fields[0];

    const isFileModel = (model.resource || model.name).toLowerCase() === "file";
    const modelDefaultListViewType = String(model.listViewType || "").toLowerCase();
    const defaultListViewType = String(modelDefaultListViewType || viewSettings?.listViewType || "table").toLowerCase();
    const fileListViewType = String(viewSettings?.fileListViewType || "").toLowerCase();
    const resolvedListViewType = String(
        listViewType || (isFileModel && fileListViewType ? fileListViewType : defaultListViewType) || "table"
    ).toLowerCase();
    const isGalleryView = resolvedListViewType === "gallery";
    const isCalendarView = resolvedListViewType === "calendar";
    const isTotalsDetailsView = resolvedListViewType === "totals-details" || resolvedListViewType === "totalsdetails";
    const isCrosstabView = resolvedListViewType === "crosstab" || resolvedListViewType === "editable-crosstab" || resolvedListViewType === "editablecrosstab";
    const editableCrosstab = resolvedListViewType === "editable-crosstab" || resolvedListViewType === "editablecrosstab";
    const galleryImageWidth = viewSettings?.galleryImageWidth ?? 180;
    const galleryImageHeight = viewSettings?.galleryImageHeight ?? 140;
    const calendarDateFieldOptions = useMemo(() => getCalendarDateFieldOptions(model.fields), [model.fields]);

    const [localSearch, setLocalSearch] = useState("");
    const [listVisible, setListVisible] = useState(defaultListVisible ?? true);
    const [isTdFlipped, setIsTdFlipped] = useState(false);
    const [pageSize, setPageSize] = useState(10);
    const [galleryPage, setGalleryPage] = useState(1);
    const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
    const [calendarDateField, setCalendarDateField] = useState<string>(() => calendarDateFieldOptions[0]?.key || "");
    const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => dayjs().startOf("month"));
    const [isAnalyzeVertical, setIsAnalyzeVertical] = useState(false);
    const [isAnalyzeFirst, setIsAnalyzeFirst] = useState(false);
    const [filterRules, setFilterRules] = useState<Array<{
        id: string;
        fieldKey?: string;
        operator?: string;
        value?: any;
        value2?: any;
    }>>([]);
    const [filtersCollapsed, setFiltersCollapsed] = useState(isEmbedded);
    const [layoutPrefsReady, setLayoutPrefsReady] = useState(false);
    const [columnsSelectorOpen, setColumnsSelectorOpen] = useState(false);
    const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[] | null>(null);
    const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
    const [columnFiltersSelected, setColumnFiltersSelected] = useState<Record<string, string[]>>({});
    const [columnSort, setColumnSort] = useState<ColumnSortState[]>(
        model.defaultSort
            ? [{ fieldKey: model.defaultSort.field, order: (model.defaultSort.order === "desc" ? "descend" : "ascend") as ColumnSortOrder }]
            : []
    );
    const [totalsSummaryFunctions, setTotalsSummaryFunctions] = useState<Record<string, TotalsSummaryFn>>({});
    const [currentViewName, setCurrentViewName] = useState<string>(getDefaultViewName());
    const [selectedViewNames, setSelectedViewNames] = useState<string[]>([]);
    const [availableViewNames, setAvailableViewNames] = useState<string[]>([]);
    const [viewNamesLoaded, setViewNamesLoaded] = useState(false);
    const [isLoadingViewNames, setIsLoadingViewNames] = useState(false);
    const [saveViewModalOpen, setSaveViewModalOpen] = useState(false);
    const [saveViewName, setSaveViewName] = useState<string>(getDefaultViewName());
    const [saveViewAsNew, setSaveViewAsNew] = useState(false);
    const [pendingSaveTarget, setPendingSaveTarget] = useState<"layout" | "analyze" | null>(null);
    const [renameViewModalOpen, setRenameViewModalOpen] = useState(false);
    const [renameViewName, setRenameViewName] = useState<string>("");
    const [labelCache, setLabelCache] = useState<Record<string, string>>({});
    const [analyzeOpen, setAnalyzeOpen] = useState(isEmbedded);
    const analyzeTouchedRef = useRef(false);
    const analyzePrefsTouchedRef = useRef(false);
    const analyzePrefsLoadedRef = useRef(false);
    const [analyzePrefsReady, setAnalyzePrefsReady] = useState(false);
    const analyzePrefsResourceRef = useRef<string | null>(null);
    const { metadataButton, metadataModal } = useMetadataModal(model, allModels);

    const defaultDisplayFields = useMemo(() => getListViewFields(model, filter?.field), [model, filter?.field]);
    const orderedColumnKeys = useMemo(() => {
        if (!selectedColumnKeys || selectedColumnKeys.length === 0) return null;
        const order = columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys;
        const selectedSet = new Set(selectedColumnKeys);
        const availableKeys = new Set(model.fields.map((field) => field.key));
        return order.filter((key) => selectedSet.has(key) && availableKeys.has(key));
    }, [columnOrder, model.fields, selectedColumnKeys]);
    const displayFields = useMemo(() => {
        if (!orderedColumnKeys) return defaultDisplayFields;
        const fieldMap = new Map(model.fields.map((field) => [field.key, field]));
        return orderedColumnKeys
            .map((key) => fieldMap.get(key))
            .filter((field): field is FieldDef => Boolean(field));
    }, [defaultDisplayFields, model.fields, orderedColumnKeys]);
    const useLocalSearch = true;
    const [categoryField1, setCategoryField1] = useState<string | null>(null);
    const [categoryField2, setCategoryField2] = useState<string | null | undefined>(undefined);
    // Excel-style filter dropdowns shown above the crosstab body (crosstab/editable-crosstab views).
    const [crosstabFilterFields, setCrosstabFilterFields] = useState<string[]>([]);
    // Live staged edits for editable-crosstab cells (recordId -> fieldKey -> value).
    const [crosstabStaged, setCrosstabStaged] = useState<Record<string, Record<string, number>>>({});
    const [crosstabSaving, setCrosstabSaving] = useState(false);
    const [chartType, setChartType] = useState<"bar" | "line" | "area" | "stacked" | "pie" | "donut" | "bar-horizontal" | "stacked-horizontal" | "area-horizontal" | "scatter" | "bubble" | "histogram" | "box" | "boxplot" | "waterfall" | "heatmap" | "crosstab" | "radar" | "combo" | "3d">("area");
    const [summaryFn, setSummaryFn] = useState<"sum" | "avg" | "count" | "max" | "min" | "stddev">("sum");
    const [selectedSeriesKeys, setSelectedSeriesKeys] = useState<string[] | null>(null);
    const [rankingMode, setRankingMode] = useState<"none" | "top" | "bottom">("none");
    const [rankingFieldKey, setRankingFieldKey] = useState<string | null>(null);
    const [rankingN, setRankingN] = useState<number>(10);
    const [exportRequested, setExportRequested] = useState(false);
    const [isStatsFlipped, setIsStatsFlipped] = useState(false);
    const [isSavingAnalyzePrefs, setIsSavingAnalyzePrefs] = useState(false);
    const chartSvgRef = useRef<SVGSVGElement | null>(null);
    const [chartAnimationKey, setChartAnimationKey] = useState(0);
    const [chartAnimationStage, setChartAnimationStage] = useState<"enter" | "update">("enter");
    const skipNextAnimationRef = useRef(false);
    const [isSavingLayoutPrefs, setIsSavingLayoutPrefs] = useState(false);
    const layoutPrefsTouchedRef = useRef(false);
    const layoutPrefsLoadedRef = useRef(false);
    const layoutPrefsResourceRef = useRef<string | null>(null);
    const sortIntentRef = useRef<ColumnSortIntent>(null);
    // Tracks the view name from the last time the reset+reload effect ran.
    // Null on the very first mount (before viewNamesLoaded is true), so we can
    // distinguish "initial load" (no reset needed — prefs are still in-flight)
    // from "user switched views" (reset needed before loading new view's prefs).
    const prevViewNameForResetRef = useRef<string | null>(null);

    // --- Bulk selection state ---
    const [bulkSelectedRowKeys, setBulkSelectedRowKeys] = useState<React.Key[]>([]);
    const bulkSelectedRowsMapRef = useRef<Map<React.Key, any>>(new Map());

    // --- Select mode: associate-existing handler (needs bulkSelectedRowKeys) ---
    const [selectModeAssociating, setSelectModeAssociating] = useState(false);
    const handleAssociateSelected = useCallback(async () => {
        if (!selectModeRelateResource || !selectModeRelateTargetKey || !selectModeRelateTargetId) return;
        if (!selectModeFk && !selectModeRelateOtherKey) return;
        setSelectModeAssociating(true);
        try {
            for (const rowKey of bulkSelectedRowKeys) {
                if (selectModeFk) {
                    await authenticatedFetch(`${apiUrl}/${selectModeRelateResource}/${rowKey}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            [selectModeRelateTargetKey]: selectModeRelateTargetId,
                        }),
                    });
                } else {
                    await authenticatedFetch(`${apiUrl}/${selectModeRelateResource}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            [selectModeRelateTargetKey]: selectModeRelateTargetId,
                            [selectModeRelateOtherKey!]: rowKey,
                        }),
                    });
                }
            }
            message.success(_("Relations added."));
            if (selectModeReturnTo && selectModeReturnTo.startsWith("/")) {
                navigate(selectModeReturnTo);
            }
        } catch {
            message.error(_("Failed to add relations."));
        } finally {
            setSelectModeAssociating(false);
        }
    }, [apiUrl, bulkSelectedRowKeys, selectModeFk, selectModeRelateResource, selectModeRelateTargetKey, selectModeRelateOtherKey, selectModeRelateTargetId, selectModeReturnTo, navigate]);
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkActionsToApply, setBulkActionsToApply] = useState<string[]>([]);
    const [bulkChangeFieldKey, setBulkChangeFieldKey] = useState<string | null>(null);
    const [navigateToRelation, setNavigateToRelation] = useState<NavigableRelation | null>(null);
    const [bulkChangeFieldValue, setBulkChangeFieldValue] = useState<any>(null);
    const [isBulkExecuting, setIsBulkExecuting] = useState(false);
    const [selectAllFilteredPending, setSelectAllFilteredPending] = useState(false);

    // --- Row right-click context menu state ---
    const [rowContextMenuVisible, setRowContextMenuVisible] = useState(false);
    const [rowContextMenuPosition, setRowContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [rowContextMenuRecord, setRowContextMenuRecord] = useState<any>(null);
    const [rowContextMenuIsMulti, setRowContextMenuIsMulti] = useState(false);

    // --- Appended related lists (stacked below the current list) ---
    const [appendedLists, setAppendedLists] = useState<AppendedListDef[]>([]);
    const [appendRelationRecord, setAppendRelationRecord] = useState<NavigableRelation | null>(null);
    // Becomes true the first time the user opens any column-filter dropdown, which triggers
    // fetchAllRows so the dropdown shows distinct values from ALL rows, not just the current page.
    const [columnFilterDropdownEverOpened, setColumnFilterDropdownEverOpened] = useState(false);

    const handleReferenceLabel = useCallback((resource: string, id: string | number, label: string) => {
        const key = `${resource}:${id}`;
        setLabelCache((prev) => (prev[key] === label ? prev : { ...prev, [key]: label }));
    }, []);

    const tableFilters = useMemo(() => {
        const result = [...urlPreFilters];
        if (filter && filter.value !== undefined && filter.value !== null) {
            result.push(filter);
        }
        return result;
    }, [filter?.field, filter?.operator, filter?.value, urlPreFilters]);

    const { tableProps, searchFormProps, filters: activeFilters, setFilters } = useTable({
        resource: resourceIdentifier,
        syncWithLocation: !isEmbedded,
        pagination: { pageSize, hideOnSinglePage: true, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] } as any,
        filters: { initial: tableFilters, permanent: tableFilters },
        onSearch: (values: any) => {
            if (!searchField) return [];
            if (!values?.q) return [];
            let value: any = values.q;
            if (searchField.type === "number") {
                const parsed = Number(values.q);
                if (!Number.isNaN(parsed)) value = parsed;
            } else if (searchField.type === "boolean") {
                const normalized = String(values.q).toLowerCase();
                if (["true", "1", "t", "yes", "y"].includes(normalized)) value = true;
                if (["false", "0", "f", "no", "n"].includes(normalized)) value = false;
            }
            return [{ field: searchField.key, operator: "contains", value }];
        },
    });

    const [allRowsData, setAllRowsData] = useState<any[]>([]);
    const [isAllRowsLoading, setIsAllRowsLoading] = useState(false);
    const [allRowsError, setAllRowsError] = useState<string | null>(null);
    const lastAllRowsSignature = useRef<string>("");
    const [allRowsLoaded, setAllRowsLoaded] = useState(false);

    const isRelationView = !!(filter);
    const hasActiveFilterRules = useMemo(() => {
        return filterRules.some((rule) => rule.fieldKey && rule.operator && (rule.value !== undefined && rule.value !== null && rule.value !== ""));
    }, [filterRules]);

    const getFieldValueForFilter = useCallback((field: FieldDef, record: any) => {
        const raw = record?.[field.key];
        if (raw === undefined || raw === null) return raw;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || raw;
        }
        if (field.options) {
            return field.options.find((option) => option && option.value === raw)?.label || raw;
        }
        return raw;
    }, [labelCache]);

    const getSortValue = useCallback((field: FieldDef, record: any) => {
        const raw = record?.[field.key];
        if (raw === undefined || raw === null) return null;
        if (isPkField(field, model) && record?._label) return record._label;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] ?? raw;
        }
        if (field.options) {
            return field.options.find((option) => option && option.value === raw)?.label ?? raw;
        }
        if (field.type === "date" || field.type === "datetime") {
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? raw : parsed.getTime();
        }
        if (field.type === "time") {
            // Sort time-only strings ("HH:MM:SS") lexicographically — ISO time strings sort correctly as strings.
            return String(raw);
        }
        if (field.type === "number") return Number(raw);
        if (field.type === "boolean") return raw ? 1 : 0;
        return raw;
    }, [labelCache]);

    const compareSortValues = useCallback((field: FieldDef, a: any, b: any) => {
        const aVal = getSortValue(field, a);
        const bVal = getSortValue(field, b);
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
        return String(aVal).localeCompare(String(bVal));
    }, [getSortValue]);

    const resolveRelativeDate = useCallback((value: any, asRange: boolean) => {
        const count = Number(value?.count ?? 1);
        const direction = value?.direction || "next";
        const unit = value?.unit || "weeks";
        const isQuarter = unit === "quarters";
        const base = dayjs();
        if (asRange || direction === "current") {
            const anchor = direction === "current"
                ? base
                : direction === "previous"
                    ? (isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit))
                    : (isQuarter ? base.add(count * 3, "month") : base.add(count, unit));
            if (isQuarter) {
                const quarterStartMonth = Math.floor(anchor.month() / 3) * 3;
                const start = anchor.month(quarterStartMonth).startOf("month");
                const end = start.add(2, "month").endOf("month");
                return { start, end };
            }
            return {
                start: anchor.startOf(unit as dayjs.ManipulateType),
                end: anchor.endOf(unit as dayjs.ManipulateType),
            };
        }
        const target = direction === "previous"
            ? (isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit))
            : (isQuarter ? base.add(count * 3, "month") : base.add(count, unit));
        if (isQuarter) {
            const quarterStartMonth = Math.floor(target.month() / 3) * 3;
            return { date: target.month(quarterStartMonth).startOf("month") };
        }
        return { date: target.startOf(unit as dayjs.ManipulateType) };
    }, []);

    const matchesRule = useCallback((record: any, rule: any) => {
        const field = model.fields.find((f) => f.key === rule.fieldKey);
        if (!field || !rule.operator) return true;
        const rawValue = getFieldValueForFilter(field, record);
        if (rawValue === undefined || rawValue === null) return false;

        if (field.type === "string") {
            const value = String(rawValue).toLowerCase();
            const target = String(rule.value ?? "").toLowerCase();
            if (!target) return true;
            if (rule.operator === "contains") return value.includes(target);
            if (rule.operator === "equals") return value === target;
            return true;
        }

        if (field.type === "number") {
            const num = Number(rawValue);
            const target = Number(rule.value);
            const target2 = Number(rule.value2);
            if (Number.isNaN(num)) return false;
            switch (rule.operator) {
                case "eq": return !Number.isNaN(target) && num === target;
                case "gt": return !Number.isNaN(target) && num > target;
                case "gte": return !Number.isNaN(target) && num >= target;
                case "lt": return !Number.isNaN(target) && num < target;
                case "lte": return !Number.isNaN(target) && num <= target;
                case "between": return !Number.isNaN(target) && !Number.isNaN(target2) && num >= target && num <= target2;
                default: return true;
            }
        }

        if (field.type === "boolean") {
            if (rule.operator === "is") return Boolean(rawValue) === Boolean(rule.value);
            return true;
        }

        if (field.type === "date" || field.type === "datetime") {
            const recordDate = dayjs(rawValue);
            if (!recordDate.isValid()) return false;
            const mode = rule.value?.mode || "absolute";
            const mode2 = rule.value2?.mode || "absolute";
            const getDateValue = (val: any, asRange: boolean) => {
                if (val?.mode === "relative") {
                    return resolveRelativeDate(val, asRange);
                }
                const date = dayjs(val?.date || val);
                return asRange ? { start: date.startOf("day"), end: date.endOf("day") } : { date: date.startOf("day") };
            };
            switch (rule.operator) {
                case "on": {
                    const range = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
                    const time = recordDate.valueOf();
                    return time >= range.start!.valueOf() && time <= range.end!.valueOf();
                }
                case "after": {
                    const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
                    if (!dateVal || !dayjs(dateVal).isValid()) return false;
                    return recordDate.valueOf() > dayjs(dateVal).endOf("day").valueOf();
                }
                case "before": {
                    const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
                    if (!dateVal || !dayjs(dateVal).isValid()) return false;
                    return recordDate.valueOf() < dayjs(dateVal).startOf("day").valueOf();
                }
                case "between": {
                    const startRange = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
                    const endRange = mode2 === "relative" ? resolveRelativeDate(rule.value2, true) : getDateValue(rule.value2, true);
                    if (!startRange.start || !endRange.end) return false;
                    const time = recordDate.valueOf();
                    return time >= startRange.start.valueOf() && time <= endRange.end.valueOf();
                }
                default:
                    return true;
            }
        }
        return true;
    }, [getFieldValueForFilter, model.fields, resolveRelativeDate]);

    const applyGlobalSearch = useCallback((rows: any[]) => {
        if (!useLocalSearch) return rows;
        const query = localSearch.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((record: any) => {
            const candidates = [
                record?._label,
                ...model.fields.flatMap((field) => {
                    const value = record?.[field.key];
                    if (field.reference && value !== undefined && value !== null) {
                        const key = `${field.reference}:${value}`;
                        const cachedLabel = labelCache[key];
                        return cachedLabel ? [cachedLabel, value] : [value];
                    }
                    return [value];
                }),
            ];
            return candidates.some((value) => value !== undefined && value !== null && String(value).toLowerCase().includes(query));
        });
    }, [labelCache, localSearch, model.fields, useLocalSearch]);

    const applyFilterRules = useCallback((rows: any[]) => {
        if (!hasActiveFilterRules) return rows;
        return rows.filter((record) => filterRules.every((rule) => matchesRule(record, rule)));
    }, [filterRules, hasActiveFilterRules, matchesRule]);

    const allRows = useMemo(() => {
        const data = allRowsData || [];
        if (!useLocalSearch) return data;
        const query = localSearch.trim().toLowerCase();
        if (!query) return data;
        return data.filter((record: any) => {
            const candidates = [
                record?._label,
                ...model.fields.flatMap((field) => {
                    const value = record?.[field.key];
                    if (field.reference && value !== undefined && value !== null) {
                        const key = `${field.reference}:${value}`;
                        const cachedLabel = labelCache[key];
                        return cachedLabel ? [cachedLabel, value] : [value];
                    }
                    return [value];
                }),
            ];
            return candidates.some((value) => value !== undefined && value !== null && String(value).toLowerCase().includes(query));
        });
    }, [allRowsData, useLocalSearch, localSearch, model.fields, labelCache]);

    const isClientFiltering = allRowsLoaded && !allRowsError;
    const filteredDataSource = useMemo(() => {
        if (!isClientFiltering) return Array.isArray(tableProps.dataSource) ? tableProps.dataSource : [];
        const baseRows = allRows || [];
        return applyFilterRules(applyGlobalSearch(baseRows));
    }, [allRows, applyFilterRules, applyGlobalSearch, isClientFiltering, tableProps.dataSource]);

    const columnFilteredDataSource = useMemo((): any[] => {
        const activeEntries = Object.entries(columnFiltersSelected).filter(([, values]) => values && values.length > 0);
        if (activeEntries.length === 0) return filteredDataSource as any[];
        return filteredDataSource.filter((record) =>
            activeEntries.every(([fieldKey, selectedValues]) => {
                const field = model.fields.find((f) => f.key === fieldKey);
                if (!field) return true;
                return selectedValues.some((value) => matchesColumnFilterValue(field, record, value));
            })
        );
    }, [filteredDataSource, columnFiltersSelected, model.fields]);

    useEffect(() => {
        setGalleryPage(1);
    }, [localSearch, filterRules, resolvedListViewType]);

    const columnFilters = useMemo(() => {
        // Prefer allRowsData (complete dataset) over the current page whenever it has been
        // fetched, regardless of whether client-side filtering is active. This ensures filter
        // dropdowns always show all distinct values, not just those on the visible page.
        const data = allRowsData.length > 0 ? allRowsData : (Array.isArray(tableProps.dataSource) ? tableProps.dataSource : []);
        const rangeCount = viewSettings?.maxDistinctColumnFilterValuesToRanges ?? 20;
        return buildColumnFilterOptions({ fields: displayFields, data, rangeCount });
    }, [allRowsData, displayFields, tableProps.dataSource, viewSettings]);

    const allFieldOptions = useMemo(() => {
        return model.fields.map((field) => ({ label: field.label, value: field.key }));
    }, [model.fields]);

    const orderedSelectedColumns = useMemo(() => {
        if (!selectedColumnKeys || selectedColumnKeys.length === 0) return [];
        return orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : selectedColumnKeys;
    }, [orderedColumnKeys, selectedColumnKeys]);

    const syncColumnsSelectionToDisplay = useCallback(() => {
        const keys = displayFields.map((field) => field.key);
        if (keys.length === 0) return;
        setSelectedColumnKeys(keys);
        setColumnOrder(orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : keys);
    }, [displayFields, orderedColumnKeys]);

    useEffect(() => {
        if (selectedColumnKeys !== null) return;
        const defaults = defaultDisplayFields.map((field) => field.key);
        if (defaults.length === 0) return;
        setSelectedColumnKeys(defaults);
        setColumnOrder(defaults);
    }, [defaultDisplayFields, selectedColumnKeys]);

    const markAnalyzePrefsTouched = useCallback(() => {
        analyzePrefsTouchedRef.current = true;
    }, []);

    const markLayoutPrefsTouched = useCallback(() => {
        layoutPrefsTouchedRef.current = true;
    }, []);

    const handleColumnSelectionChange = useCallback((values: string[]) => {
        markLayoutPrefsTouched();
        if (!values || values.length === 0) {
            setSelectedColumnKeys(null);
            setColumnOrder(null);
            return;
        }
        setSelectedColumnKeys(values);
        setColumnOrder((prev) => {
            const baseOrder = prev && prev.length > 0 ? prev.filter((key) => values.includes(key)) : [];
            const missing = values.filter((key) => !baseOrder.includes(key));
            return [...baseOrder, ...missing];
        });
    }, [markLayoutPrefsTouched]);

    const moveColumnOrder = useCallback((key: string, direction: "left" | "right") => {
        setColumnOrder((prev) => {
            const base = prev && prev.length > 0
                ? [...prev]
                : selectedColumnKeys
                    ? [...selectedColumnKeys]
                    : [];
            const index = base.indexOf(key);
            if (index === -1) return base;
            const swapIndex = direction === "left" ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= base.length) return base;
            [base[index], base[swapIndex]] = [base[swapIndex], base[index]];
            return base;
        });
    }, [selectedColumnKeys]);

    const handleTablePageChange = useCallback((page: number, newPageSize?: number) => {
        if (newPageSize && newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setGalleryPage(1);
        }
        const pagination = tableProps.pagination;
        if (typeof pagination === "object" && typeof pagination.onChange === "function") {
            pagination.onChange(page, newPageSize ?? pageSize);
        }
    }, [pageSize, tableProps.pagination]);

    const tablePagination = useMemo(() => {
        if (!isClientFiltering) {
            if (!tableProps.pagination || typeof tableProps.pagination !== "object") return tableProps.pagination;
            return {
                ...tableProps.pagination,
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                onChange: handleTablePageChange,
                onShowSizeChange: handleTablePageChange,
            };
        }
        return {
            pageSize,
            hideOnSinglePage: true,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: handleTablePageChange,
            onShowSizeChange: handleTablePageChange,
        };
    }, [handleTablePageChange, isClientFiltering, pageSize, tableProps.pagination]);

    const categoricalFields = useMemo(() => {
        return model.fields.filter((field) => isPkField(field, model) || (field.type !== "number" || field.reference));
    }, [model.fields]);

    const numericFields = useMemo(() => {
        return model.fields.filter((field) => !isPkField(field, model) && field.type === "number" && !field.reference);
    }, [model.fields]);

    const hasActiveRangeColumnFilter = useMemo(() => {
        return Object.values(columnFiltersSelected).some(
            (vals) => vals.some((v) => v.startsWith("__range__:"))
        );
    }, [columnFiltersSelected]);

    const shouldLoadAllRows = useMemo(() => {
        return Boolean(
            localSearch.trim().length > 0 ||
            hasActiveFilterRules ||
            analyzeOpen ||
            exportRequested ||
            isTotalsDetailsView ||
            isCrosstabView ||
            columnFilterDropdownEverOpened ||
            hasActiveRangeColumnFilter
        );
    }, [analyzeOpen, columnFilterDropdownEverOpened, exportRequested, hasActiveFilterRules, hasActiveRangeColumnFilter, isTotalsDetailsView, isCrosstabView, localSearch]);

    useEffect(() => {
        if (!categoryField1 && categoricalFields.length > 0) {
            setCategoryField1(categoricalFields[0].key);
        }
        if (categoryField2 === undefined && categoricalFields.length > 1) {
            setCategoryField2(categoricalFields[1].key);
        }
    }, [categoricalFields, categoryField1, categoryField2]);

    useEffect(() => {
        if (selectedSeriesKeys !== null) return;
        if (numericFields.length > 0) {
            setSelectedSeriesKeys(numericFields.map((field) => field.key));
        } else {
            setSelectedSeriesKeys(["__count__"]);
        }
    }, [numericFields, selectedSeriesKeys]);

    useEffect(() => {
        if (numericFields.length === 0) {
            if (rankingFieldKey !== null) setRankingFieldKey(null);
            if (rankingMode !== "none") setRankingMode("none");
            return;
        }
        if (!rankingFieldKey || !numericFields.some((field) => field.key === rankingFieldKey)) {
            setRankingFieldKey(numericFields[0].key);
        }
    }, [numericFields, rankingFieldKey, rankingMode]);

    const resetLayoutDefaults = useCallback(() => {
        setListVisible(defaultListVisible ?? true);
        setAnalyzeOpen(isEmbedded);
        setIsAnalyzeVertical(false);
        setIsAnalyzeFirst(false);
        setFiltersCollapsed(isEmbedded);
        setPageSize(10);
        setSelectedColumnKeys(null);
        setColumnOrder(null);
        setTotalsSummaryFunctions({});
    }, [isEmbedded, defaultListVisible]);

    // React to DataDetail slider level 6 (Analyze) — poll window variable
    // because Ant Design Tabs caches panel content and prevents normal re-renders.
    useEffect(() => {
        const interval = setInterval(() => {
            const lvl = (window as any).__veloiq_dataDetailLevel;
            console.log("[DynamicList poll] model:", model.name, "lvl:", lvl, "listVisible:", listVisible, "defaultListVisible:", defaultListVisible);
            if (lvl === 6) {
                console.log("[DynamicList poll] -> HIDING table");
                setListVisible(false);
            } else if (lvl !== 6 && !listVisible && defaultListVisible === undefined && !isTotalsDetailsView) {
                console.log("[DynamicList poll] -> SHOWING table");
                setListVisible(true);
            }
        }, 200);
        console.log("[DynamicList] polling started for", model.name);
        return () => { console.log("[DynamicList] polling stopped for", model.name); clearInterval(interval); };
    }, [listVisible, defaultListVisible]);

    const resetAnalyzeDefaults = useCallback(() => {
        setCategoryField1(categoricalFields[0]?.key ?? null);
        setCategoryField2(categoricalFields.length > 1 ? categoricalFields[1].key : null);
        setChartType("area");
        setSummaryFn("sum");
        setSelectedSeriesKeys(null);
        setRankingMode("none");
        setRankingFieldKey(numericFields[0]?.key ?? null);
        setRankingN(10);
        setCrosstabFilterFields([]);
    }, [categoricalFields, numericFields]);

    const persistCurrentViewNames = useCallback(async (nextSelected: string[], nextCurrent: string) => {
        try {
            const resourceKey = prefsKey;
            await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resource: resourceKey,
                    action: "set_current",
                    view_name: nextCurrent,
                    view_names: nextSelected,
                }),
            });
        } catch {
            // Ignore failures for non-critical updates.
        }
    }, [apiUrl, model.name, model.resource, allModels, preferencesResourceOverride]);

    const loadViewNames = useCallback(async () => {
        const resourceKey = prefsKey;
        setIsLoadingViewNames(true);
        try {
            const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=__all__`);
            if (!response.ok) {
                throw new Error(`Load failed (${response.status})`);
            }
            const data = await response.json();
            const prefs = data?.preferences;
            let viewNames: string[] = [];
            let nextCurrent = getDefaultViewName();
            let nextSelected: string[] = [];
            if (prefs && typeof prefs === "object") {
                if (prefs.views && typeof prefs.views === "object") {
                    viewNames = Object.keys(prefs.views || {});
                    const rawSelected = Array.isArray(prefs.current_view_names) ? prefs.current_view_names : [];
                    const normalizedSelected = rawSelected
                        .map((name: string) => normalizeViewName(name))
                        .filter((name: string) => viewNames.includes(name));
                    nextCurrent = normalizeViewName(prefs.current_view_name || normalizedSelected[0]);
                    nextSelected = normalizedSelected;
                }
            }
            if (viewNames.length === 0) {
                viewNames = [getDefaultViewName()];
            }
            if (!viewNames.includes(nextCurrent)) {
                nextCurrent = viewNames[0];
            }
            if (nextSelected.length === 0) {
                nextSelected = [nextCurrent];
            }
            setAvailableViewNames(viewNames);
            setCurrentViewName(nextCurrent);
            setSaveViewName(nextCurrent);
            setSelectedViewNames(nextSelected);
            setViewNamesLoaded(true);
        } catch {
            setAvailableViewNames([getDefaultViewName()]);
            setCurrentViewName(getDefaultViewName());
            setSelectedViewNames([getDefaultViewName()]);
        } finally {
            setViewNamesLoaded(true);
            setIsLoadingViewNames(false);
        }
    }, [apiUrl, model.name, model.resource, allModels, preferencesResourceOverride]);

    const openSaveViewModalFor = useCallback((target: "layout" | "analyze") => {
        setSaveViewName(currentViewName || getDefaultViewName());
        setSaveViewAsNew(false);
        setPendingSaveTarget(target);
        setSaveViewModalOpen(true);
    }, [currentViewName]);

    const handleChangeViewName = useCallback(async (nextView: string) => {
        const resolvedName = normalizeViewName(nextView);
        setCurrentViewName(resolvedName);
        setSaveViewName(resolvedName);
        const nextSelected = selectedViewNames.length > 0 ? selectedViewNames : [resolvedName];
        await persistCurrentViewNames(nextSelected, resolvedName);
    }, [persistCurrentViewNames, selectedViewNames]);

    const updateSelectedViewNames = useCallback(async (nextSelected: string[]) => {
        if (nextSelected.length === 0) {
            nextSelected = [getDefaultViewName()];
        }
        setSelectedViewNames(nextSelected);
        const nextCurrent = nextSelected.includes(currentViewName) ? currentViewName : nextSelected[0];
        if (nextCurrent !== currentViewName) {
            setCurrentViewName(nextCurrent);
            setSaveViewName(nextCurrent);
        }
        await persistCurrentViewNames(nextSelected, nextCurrent);
    }, [currentViewName, persistCurrentViewNames]);

    const moveSelectedView = useCallback((name: string, direction: "up" | "down") => {
        setSelectedViewNames((prev) => {
            const idx = prev.indexOf(name);
            if (idx < 0) return prev;
            const next = [...prev];
            const targetIndex = direction === "up" ? idx - 1 : idx + 1;
            if (targetIndex < 0 || targetIndex >= next.length) return prev;
            [next[idx], next[targetIndex]] = [next[targetIndex], next[idx]];
            persistCurrentViewNames(next, currentViewName);
            return next;
        });
    }, [currentViewName, persistCurrentViewNames]);

    const handleRenameView = useCallback(async () => {
        const newName = normalizeViewName(renameViewName);
        if (!newName || newName === currentViewName) {
            setRenameViewModalOpen(false);
            return;
        }
        if (availableViewNames.includes(newName)) {
            message.error(_("View name already exists."));
            return;
        }
        try {
            const resourceKey = prefsKey;
            const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: resourceKey, action: "rename", view_name: currentViewName, new_name: newName }),
            });
            if (!response.ok) {
                throw new Error(`Rename failed (${response.status})`);
            }
            message.success(_("View renamed."));
            setRenameViewModalOpen(false);
            await loadViewNames();
        } catch (error) {
            message.error(error instanceof Error ? error.message : _("Failed to rename view."));
        }
    }, [apiUrl, availableViewNames, currentViewName, model.name, model.resource, renameViewName, allModels, loadViewNames]);

    const confirmDeleteView = useCallback(() => {
        Modal.confirm({
            title: _(_("Delete view")),
            content: `Delete "${currentViewName}" and all its saved preferences?`,
            okText: _("Delete"),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const resourceKey = prefsKey;
                    const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ resource: resourceKey, action: "delete", view_name: currentViewName }),
                    });
                    if (!response.ok) {
                        throw new Error(`Delete failed (${response.status})`);
                    }
                    message.success(_("View deleted."));
                    await loadViewNames();
                } catch (error) {
                    message.error(error instanceof Error ? error.message : _("Failed to delete view."));
                }
            },
        });
    }, [apiUrl, currentViewName, model.name, model.resource, allModels, loadViewNames]);

    const persistLayoutPreferences = useCallback(async (viewName: string) => {
        if (!resolvedLayoutPreferenceType) return;
        const resourceKey = prefsKey;
        const resolvedViewName = normalizeViewName(viewName);
        const preferences = {
            listVisible,
            analyzeOpen,
            isAnalyzeVertical,
            isAnalyzeFirst,
            filtersCollapsed,
            filters: filterRules,
            rowsPerPage: pageSize,
            tableColumns: selectedColumnKeys && selectedColumnKeys.length > 0
                ? {
                    selectedKeys: selectedColumnKeys,
                    order: columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys,
                }
                : null,
            columnFilters: columnFiltersSelected,
            columnSort: columnSort.length > 0 ? columnSort : null,
            totalsSummaryFunctions,
            custom_view_name: resolvedViewName,
        };
        setIsSavingLayoutPrefs(true);
        try {
            const targetTypes = resolvedLayoutPreferenceType === "ShowLayout"
                ? ["ShowLayout", "EditLayout"]
                : resolvedLayoutPreferenceType === "EditLayout"
                    ? ["EditLayout", "ShowLayout"]
                    : [resolvedLayoutPreferenceType];
            const responses = await Promise.all(
                targetTypes.map((type) =>
                    authenticatedFetch(`${apiUrl}/views/preferences`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ resource: resourceKey, preferenceType: type, preferences }),
                    })
                )
            );
            const failed = responses.find((response) => !response.ok);
            if (failed) {
                throw new Error(`Save failed (${failed.status})`);
            }
            message.success(_("Layout preferences saved."));
        } catch (error) {
            message.error(error instanceof Error ? error.message : _("Failed to save layout preferences."));
        } finally {
            setIsSavingLayoutPrefs(false);
        }
    }, [apiUrl, analyzeOpen, columnFiltersSelected, columnOrder, columnSort, filtersCollapsed, filterRules, isAnalyzeFirst, isAnalyzeVertical, resolvedLayoutPreferenceType, listVisible, pageSize, selectedColumnKeys, totalsSummaryFunctions, model.name, model.resource, allModels, preferencesResourceOverride]);

    const persistAnalyzePreferences = useCallback(async (viewName: string) => {
        const resourceKey = prefsKey;
        const resolvedViewName = normalizeViewName(viewName);
        const preferences = {
            categoryField1,
            categoryField2: categoryField2 ?? null,
            chartType,
            summaryFn,
            selectedSeriesKeys: selectedSeriesKeys ?? [],
            rankingMode,
            rankingFieldKey,
            rankingN,
            crosstabFilterFields,
            custom_view_name: resolvedViewName,
        };
        setIsSavingAnalyzePrefs(true);
        try {
            const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: resourceKey, preferenceType: "Analyze", preferences }),
            });
            if (!response.ok) {
                throw new Error(`Save failed (${response.status})`);
            }
            message.success(_("Analyze preferences saved."));
        } catch (error) {
            message.error(error instanceof Error ? error.message : _("Failed to save analyze preferences."));
        } finally {
            setIsSavingAnalyzePrefs(false);
        }
    }, [apiUrl, categoryField1, categoryField2, chartType, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, crosstabFilterFields, model.name, model.resource, allModels, preferencesResourceOverride]);

    const handleConfirmSaveView = useCallback(async () => {
        if (!pendingSaveTarget) return;
        const viewName = normalizeViewName(saveViewName || currentViewName);
        const viewExists = availableViewNames.includes(viewName);
        if (saveViewAsNew && viewExists) {
            message.error(_("View name already exists. Choose a new name."));
            return;
        }
        if (!saveViewAsNew && viewName !== currentViewName && viewExists) {
            message.error(_("Choose a new name or enable \"Save as new view\"."));
            return;
        }
        setSaveViewModalOpen(false);
        setPendingSaveTarget(null);
        setSaveViewAsNew(false);
        if (pendingSaveTarget === "layout") {
            await persistLayoutPreferences(viewName);
        } else {
            await persistAnalyzePreferences(viewName);
        }
        setCurrentViewName(viewName);
        setSaveViewName(viewName);
        const nextSelected = selectedViewNames.includes(viewName) ? selectedViewNames : [...selectedViewNames, viewName];
        setSelectedViewNames(nextSelected);
        await persistCurrentViewNames(nextSelected, viewName);
        await loadViewNames();
    }, [availableViewNames, currentViewName, loadViewNames, pendingSaveTarget, persistAnalyzePreferences, persistCurrentViewNames, persistLayoutPreferences, saveViewAsNew, saveViewName, selectedViewNames]);

    useEffect(() => {
        loadViewNames();
    }, [loadViewNames]);

    useEffect(() => {
        if (!viewNamesLoaded) return;
        // Only reset to defaults when the user actually switches to a different view.
        // On the initial load (prevViewNameForResetRef is null), the prefs fetch
        // (effect below) is already in-flight; resetting here would create a race
        // where the reset fires after the fetch and wipes the loaded values.
        const viewChanged = prevViewNameForResetRef.current !== null && prevViewNameForResetRef.current !== currentViewName;
        prevViewNameForResetRef.current = currentViewName;
        analyzePrefsTouchedRef.current = false;
        layoutPrefsTouchedRef.current = false;
        analyzePrefsLoadedRef.current = false;
        layoutPrefsLoadedRef.current = false;
        setColumnsSelectorOpen(false);
        setSaveViewName(currentViewName);
        setSaveViewAsNew(false);
        if (viewChanged) {
            analyzeTouchedRef.current = false;
            resetLayoutDefaults();
            resetAnalyzeDefaults();
        }
    }, [currentViewName, resetAnalyzeDefaults, resetLayoutDefaults, viewNamesLoaded]);

    useEffect(() => {
        const resourceKey = prefsKey;
        const viewKey = `${resourceKey}::${currentViewName}`;
        if (analyzePrefsResourceRef.current !== viewKey) {
            analyzePrefsLoadedRef.current = false;
            setAnalyzePrefsReady(false);
            analyzePrefsResourceRef.current = viewKey;
        }
        if (analyzePrefsLoadedRef.current) return;
        let cancelled = false;
        const loadPreferences = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=Analyze&custom_view_name=${encodeURIComponent(currentViewName)}`);
                if (!response.ok) {
                    throw new Error(`Load failed (${response.status})`);
                }
                const data = await response.json();
                if (cancelled || analyzePrefsTouchedRef.current) return;
                const prefs = data?.preferences;
                if (!prefs || typeof prefs !== "object") {
                    analyzePrefsLoadedRef.current = true;
                    if (!cancelled) setAnalyzePrefsReady(true);
                    return;
                }
                if ("categoryField1" in prefs) setCategoryField1(prefs.categoryField1 ?? null);
                if ("categoryField2" in prefs) setCategoryField2(prefs.categoryField2 ?? null);
                if ("chartType" in prefs) setChartType(prefs.chartType);
                if ("summaryFn" in prefs) setSummaryFn(prefs.summaryFn);
                if ("selectedSeriesKeys" in prefs) {
                    setSelectedSeriesKeys(Array.isArray(prefs.selectedSeriesKeys) ? prefs.selectedSeriesKeys : []);
                }
                if ("rankingMode" in prefs && (prefs.rankingMode === "none" || prefs.rankingMode === "top" || prefs.rankingMode === "bottom")) {
                    setRankingMode(prefs.rankingMode);
                }
                if ("rankingFieldKey" in prefs) setRankingFieldKey(prefs.rankingFieldKey ?? null);
                if ("rankingN" in prefs) {
                    const nextRankingN = Number(prefs.rankingN);
                    setRankingN(Number.isFinite(nextRankingN) && nextRankingN > 0 ? Math.floor(nextRankingN) : 10);
                }
                if ("crosstabFilterFields" in prefs && Array.isArray(prefs.crosstabFilterFields)) {
                    setCrosstabFilterFields(prefs.crosstabFilterFields);
                }
                analyzePrefsLoadedRef.current = true;
                if (!cancelled) setAnalyzePrefsReady(true);
            } catch {
                // Silent failure on auto-load.
                if (!cancelled) setAnalyzePrefsReady(true);
            }
        };
        loadPreferences();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, currentViewName, model.name, model.resource, allModels, preferencesResourceOverride]);

    useEffect(() => {
        if (!resolvedLayoutPreferenceType) return;
        const resourceKey = prefsKey;
        const viewKey = `${resourceKey}::${resolvedLayoutPreferenceType}::${currentViewName}`;
        if (layoutPrefsResourceRef.current !== viewKey) {
            layoutPrefsLoadedRef.current = false;
            setLayoutPrefsReady(false);
            layoutPrefsResourceRef.current = viewKey;
        }
        if (layoutPrefsLoadedRef.current) { setLayoutPrefsReady(true); return; }
        let cancelled = false;
        const applyPrefs = (prefs: any) => {
            if (!prefs || typeof prefs !== "object") return false;
            if ("listVisible" in prefs && defaultListVisible !== false) setListVisible(Boolean(prefs.listVisible));
            if ("analyzeOpen" in prefs) setAnalyzeOpen(Boolean(prefs.analyzeOpen));
            if ("isAnalyzeVertical" in prefs) setIsAnalyzeVertical(Boolean(prefs.isAnalyzeVertical));
            if ("isAnalyzeFirst" in prefs) setIsAnalyzeFirst(Boolean(prefs.isAnalyzeFirst));
            if ("filtersCollapsed" in prefs) setFiltersCollapsed(Boolean(prefs.filtersCollapsed));
            if ("filters" in prefs && Array.isArray(prefs.filters)) {
                setFilterRules(normalizeFilterRules(prefs.filters));
            }
            if ("rowsPerPage" in prefs) {
                const nextPageSize = Number(prefs.rowsPerPage);
                if (Number.isFinite(nextPageSize) && nextPageSize > 0) {
                    setPageSize(nextPageSize);
                }
            }
            if ("tableColumns" in prefs && prefs.tableColumns) {
                const selectedKeys = Array.isArray(prefs.tableColumns.selectedKeys)
                    ? prefs.tableColumns.selectedKeys
                    : Array.isArray(prefs.tableColumns)
                        ? prefs.tableColumns
                        : null;
                const order = Array.isArray(prefs.tableColumns.order)
                    ? prefs.tableColumns.order
                    : Array.isArray(prefs.tableColumns)
                        ? prefs.tableColumns
                        : null;
                if (selectedKeys && selectedKeys.length > 0) {
                    setSelectedColumnKeys(selectedKeys);
                    setColumnOrder(order && order.length > 0 ? order : selectedKeys);
                }
            }
            if ("columnFilters" in prefs && prefs.columnFilters && typeof prefs.columnFilters === "object") {
                setColumnFiltersSelected(prefs.columnFilters);
            }
            if ("columnSort" in prefs && prefs.columnSort) {
                setColumnSort(normalizeColumnSortPreference(prefs.columnSort));
            }
            if ("totalsSummaryFunctions" in prefs && prefs.totalsSummaryFunctions && typeof prefs.totalsSummaryFunctions === "object") {
                setTotalsSummaryFunctions(prefs.totalsSummaryFunctions as Record<string, TotalsSummaryFn>);
            }
            return Object.keys(prefs).length > 0;
        };
        const loadPreferences = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=${resolvedLayoutPreferenceType}&custom_view_name=${encodeURIComponent(currentViewName)}`);
                if (!response.ok) {
                    throw new Error(`Load failed (${response.status})`);
                }
                const data = await response.json();
                if (cancelled || layoutPrefsTouchedRef.current) return;
                const prefs = data?.preferences;
                const applied = applyPrefs(prefs);
                if (!applied && resolvedLayoutPreferenceType === "EditLayout") {
                    const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (cancelled || layoutPrefsTouchedRef.current) return;
                        applyPrefs(fallbackData?.preferences);
                    }
                } else if (!applied && resolvedLayoutPreferenceType === "ShowLayout") {
                    const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (cancelled || layoutPrefsTouchedRef.current) return;
                        applyPrefs(fallbackData?.preferences);
                    }
                }
                layoutPrefsLoadedRef.current = true;
                setLayoutPrefsReady(true);
            } catch {
                // Silent failure on auto-load.
                setLayoutPrefsReady(true);
            }
        };
        loadPreferences();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, currentViewName, resolvedLayoutPreferenceType, model.name, model.resource, allModels, preferencesResourceOverride]);
    const fetchAllRows = useCallback(async () => {
        setIsAllRowsLoading(true);
        setAllRowsError(null);
        const filtersToApply = (activeFilters && activeFilters.length > 0) ? activeFilters : tableFilters;
        const pageSize = 500;
        let start = 0;
        let allRows: any[] = [];
        try {
            while (true) {
                const params = new URLSearchParams();
                params.set("_start", String(start));
                params.set("_end", String(start + pageSize));
                filtersToApply.forEach((filterItem: any) => {
                    if (!filterItem?.field || filterItem?.value === undefined || filterItem?.value === null) return;
                    const vals = Array.isArray(filterItem.value) ? filterItem.value : [filterItem.value];
                    if (vals.some((v: any) => String(v).startsWith("__range__:"))) return;
                    const op = filterItem.operator;
                    const suffix = op && op !== "eq" ? `_${op}` : "";
                    params.append(`${filterItem.field}${suffix}`, String(filterItem.value));
                });
                const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
                const response = await authenticatedFetch(`${apiUrl}/${resourcePath}?${params.toString()}`);
                const data = await response.json();
                if (!Array.isArray(data)) break;
                allRows = allRows.concat(data);
                if (data.length < pageSize) break;
                start += pageSize;
            }
            setAllRowsData(allRows);
        } catch (error) {
            setAllRowsError(error instanceof Error ? error.message : _("Failed to fetch all rows"));
        } finally {
            setIsAllRowsLoading(false);
            setAllRowsLoaded(true);
        }
    }, [activeFilters, apiUrl, model.name, model.resource, tableFilters, allModels]);

    useEffect(() => {
        if (!shouldLoadAllRows) return;
        const filtersToApply = (activeFilters && activeFilters.length > 0) ? activeFilters : tableFilters;
        const signature = JSON.stringify({
            resource: resolveResourcePath(model.resource || model.name, allModels),
            filters: (filtersToApply || []).map((filterItem: any) => ({
                field: filterItem?.field,
                operator: filterItem?.operator,
                value: filterItem?.value,
            })),
        });
        if (lastAllRowsSignature.current === signature && !exportRequested && !analyzeOpen && !shouldLoadAllRows) return;
        lastAllRowsSignature.current = signature;
        fetchAllRows();
    }, [activeFilters, analyzeOpen, exportRequested, fetchAllRows, model.name, shouldLoadAllRows, tableFilters]);

    useEffect(() => {
        if (!allRowsLoaded) return;
        if (analyzeTouchedRef.current) return;
        if (isTotalsDetailsView) return;
        if ((allRows?.length ?? 0) <= 1) {
            setAnalyzeOpen(false);
        } else {
            setAnalyzeOpen(true);
        }
    }, [allRows?.length, allRowsLoaded, isTotalsDetailsView]);

    useEffect(() => {
        if (!hasActiveFilterRules || isClientFiltering) return;
        const resolveServerDate = (val: any, forRange: boolean) => {
            if (val?.mode === "relative") {
                const resolved = resolveRelativeDate(val, forRange);
                if (forRange) return { start: resolved.start?.toISOString(), end: resolved.end?.toISOString() };
                return { date: resolved.date?.toISOString() };
            }
            const date = dayjs(val?.date || val);
            if (!date.isValid()) return {};
            if (forRange) return { start: date.startOf("day").toISOString(), end: date.endOf("day").toISOString() };
            return { date: date.startOf("day").toISOString() };
        };
        const serverFilters = filterRules
            .filter((rule) => rule.fieldKey && rule.operator && rule.value !== undefined && rule.value !== null && rule.value !== "")
            .flatMap((rule) => {
                const field = model.fields.find((f) => f.key === rule.fieldKey);
                if (!field) return [];
                const fieldKey = field.key;
                const op = rule.operator;
                if (field.type === "string") {
                    return [{
                        field: fieldKey,
                        operator: op === "contains" ? "contains" : "eq",
                        value: rule.value,
                    }];
                }
                if (field.type === "number") {
                    if (op === "between") {
                        return [
                            { field: fieldKey, operator: "gte", value: rule.value },
                            { field: fieldKey, operator: "lte", value: rule.value2 },
                        ];
                    }
                    return [{
                        field: fieldKey,
                        operator: op!,
                        value: rule.value,
                    }];
                }
                if (field.type === "boolean") {
                    return [{ field: fieldKey, operator: "eq", value: Boolean(rule.value) }];
                }
                if (field.type === "date" || field.type === "datetime") {
                    if (op === "between") {
                        const start = resolveServerDate(rule.value, true).start;
                        const end = resolveServerDate(rule.value2, true).end;
                        return [
                            { field: fieldKey, operator: "gte", value: start },
                            { field: fieldKey, operator: "lte", value: end },
                        ];
                    }
                    const operatorMap: Record<string, string> = { before: "lt", after: "gt", on: "eq" };
                    const dateVal = resolveServerDate(rule.value, false).date;
                    return [{
                        field: fieldKey,
                        operator: (op && operatorMap[op]) || "eq",
                        value: dateVal,
                    }];
                }
                return [];
            });
        const combined = [...tableFilters, ...serverFilters];
        setFilters(combined as any, "replace");
    }, [filterRules, hasActiveFilterRules, isClientFiltering, model.fields, setFilters, tableFilters]);

    const formatCategoryValue = useCallback((field: FieldDef | undefined, record: any) => {
        if (!field) return _("All");
        const raw = record?.[field.key];
        if (raw === undefined || raw === null) return "-";
        if (isPkField(field, model) && record?._label) return record._label;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            return field.options.find((option) => option && option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        if (field.type === "datetime") return formatDateTimeValue(raw) ?? String(raw);
        if (field.type === "time") return formatTimeValue(raw);
        return String(raw);
    }, [labelCache]);

    const chartData = useMemo(() => {
        const data = Array.isArray(columnFilteredDataSource) ? columnFilteredDataSource : [];
        const cat1Field = categoryField1 ? model.fields.find((field) => field.key === categoryField1) : undefined;
        const cat2Field = categoryField2 ? model.fields.find((field) => field.key === categoryField2) : undefined;
        const groupMap = new Map<string, { key: string; label: string; values: Record<string, number> }>();
        const numericFieldMap = new Map<string, FieldDef>(
            numericFields.map((field) => [field.key, field])
        );
        const rawSeriesKeys = numericFields.length > 0 ? numericFields.map((field) => field.key) : ["__count__"];
        const selectedSeriesKeysValid = (selectedSeriesKeys || []).filter((key) => {
            if (key === "__count__" && numericFields.length === 0) return true;
            return numericFieldMap.has(key);
        });
        const seriesKeys = selectedSeriesKeysValid.length > 0 ? selectedSeriesKeysValid : rawSeriesKeys;
        const rankingSeriesKey = rankingFieldKey && numericFieldMap.has(rankingFieldKey) ? rankingFieldKey : null;
        const aggregationKeys = Array.from(new Set([...(seriesKeys || []), ...(rankingSeriesKey ? [rankingSeriesKey] : [])]));
        const statsMap = new Map<string, Record<string, number[]>>();
        data.forEach((record: any) => {
            const cat1Value = formatCategoryValue(cat1Field, record);
            const cat2Value = cat2Field ? formatCategoryValue(cat2Field, record) : null;
            const label = cat2Field ? `${cat1Value} • ${cat2Value}` : `${cat1Value}`;
            const groupKey = label;
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, { key: groupKey, label, values: Object.fromEntries(aggregationKeys.map((key) => [key, 0])) });
                statsMap.set(groupKey, Object.fromEntries(aggregationKeys.map((key) => [key, []])));
            }
            const stats = statsMap.get(groupKey)!;
            if (numericFields.length === 0) {
                if (stats["__count__"]) {
                    stats["__count__"].push(1);
                }
            } else {
                aggregationKeys.forEach((key) => {
                    const field = numericFieldMap.get(key);
                    if (!field) return;
                    const value = Number(record?.[field.key]);
                    if (!Number.isNaN(value) && stats[key]) {
                        stats[key].push(value);
                    }
                });
            }
        });
        groupMap.forEach((group, groupKey) => {
            const stats = statsMap.get(groupKey);
            if (!stats) return;
            aggregationKeys.forEach((key) => {
                const values = stats[key] || [];
                if (values.length === 0) {
                    group.values[key] = 0;
                    return;
                }
                switch (summaryFn) {
                    case "count":
                        group.values[key] = values.length;
                        return;
                    case "avg":
                        group.values[key] = values.reduce((acc, val) => acc + val, 0) / values.length;
                        return;
                    case "max":
                        group.values[key] = Math.max(...values);
                        return;
                    case "min":
                        group.values[key] = Math.min(...values);
                        return;
                    case "stddev": {
                        const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
                        const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
                        group.values[key] = Math.sqrt(variance);
                        return;
                    }
                    case "sum":
                    default:
                        group.values[key] = values.reduce((acc, val) => acc + val, 0);
                }
            });
        });
        const seriesLabels = numericFields.length > 0
            ? numericFields.reduce<Record<string, string>>((acc, field) => {
                acc[field.key] = field.label;
                return acc;
            }, { "__count__": _("Count") })
            : { "__count__": _("Count") };
        const baseGroups = Array.from(groupMap.values());
        let groups = baseGroups;
        if (rankingMode !== "none" && rankingFieldKey) {
            const limit = Math.max(1, Math.floor(rankingN || 10));
            const ranked = [...baseGroups].sort((a, b) => {
                const aVal = Number(a.values[rankingFieldKey] ?? 0);
                const bVal = Number(b.values[rankingFieldKey] ?? 0);
                if (aVal === bVal) return a.label.localeCompare(b.label);
                return rankingMode === "top" ? bVal - aVal : aVal - bVal;
            });
            groups = ranked.slice(0, limit);
        }
        const allowedGroupKeys = new Set(groups.map((group) => group.key));
        const filteredRawRows = data.filter((record: any) => {
            const cat1Value = formatCategoryValue(cat1Field, record);
            const cat2Value = cat2Field ? formatCategoryValue(cat2Field, record) : null;
            const label = cat2Field ? `${cat1Value} • ${cat2Value}` : `${cat1Value}`;
            return allowedGroupKeys.has(label);
        });
        return {
            groups,
            seriesKeys,
            seriesLabels,
            filteredRawRows,
        };
    }, [columnFilteredDataSource, categoryField1, categoryField2, model.fields, numericFields, formatCategoryValue, summaryFn, selectedSeriesKeys, rankingMode, rankingFieldKey, rankingN]);

    // ---- Crosstab view body (DynamicList path: one-to-many relations & top-level lists) ----
    const crosstabBarColor = modelTone.soft || token.colorPrimaryBg || "rgba(22, 119, 255, 0.16)";

    const stageCrosstabCellEdits = useCallback((updates: Array<{ recordId: string | number; fieldKey: string; value: number }>) => {
        if (updates.length === 0) return;
        setCrosstabStaged((prev) => {
            const next = { ...prev };
            updates.forEach(({ recordId, fieldKey, value }) => {
                const key = String(recordId);
                next[key] = { ...(next[key] || {}), [fieldKey]: value };
            });
            return next;
        });
    }, []);

    const getCrosstabStagedValue = useCallback((recordId: string | number, fieldKey: string) => {
        return crosstabStaged[String(recordId)]?.[fieldKey];
    }, [crosstabStaged]);

    const crosstabHasPendingEdits = Object.keys(crosstabStaged).length > 0;

    const saveCrosstabEdits = useCallback(async () => {
        const entries = Object.entries(crosstabStaged);
        if (entries.length === 0) return;
        setCrosstabSaving(true);
        try {
            const resource = resolveResourcePath(model.resource || model.name, allModels);
            for (const [recordId, fields] of entries) {
                const resp = await authenticatedFetch(`${apiUrl}/${resource}/${recordId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(fields),
                });
                if (!resp.ok) throw new Error(`Save failed (${resp.status})`);
            }
            setCrosstabStaged({});
            message.success(_("Changes saved."));
            invalidate({ resource: model.resource || model.name, invalidates: ["list"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : _("Failed to save changes."));
        } finally {
            setCrosstabSaving(false);
        }
    }, [crosstabStaged, apiUrl, allModels, model.resource, model.name, invalidate]);

    // #1 Resolve FK display labels (dc_title) for reference fields used as crosstab row/column
    // categories or filters, so headers show the related object's title instead of its raw id.
    const crosstabResolvedRefIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!isCrosstabView) return;
        const refFields = [categoryField1, categoryField2, ...crosstabFilterFields]
            .filter((k): k is string => Boolean(k))
            .map((k) => model.fields.find((f) => f.key === k))
            .filter((f): f is FieldDef => Boolean(f && f.reference));
        if (refFields.length === 0) return;
        const data = (allRowsData.length > 0 ? allRowsData : (columnFilteredDataSource || [])) as any[];
        let cancelled = false;
        (async () => {
            for (const field of refFields) {
                const resourcePath = field.referencePath || resolveResourcePath(field.reference as string, allModels);
                const ids = Array.from(new Set(
                    data.map((r) => r?.[field.key]).filter((v) => v !== undefined && v !== null)
                )).filter((id) => !crosstabResolvedRefIdsRef.current.has(`${field.reference}:${id}`));
                if (ids.length === 0) continue;
                const batchSize = 20;
                for (let i = 0; i < ids.length && !cancelled; i += batchSize) {
                    const batch = ids.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (id) => {
                        try {
                            const resp = await authenticatedFetch(`${apiUrl}/${resourcePath}/${id}`);
                            if (!resp.ok) return;
                            const rec = await resp.json();
                            if (cancelled) return;
                            const label = rec?._label ?? rec?.name ?? rec?.description ?? String(id);
                            crosstabResolvedRefIdsRef.current.add(`${field.reference}:${id}`);
                            handleReferenceLabel(field.reference as string, id, String(label));
                        } catch {
                            // best-effort label resolution
                        }
                    }));
                }
            }
        })();
        return () => { cancelled = true; };
    }, [isCrosstabView, categoryField1, categoryField2, crosstabFilterFields, allRowsData, columnFilteredDataSource, model.fields, allModels, apiUrl, handleReferenceLabel]);

    // #2 Filter dropdown options for the crosstab filter fields, built from the full dataset with
    // range grouping (same util as the table column filters), independent of the display columns.
    const crosstabFilterOptions = useMemo(() => {
        if (crosstabFilterFields.length === 0) return new Map<string, { text: string; value: string }[]>();
        const data = allRowsData.length > 0 ? allRowsData : (Array.isArray(tableProps.dataSource) ? tableProps.dataSource : []);
        const rangeCount = viewSettings?.maxDistinctColumnFilterValuesToRanges ?? 20;
        const fields = crosstabFilterFields
            .map((k) => model.fields.find((f) => f.key === k))
            .filter((f): f is FieldDef => Boolean(f));
        return buildColumnFilterOptions({ fields, data, rangeCount });
    }, [crosstabFilterFields, allRowsData, tableProps.dataSource, viewSettings, model.fields]);

    const crosstabSummaryOptions = [
        { label: _("Sum"), value: "sum" },
        { label: _("Average"), value: "avg" },
        { label: _("Count"), value: "count" },
        { label: _("Max"), value: "max" },
        { label: _("Min"), value: "min" },
        { label: _("Std Dev"), value: "stddev" },
    ];

    const crosstabConfigPanel = (
        <Collapse
            size="small"
            defaultActiveKey={[]}
            style={{ marginBottom: 12 }}
            items={[{
                key: "crosstab-config",
                label: <Tooltip title={_("Crosstab configuration")}><span><SettingOutlined /></span></Tooltip>,
                children: (
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Category 1 (rows)")}</div>
                                <Select
                                    value={categoryField1 || undefined}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCategoryField1(value); }}
                                    style={{ width: "100%" }}
                                    options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("Select category")}
                                />
                            </div>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Category 2 (columns)")}</div>
                                <Select
                                    value={categoryField2 || "__none__"}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCategoryField2(value === "__none__" ? null : value); }}
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: _("None"), value: "__none__" },
                                        ...categoricalFields.filter((field) => field.key !== categoryField1).map((field) => ({ label: field.label, value: field.key })),
                                    ]}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Cell fields")}</div>
                                <Select
                                    mode="multiple"
                                    allowClear
                                    value={selectedSeriesKeys || []}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setSelectedSeriesKeys(value); }}
                                    style={{ width: "100%" }}
                                    options={model.fields.filter((field) => !isPkField(field, model)).map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("All numeric fields")}
                                    maxTagCount="responsive"
                                />
                            </div>
                            <div style={{ minWidth: 150 }}>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Summary")}</div>
                                <Select
                                    value={summaryFn}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setSummaryFn(value as typeof summaryFn); }}
                                    style={{ width: "100%" }}
                                    options={crosstabSummaryOptions}
                                />
                            </div>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Filter fields")}</div>
                                <Select
                                    mode="multiple"
                                    allowClear
                                    value={crosstabFilterFields}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCrosstabFilterFields(value); }}
                                    style={{ width: "100%" }}
                                    options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("Select filter fields")}
                                    maxTagCount="responsive"
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Tooltip title={_("Save configuration")}>
                                <Button size="small" icon={<SaveOutlined />} onClick={() => openSaveViewModalFor("analyze")} loading={isSavingAnalyzePrefs} aria-label={_("Save configuration")} />
                            </Tooltip>
                        </div>
                    </div>
                ),
            }]}
        />
    );

    const crosstabFilterRow = crosstabFilterFields.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {crosstabFilterFields.map((fieldKey) => {
                const field = model.fields.find((f) => f.key === fieldKey);
                if (!field) return null;
                const options = (crosstabFilterOptions.get(fieldKey) || []).map((opt) => ({
                    label: field.reference ? (labelCache[`${field.reference}:${opt.value}`] || opt.text) : opt.text,
                    value: opt.value,
                }));
                return (
                    <div key={`ct-filter-${fieldKey}`} style={{ minWidth: 200 }}>
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{field.label}</div>
                        <Select
                            mode="multiple"
                            allowClear
                            size="small"
                            style={{ width: "100%" }}
                            placeholder={_("All")}
                            maxTagCount="responsive"
                            value={columnFiltersSelected[fieldKey] || []}
                            options={options}
                            onChange={(values) => setColumnFiltersSelected((prev) => ({ ...prev, [fieldKey]: values }))}
                        />
                    </div>
                );
            })}
        </div>
    ) : null;

    const crosstabBodyNode = (
        <div>
            {editableCrosstab && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <Tooltip title={_("Save")}>
                        <Button size="small" type="primary" icon={<SaveOutlined />} onClick={saveCrosstabEdits} loading={crosstabSaving} disabled={!crosstabHasPendingEdits} aria-label={_("Save")} />
                    </Tooltip>
                </div>
            )}
            {crosstabConfigPanel}
            {crosstabFilterRow}
            <CrosstabTable
                rows={columnFilteredDataSource}
                rowField={categoryField1}
                colField={categoryField2 ?? null}
                cellFieldKeys={(selectedSeriesKeys && selectedSeriesKeys.length > 0) ? selectedSeriesKeys : numericFields.map((f) => f.key)}
                cellFieldLabels={Object.fromEntries(model.fields.map((f) => [f.key, f.label]))}
                allFields={model.fields}
                allModels={allModels}
                summaryFn={summaryFn}
                formatCategoryValue={formatCategoryValue}
                numericBarColor={crosstabBarColor}
                editable={editableCrosstab ? {
                    pkField: model.pkField || "eid",
                    getStagedValue: getCrosstabStagedValue,
                    onCommitCell: stageCrosstabCellEdits,
                    confirmProration: true,
                } : undefined}
            />
        </div>
    );

    const chartSignature = useMemo(() => {
        return JSON.stringify({
            chartType,
            summaryFn,
            categoryField1,
            categoryField2,
            rankingMode,
            rankingFieldKey,
            rankingN,
            seriesKeys: chartData.seriesKeys,
            groups: chartData.groups,
        });
    }, [chartType, summaryFn, categoryField1, categoryField2, rankingMode, rankingFieldKey, rankingN, chartData]);

    const statsSummary = useMemo(() => {
        return buildStatsSummary(columnFilteredDataSource, displayFields, labelCache);
    }, [columnFilteredDataSource, displayFields, labelCache]);

    // --- totals-details boxes (reuses allRows + displayFields) ---
    const tdCategoricalBoxes = useMemo(() => {
        if (!isTotalsDetailsView) return [];
        return displayFields
            .filter((field) => field.type !== "number" || Boolean(field.reference))
            .map((field) => {
                const counts = new Map<string, number>();
                (allRows || []).forEach((row) => {
                    const raw = row?.[field.key];
                    let label = "-";
                    if (raw !== undefined && raw !== null) {
                        if (field.reference) {
                            const cacheKey = `${field.reference}:${raw}`;
                            label = labelCache[cacheKey] || String(raw);
                        } else if (field.options) {
                            // Guard the predicate, not just the .find() result --
                            // see the identical fix in statistics.tsx's
                            // formatCategoricalValue for why an outer `?.label`
                            // alone doesn't protect against a null entry.
                            label = field.options.find((o) => o && o.value === raw)?.label || String(raw);
                        } else if (field.type === "boolean") {
                            label = raw ? _("Yes") : _("No");
                        } else if (field.type === "date") {
                            label = formatDateValue(raw);
                        } else if (field.type === "datetime") {
                            label = formatDateTimeValue(raw) ?? String(raw);
                        } else if (field.type === "time") {
                            label = formatTimeValue(raw);
                        } else {
                            label = String(raw);
                        }
                    }
                    counts.set(label, (counts.get(label) || 0) + 1);
                });
                const breakdown = Array.from(counts.entries())
                    .map(([value, count]) => ({ value, count }))
                    .sort((a, b) => b.count - a.count);
                return {
                    key: field.key,
                    label: field.label,
                    value: breakdown.length,
                    breakdown,
                    showBreakdown: breakdown.length > 0 && breakdown.length < 5,
                };
            });
    }, [isTotalsDetailsView, allRows, displayFields, labelCache]);
    const getDefaultTotalsSummaryFn = useCallback((field: FieldDef): TotalsSummaryFn => {
        if (isPkField(field, model) || isReferenceField(field)) return "count";
        return "sum";
    }, []);
    const resolveTotalsSummaryFn = useCallback((field: FieldDef): TotalsSummaryFn => {
        return totalsSummaryFunctions[field.key] || getDefaultTotalsSummaryFn(field);
    }, [getDefaultTotalsSummaryFn, totalsSummaryFunctions]);
    const computeTotalsSummaryValue = useCallback((field: FieldDef): number => {
        const fn = resolveTotalsSummaryFn(field);
        if (field.type === "number" && !field.reference) {
            const values = (allRows || [])
                .map((row) => Number(row?.[field.key]))
                .filter((v) => !Number.isNaN(v) && Number.isFinite(v));
            if (values.length === 0) return 0;
            switch (fn) {
                case "count": return values.length;
                case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
                case "max": return Math.max(...values);
                case "min": return Math.min(...values);
                case "stddev": {
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
                }
                case "distinct": return new Set(values).size;
                default: return values.reduce((a, b) => a + b, 0);
            }
        }
        const rawValues = (allRows || []).map((row) => row?.[field.key]);
        if (fn === "count") return rawValues.length;
        if (fn === "distinct") return new Set(rawValues.map((v) => String(v ?? "-"))).size;
        return rawValues.length;
    }, [allRows, resolveTotalsSummaryFn]);
    const getSummaryFunctionDisplayText = useCallback((fn?: TotalsSummaryFn) => {
        if (!fn) return "";
        const labels: Record<TotalsSummaryFn, string> = {
            sum: _("Sum"), avg: _("Average"), count: _("Count"),
            max: _("Max"), min: _("Min"), stddev: _("Std Dev"), distinct: _("Distinct"),
        };
        return labels[fn] || fn;
    }, []);
    const tdNumericBoxes = useMemo(() => {
        if (!isTotalsDetailsView) return [];
        return displayFields
            .filter((field) => field.type === "number" && !field.reference)
            .map((field) => {
                const summaryFnVal = resolveTotalsSummaryFn(field);
                const value = computeTotalsSummaryValue(field);
                const label = field.label;
                return { key: field.key, label, value, summaryFn: summaryFnVal };
            });
    }, [isTotalsDetailsView, displayFields, resolveTotalsSummaryFn, computeTotalsSummaryValue]);
    const totalsSummaryConfigFields = useMemo(() => {
        return displayFields.filter((field) => field.type === "number" && !field.reference);
    }, [displayFields]);
    const renderDynamicListTotalsBoxes = () => {
        if (!isTotalsDetailsView) return null;
        const hasCat = tdCategoricalBoxes.length > 0;
        const hasNum = tdNumericBoxes.length > 0;
        if (!hasCat && !hasNum) return null;
        const catTone = { soft: "#fde68a", softer: "#fffbeb", text: "#92400e", chipBg: "#ffffff" };
        return (
            <div style={{ marginBottom: 12, borderRadius: 8, padding: 10, background: token.colorBgContainer }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, overflowX: "auto", paddingBottom: 2 }}>
                    <div style={{ width: "max-content", minWidth: "100%", display: "flex", justifyContent: "center", gap: 12, alignItems: "stretch" }}>
                        {hasCat && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }}>
                                {tdCategoricalBoxes.map((item) => (
                                    <Card key={`td-cat-${item.key}`} size="small" variant="borderless"
                                        style={{ minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${catTone.softer} 0%, ${catTone.soft} 100%)` }}
                                        styles={{ body: { padding: 10 } }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 400, color: catTone.text, textAlign: "center", marginTop: 2 }}>{item.label}</div>
                                        {item.showBreakdown ? (
                                            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                                                {item.breakdown.map((entry) => (
                                                    <div key={`td-cat-${item.key}-${entry.value}`}
                                                        style={{ fontSize: 12, color: catTone.text, fontWeight: 400, textAlign: "center", borderRadius: 8, background: catTone.chipBg, padding: "2px 8px" }}
                                                    >{`${entry.value}: ${formatNumberValue(entry.count)}`}</div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 24, fontWeight: 400, color: catTone.text, textAlign: "center", marginTop: 4 }}>{formatNumberValue(item.value)}</div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                        {hasCat && hasNum && <div style={{ borderLeft: `1px solid ${token.colorBorderSecondary}`, margin: "0 2px" }} />}
                        {hasNum && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }}>
                                {tdNumericBoxes.map((item) => (
                                    <Card key={`td-num-${item.key}`} size="small" variant="borderless"
                                        style={{ minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${modelTone.softer} 0%, ${modelTone.soft} 100%)` }}
                                        styles={{ body: { padding: 10 } }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 400, color: modelTone.text, textAlign: "center", marginTop: 2 }}>
                                            {item.summaryFn && item.summaryFn !== "sum"
                                                ? `${item.label} (${getSummaryFunctionDisplayText(item.summaryFn)})`
                                                : item.label}
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 400, color: modelTone.solid, textAlign: "center", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{formatNumberValue(item.value)}</div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <Tooltip title={isTdFlipped ? _("Show totals") : _("Show details")}>
                    <Button
                        size="small"
                        icon={<SwapOutlined style={{ transform: "rotate(90deg)" }} />}
                        aria-label={isTdFlipped ? _("Show totals") : _("Show details")}
                        onClick={() => setIsTdFlipped((prev) => !prev)}
                        style={{
                            flexShrink: 0,
                            background: modelTone.soft,
                            borderColor: modelTone.border,
                            color: modelTone.text,
                        }}
                    />
                </Tooltip>
                </div>
            </div>
        );
    };

    const numericColumnMaxes = useMemo(() => {
        const maxes: Record<string, number> = {};
        const rows = allRows || [];
        displayFields.forEach((field) => {
            if (field.type !== "number" || field.reference) return;
            const values = rows
                .map((row) => Number(row?.[field.key]))
                .filter((value) => !Number.isNaN(value) && Number.isFinite(value));
            if (values.length === 0) {
                maxes[field.key] = 0;
                return;
            }
            maxes[field.key] = Math.max(...values.map((val) => Math.abs(val)));
        });
        return maxes;
    }, [allRows, displayFields]);

    const statsNumericMaxes = useMemo(() => {
        const stats = statsSummary.numericStats;
        const maxAbs = (values: Array<number | null>) => {
            const absValues = values.filter((val): val is number => typeof val === "number").map((val) => Math.abs(val));
            return absValues.length > 0 ? Math.max(...absValues) : 0;
        };
        return {
            sum: maxAbs(stats.map((row) => row.sum)),
            avg: maxAbs(stats.map((row) => row.avg)),
            min: maxAbs(stats.map((row) => row.min)),
            max: maxAbs(stats.map((row) => row.max)),
            stddev: maxAbs(stats.map((row) => row.stddev)),
        };
    }, [statsSummary.numericStats]);

    useEffect(() => {
        if (!analyzeOpen) return;
        skipNextAnimationRef.current = true;
        setChartAnimationStage("enter");
        setChartAnimationKey((key) => key + 1);
    }, [analyzeOpen]);

    useEffect(() => {
        if (!analyzeOpen) return;
        if (skipNextAnimationRef.current) {
            skipNextAnimationRef.current = false;
            return;
        }
        setChartAnimationStage("update");
        setChartAnimationKey((key) => key + 1);
    }, [analyzeOpen, chartSignature]);

    const fieldByKey = useMemo(() => {
        return new Map(model.fields.map((field) => [field.key, field]));
    }, [model.fields]);

    const chartTitle = useMemo(() => {
        const cat1Label = categoryField1 ? fieldByKey.get(categoryField1)?.label : "All";
        const cat2Label = categoryField2 ? fieldByKey.get(categoryField2)?.label : null;
        const parts = [model.label || model.name, cat1Label];
        if (cat2Label) parts.push(cat2Label);
        return parts.filter(Boolean).join(" • ");
    }, [categoryField1, categoryField2, fieldByKey, model.label, model.name]);

    const formatValueForExport = useCallback((field: FieldDef, record: any) => {
        const raw = record?.[field.key];
        if (raw === undefined || raw === null) return "";
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            return field.options.find((option) => option && option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        if (field.type === "datetime") return formatDateTimeValue(raw) ?? String(raw);
        if (field.type === "time") return formatTimeValue(raw);
        return String(raw);
    }, [labelCache]);

    useEffect(() => {
        if (!exportRequested || isAllRowsLoading) return;
        const escapeCsv = (value: string) => {
            if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
                return `"${value.replace(/"/g, "\"\"")}"`;
            }
            return value;
        };
        const headers = model.fields.map((field) => field.label);
        const rows = allRows.map((record) => {
            return model.fields.map((field) => escapeCsv(formatValueForExport(field, record)));
        });
        const csv = [headers.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${model.name}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExportRequested(false);
    }, [exportRequested, isAllRowsLoading, allRows, model.fields, model.name, formatValueForExport]);

    const exportChartImage = () => {
        const svg = chartSvgRef.current;
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const width = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
            const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const pngUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = pngUrl;
                link.download = `${model.name}-chart.png`;
                link.click();
                URL.revokeObjectURL(pngUrl);
            }, "image/png");
        };
        img.src = url;
    };
    const exportChartPdf = () => {
        const svg = chartSvgRef.current;
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const width = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
            const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            const dataUrl = canvas.toDataURL("image/png");
            const chartHeading = chartTitle || `${model.label} Chart`;
            openPdfWindow(
                `${model.name}-chart`,
                `<h2>${escapeHtml(chartHeading)}</h2><img src="${dataUrl}" style="width: 100%; height: auto;" />`
            );
        };
        img.src = url;
    };
    const exportStatsPdf = () => {
        openPdfWindow(`${model.name}-stats`, buildStatsHtml(statsSummary));
    };

    const getRowKey = (record: any, index?: number) => {
        // Named queries may have duplicate eids (e.g. one row per Project×Task);
        // use the row index as the React key to avoid duplicate-key warnings.
        if (model.isNamedQuery && index !== undefined) return String(index);
        if (record?.eid !== undefined && record?.eid !== null) return record.eid;
        if (record?.id !== undefined && record?.id !== null) return record.id;
        if (relationConfig?.targetKey || relationConfig?.otherKey) {
            const targetValue = relationConfig?.targetKey ? record?.[relationConfig.targetKey] : undefined;
            const otherValue = relationConfig?.otherKey ? record?.[relationConfig.otherKey] : undefined;
            if (targetValue !== undefined || otherValue !== undefined) {
                return `${targetValue ?? "null"}_${otherValue ?? "null"}`;
            }
        }
        const compositeKey = model.fields
            .map((field) => record?.[field.key])
            .filter((value) => value !== undefined && value !== null)
            .join("_");
        return compositeKey || JSON.stringify(record);
    };

    const getTargetInfo = (record: any) => {
        if (relationConfig?.otherResource && relationConfig?.otherKey && record[relationConfig.otherKey]) {
            return { resource: relationConfig.otherResource, id: record[relationConfig.otherKey], isLinkRow: true };
        }
        // For named queries navigate to the primary model's show page.
        const resourceName = (model.isNamedQuery && model.primaryResource)
            ? model.primaryResource
            : (model.resource || model.name);
        // Resolution order: explicit pkField → isPk field → eid (CubicWeb) → id (standard)
        const explicitPk = model.pkField ? record[model.pkField] : undefined;
        const isPkField = model.fields?.find((f) => f.isPk)?.key;
        const pkValue = explicitPk ?? (isPkField ? record[isPkField] : undefined) ?? record.eid ?? record.id ?? null;
        if (pkValue != null) {
            return { resource: resourceName, id: pkValue, isLinkRow: false };
        }
        return { resource: null, id: null, isLinkRow: false };
    };
    // --- Bulk selection helpers ---
    const clearBulkSelection = useCallback(() => {
        setBulkSelectedRowKeys([]);
        bulkSelectedRowsMapRef.current.clear();
    }, []);

    // When "select all filtered" was triggered before all rows were loaded, execute it once loaded.
    useEffect(() => {
        if (!selectAllFilteredPending || !allRowsLoaded) return;
        setSelectAllFilteredPending(false);
        const keys = filteredDataSource.map((r: any) => getRowKey(r));
        bulkSelectedRowsMapRef.current.clear();
        filteredDataSource.forEach((r: any) => bulkSelectedRowsMapRef.current.set(getRowKey(r), r));
        setBulkSelectedRowKeys(keys);
    }, [selectAllFilteredPending, allRowsLoaded, filteredDataSource]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectAllFiltered = useCallback(() => {
        if (!allRowsLoaded) {
            setSelectAllFilteredPending(true);
            fetchAllRows();
        } else {
            const keys = filteredDataSource.map((r: any) => getRowKey(r));
            bulkSelectedRowsMapRef.current.clear();
            filteredDataSource.forEach((r: any) => bulkSelectedRowsMapRef.current.set(getRowKey(r), r));
            setBulkSelectedRowKeys(keys);
        }
    }, [allRowsLoaded, fetchAllRows, filteredDataSource]); // eslint-disable-line react-hooks/exhaustive-deps

    const executeNavigateToRelated = useCallback(() => {
        if (!navigateToRelation) return;
        const records = bulkSelectedRowKeys.map((k) => bulkSelectedRowsMapRef.current.get(k)).filter(Boolean);
        if (records.length === 0) return;

        const targetResource = resolveResourcePath(navigateToRelation.targetResource, allModels);
        let filterIds: (string | number)[] = [];

        if (navigateToRelation.isForward) {
            // Forward relation: FK is on target model. Filter target by source IDs.
            filterIds = records.map((r: any) => {
                const pk = model.pkField || getRecordId(r);
                return r[pk] ?? r.id ?? r.eid;
            }).filter((v: any) => v !== undefined && v !== null);
        } else {
            // Reverse FK: FK is on source model. Extract FK values from selected records.
            const sourceKey = navigateToRelation.sourceValueKey || navigateToRelation.filterKey;
            filterIds = records.map((r: any) => r[sourceKey])
                .filter((v: any) => v !== undefined && v !== null);
        }

        if (filterIds.length === 0) return;

        const params = new URLSearchParams();
        params.append(navigateToRelation.filterKey + "__in", filterIds.join(","));
        const targetUrl = `/${targetResource}?${params.toString()}`;

        // Store href for right-click support
        (window as any).__veloiq_nav_href = targetUrl;

        // Clear selection and navigate
        clearBulkSelection();
        setBulkActionsToApply([]);
        setNavigateToRelation(null);
        navigate(targetUrl);
    }, [navigateToRelation, bulkSelectedRowKeys, bulkSelectedRowsMapRef, model, allModels, clearBulkSelection, navigate]);

    const executeBulkActions = useCallback(async () => {
        const records = bulkSelectedRowKeys.map((k) => bulkSelectedRowsMapRef.current.get(k)).filter(Boolean);


        if (records.length === 0) return;

        const resource = resolveResourcePath(model.resource || model.name, allModels);

        // --- Local (non-API) actions run immediately, before the loading spinner ---
        if (bulkActionsToApply.includes("__export_csv__")) {
            const escapeCsv = (val: string) =>
                val.includes('"') || val.includes(",") || val.includes("\n")
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
            const headers = displayFields.map((f) => f.label);
            const rows = records.map((record) =>
                displayFields.map((field) => escapeCsv(formatValueForExport(field, record)))
            );
            const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${model.name}_selected.csv`;
            link.click();
            URL.revokeObjectURL(url);
        }

        // If export was the only action, close modal and return without an API call
        const apiActionKeys = bulkActionsToApply.filter((k) => k !== "__export_csv__");
        if (apiActionKeys.length === 0) {
            setBulkActionModalOpen(false);
            clearBulkSelection();
            setBulkActionsToApply([]);
            return;
        }

        setIsBulkExecuting(true);
        let errorOccurred = false;
        try {
            for (const record of records) {
                const id = record.eid ?? record.id;
                for (const actionKey of apiActionKeys) {
                    if (actionKey === "__delete__") {
                        const resp = await authenticatedFetch(`${apiUrl}/${resource}/${id}`, { method: "DELETE" });
                        if (!resp.ok) throw new Error(`${_("Delete failed for record")} ${id}`);
                    } else if (actionKey === "__change_field__") {
                        if (!bulkChangeFieldKey) continue;
                        const payload = { ...record, [bulkChangeFieldKey]: bulkChangeFieldValue };
                        delete (payload as any)._label;
                        const resp = await authenticatedFetch(`${apiUrl}/${resource}/${id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                        });
                        if (!resp.ok) throw new Error(`${_("Update failed for record")} ${id}`);
                    } else if (actionKey === "__clone__") {
                        const clonePayload = { ...record };
                        delete (clonePayload as any).eid;
                        delete (clonePayload as any).creation_date;
                        delete (clonePayload as any).modification_date;
                        delete (clonePayload as any)._label;
                        const resp = await authenticatedFetch(`${apiUrl}/${resource}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(clonePayload),
                        });
                        if (!resp.ok) throw new Error(`${_("Clone failed for record")} ${id}`);
                    } else if (actionKey === "__pin__") {
                        await authenticatedFetch(`${apiUrl}/dashboard/pinned-records`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ resource, record_id: String(id) }),
                        });
                    } else if (actionKey === "__unpin__") {
                        await authenticatedFetch(
                            `${apiUrl}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(id))}`,
                            { method: "DELETE" }
                        );
                    } else {
                        const customAction = bulkActions?.find((a) => a.key === actionKey);
                        if (customAction) await customAction.onExecuteOne(record);
                    }
                }
            }
            message.success(
                _("Actions applied successfully to {count} rows").replace("{count}", String(records.length))
            );
        } catch (e: any) {
            errorOccurred = true;
            message.error(e?.message || _("Bulk action failed"));
        } finally {
            setIsBulkExecuting(false);
            setBulkActionModalOpen(false);
            if (!errorOccurred) {
                clearBulkSelection();
                setBulkActionsToApply([]);
                setBulkChangeFieldKey(null);
                setBulkChangeFieldValue(null);
            }
            invalidate({ resource: model.resource || model.name, invalidates: ["list"] });
        }
    }, [bulkSelectedRowKeys, bulkActionsToApply, bulkChangeFieldKey, bulkChangeFieldValue, bulkActions, apiUrl, model.name, model.resource, allModels, displayFields, formatValueForExport, clearBulkSelection, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Row right-click handler: shows context menu with bulk actions ---
    const handleRowRightClick = (record: any, event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        // For right-click, only suppress the context menu on truly interactive
        // elements (checkbox, action buttons, selects) — NOT on regular cell
        // content like links or text, so the user can right-click anywhere on the row.
        const shouldSuppressContextMenu = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return false;
            return Boolean(
                target.closest(
                    ".ant-checkbox,.ant-switch,.ant-select,.ant-picker,.ant-pagination,.ant-btn,button:not(a button),input,select,textarea"
                )
            );
        };
        if (shouldSuppressContextMenu(event.target)) return;
        const { resource, id } = getTargetInfo(record);
        if (!resource || id === undefined || id === null) return;
        const isMulti = bulkSelectedRowKeys.length > 1;
        setRowContextMenuRecord(record);
        setRowContextMenuIsMulti(isMulti);
        setRowContextMenuPosition({ x: event.clientX, y: event.clientY });
        setRowContextMenuVisible(true);
    };

    // --- Handle a context menu item click ---
    const handleContextMenuClick = ({ key }: { key: string }) => {
        setRowContextMenuVisible(false);
        const record = rowContextMenuRecord;
        if (!record) return;

        // Navigation actions
        if (key === '__open_show__' || key === '__open_new_tab__' || key === '__open_new_window__') {
            const { resource, id } = getTargetInfo(record);
            if (!resource || id === undefined || id === null) return;
            const showUrl = `/${resource}/show/${id}`;
            if (key === '__open_show__') {
                if (paneNav?.isInMultiPane) {
                    paneNav.openDetail(resource, id);
                } else {
                    go({ to: { resource, action: "show", id } });
                }
            } else if (key === '__open_new_tab__') {
                window.open(showUrl, '_blank');
            } else if (key === '__open_new_window__') {
                window.open(showUrl, '_blank', 'noopener,noreferrer');
            }
            return;
        }

        // Bulk actions: if row is part of a multi-selection, use existing selection.
        // Otherwise, temporarily select just this row, apply action, then clean up.
        const isMulti = rowContextMenuIsMulti && bulkSelectedRowKeys.length > 1;
        if (!isMulti) {
            const rowKey = getRowKey(record);
            bulkSelectedRowsMapRef.current.clear();
            bulkSelectedRowsMapRef.current.set(rowKey, record);
            setBulkSelectedRowKeys([rowKey]);
        }
        // Trigger the existing bulk-action execution pipeline.
        // Setting bulkActionsToApply kicks off executeBulkActions via its useEffect.
        setBulkActionsToApply([key]);

        // Auto-select the first navigable relation when "Navigate to related"
        // or "Append related list" is chosen via the context menu.
        if (key === '__navigate_to_related__') {
            const navRels = getNavigableRelations(model, allModels || []);
            if (navRels.length > 0 && !navigateToRelation) {
                setNavigateToRelation(navRels[0]);
            }
        } else if (key === '__append_related_list__') {
            const navRels = getNavigableRelations(model, allModels || []);
            if (navRels.length > 0 && !appendRelationRecord) {
                setAppendRelationRecord(navRels[0]);
            }
        }
    };

    const shouldIgnoreRowClick = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(
            target.closest(
                "a,button,input,select,textarea,[role='button'],.ant-checkbox,.ant-switch,.ant-select,.ant-picker,.ant-pagination"
            )
        );
    };
    const handleRowClick = (record: any, event: React.MouseEvent<HTMLElement>) => {
        if (event.defaultPrevented || shouldIgnoreRowClick(event.target)) return;
        const { resource, id } = getTargetInfo(record);
        if (resource && id !== undefined && id !== null) {
            if (paneNav?.isInMultiPane) {
                paneNav.openDetail(resource, id);
            } else {
                go({ to: { resource, action: "show", id } });
            }
        }
    };

    const isEmptyTable = (filteredDataSource?.length ?? 0) === 0;

    // --- Internal row selection config ---
    // A ref always pointing to the latest getRowKey so the stable onChange callback never
    // captures a stale closure. getRowKey itself is redefined each render (it isn't memoized)
    // so we hold it in a ref to keep the onChange useCallback stable.
    const getRowKeyRef = useRef(getRowKey);
    getRowKeyRef.current = getRowKey;

    // Stable onChange that tracks selected rows across pages via a Map stored in a ref.
    // Ant Design's Table only returns `selectedRows` for the *current page* when using
    // server-side pagination, so we merge each page's selections into the Map ourselves.
    const handleBulkRowSelectionChange = useCallback(
        (newKeys: React.Key[], newRowsOnPage: any[]) => {
            const currentPageData = isClientFiltering ? filteredDataSource : (Array.isArray(tableProps.dataSource) ? tableProps.dataSource : []);
            const currentPageKeys = new Set(currentPageData.map((r: any) => String(getRowKeyRef.current(r))));
            const newKeySet = new Set(newKeys.map((k) => String(k)));
            // Add / update records for rows now selected on this page
            newRowsOnPage.forEach((row) => {
                bulkSelectedRowsMapRef.current.set(getRowKeyRef.current(row), row);
            });
            // Remove records for rows that were on this page but are now deselected
            currentPageKeys.forEach((k) => {
                if (!newKeySet.has(k)) bulkSelectedRowsMapRef.current.delete(k);
            });
            // Sync state: only keys drive re-renders; records live in the ref
            setBulkSelectedRowKeys([...bulkSelectedRowsMapRef.current.keys()]);
        },
        [isClientFiltering, filteredDataSource, tableProps.dataSource],
    );

    const internalRowSelection = rowSelection ?? {
        selectedRowKeys: bulkSelectedRowKeys,
        onChange: handleBulkRowSelectionChange,
        selections: [
            Table.SELECTION_ALL,
            Table.SELECTION_NONE,
            {
                key: "select-all-filtered",
                text: _("Select all filtered rows"),
                onSelect: handleSelectAllFiltered,
            },
        ],
    };

    // Computed values for bulk actions bar
    const filteredTotalCount = isClientFiltering
        ? filteredDataSource.length
        : (typeof tableProps.pagination === "object" ? (tableProps.pagination?.total ?? filteredDataSource.length) : filteredDataSource.length);

    const bulkActionsAvailable = useMemo((): { label: string; value: string; disabled?: boolean }[] => {
        const opts: { label: string; value: string; disabled?: boolean }[] = [];
        // "Change field value" requires edit permission
        if (canBulkEdit) {
            opts.push({ label: _("Change field value"), value: "__change_field__" });
        }
        // Export selected rows as CSV — no special permission needed (read-only)
        opts.push({ label: _("Export selected (CSV)"), value: "__export_csv__" });
        opts.push({ label: _("Navigate to related"), value: "__navigate_to_related__" });
        // Append related list below the current one (stacked)
        opts.push({ label: _("Append related list"), value: "__append_related_list__" });
        // Bulk clone/duplicate requires create permission (reuse edit as proxy since useCan
        // doesn't distinguish create easily here; always shown if user can edit)
        if (canBulkEdit) {
            opts.push({ label: _("Clone / Duplicate selected"), value: "__clone__" });
        }
        // Custom model actions (always shown; they are special operations, not CRUD)
        if (bulkActions && bulkActions.length > 0) {
            bulkActions.forEach((a) => opts.push({ label: _(a.label), value: a.key }));
        }
        // Pin / Unpin — always available (dashboard feature, no CRUD permission needed)
        opts.push({ label: _("Pin selected"), value: "__pin__" });
        opts.push({ label: _("Unpin selected"), value: "__unpin__" });
        // "Delete selected" requires delete permission
        if (canBulkDelete) {
            opts.push({ label: _("Delete selected"), value: "__delete__" });
        }
        return opts;
    }, [bulkActions, canBulkDelete, canBulkEdit]);

    const bulkChangeField = bulkChangeFieldKey
        ? model.fields.find((f) => f.key === bulkChangeFieldKey) ?? null
        : null;

    // --- Pre-filter banner: shown when the list is filtered via "Navigate to related" ---
    const preFilterBanner = urlPreFilters.length > 0 ? (() => {
        const filterLabels: string[] = [];
        for (const pf of urlPreFilters) {
            const fieldName = String(pf.field).replace(/_in$/, "");
            // Try to resolve a human-readable label: check if this field
            // is a known relation FK or the model's PK
            const relationDef = (model.relations || []).find(
                (r) => (r.targetKey || r.otherKey) === fieldName
            );
            const fieldDef = model.fields.find((f) => f.key === fieldName);
            if (relationDef) {
                const relLabel = relationDef.label || relationDef.relationName || fieldName;
                filterLabels.push(relLabel);
            } else if (fieldDef && fieldDef.reference) {
                // Reverse FK: field references another model
                const refModel = allModels?.find(
                    (m) => (m.resource || m.name).toLowerCase() === (fieldDef.reference || "").toLowerCase()
                );
                const modelLabel = refModel?.label || refModel?.name || fieldDef.reference || fieldName;
                filterLabels.push(modelLabel);
            } else if (fieldDef) {
                filterLabels.push(fieldDef.label || fieldName);
            } else {
                filterLabels.push(fieldName);
            }
        }
        const filterDescription = filterLabels.join(", ");
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                padding: "6px 12px", marginBottom: 8, borderRadius: 6,
                background: token.colorPrimaryBg, border: `1px solid ${token.colorPrimaryBorder}`,
            }}>
                <span style={{ color: token.colorPrimaryText, fontSize: 13 }}>
                    {_("Filtered by: {relation}").replace("{relation}", filterDescription)}
                </span>
                <Button
                    size="small"
                    onClick={() => {
                        // Remove __in params from URL, keep everything else
                        const newParams = new URLSearchParams(searchParams);
                        for (const key of Array.from(newParams.keys())) {
                            if (key.endsWith("__in")) newParams.delete(key);
                        }
                        const newSearch = newParams.toString();
                        navigate({ search: newSearch ? `?${newSearch}` : "" }, { replace: true });
                    }}
                >
                    {_("Clear filter")}
                </Button>
            </div>
        );
    })() : null;

    const selectModeBanner = selectMode ? (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            padding: "8px 12px", marginBottom: 8, borderRadius: 6,
            background: token.colorWarningBg, border: `1px solid ${token.colorWarningBorder}`,
        }}>
            <span style={{ fontWeight: 500, color: token.colorWarningText }}>
                {bulkSelectedRowKeys.length > 0
                    ? _("{count} rows selected").replace("{count}", String(bulkSelectedRowKeys.length))
                    : _("Select rows to associate")}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
                {selectModeReturnTo && (
                    <Button size="small" onClick={() => navigate(selectModeReturnTo!)}>{_("Cancel")}</Button>
                )}
                <Button
                    size="small"
                    type="primary"
                    disabled={bulkSelectedRowKeys.length === 0}
                    loading={selectModeAssociating}
                    onClick={handleAssociateSelected}
                >
                    {_("Associate selected")}
                </Button>
            </div>
        </div>
    ) : null;

    const bulkActionsToolbar = !isGalleryView && !isCalendarView && bulkSelectedRowKeys.length > 0 ? (
        <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
            padding: "6px 10px", marginBottom: 8, borderRadius: 6,
            background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`,
        }}>
            <span style={{ fontWeight: 500 }}>
                {_("{count} rows selected").replace("{count}", String(bulkSelectedRowKeys.length))}
            </span>
            {bulkSelectedRowKeys.length < filteredTotalCount && (
                <Button
                    type="link"
                    size="small"
                    loading={selectAllFilteredPending && isAllRowsLoading}
                    onClick={handleSelectAllFiltered}
                    style={{ padding: 0 }}
                >
                    {_("Select all {count} filtered rows").replace("{count}", String(filteredTotalCount))}
                </Button>
            )}
            <Button type="link" size="small" onClick={clearBulkSelection} style={{ padding: 0 }}>
                {_("Clear selection")}
            </Button>
            <div style={{ flex: 1, minWidth: 180 }}>
                <Select
                    mode="multiple"
                    size="small"
                    placeholder={_("Actions")}
                    style={{ width: "100%" }}
                    value={bulkActionsToApply}
                    onChange={(values) => {
                        setBulkActionsToApply(values);
                        if (!values.includes("__change_field__")) {
                            setBulkChangeFieldKey(null);
                            setBulkChangeFieldValue(null);
                        }
                        if (!values.includes("__navigate_to_related__")) {
                            setNavigateToRelation(null);
                        } else if (!navigateToRelation) {
                            // Auto-select the first navigable relation when this action is chosen
                            const navRels = getNavigableRelations(model, allModels || []);
                            if (navRels.length > 0) {
                                setNavigateToRelation(navRels[0]);
                            }
                        }
                        if (!values.includes("__append_related_list__")) {
                            setAppendRelationRecord(null);
                        } else if (!appendRelationRecord) {
                            // Auto-select the first navigable relation when this action is chosen
                            const navRels = getNavigableRelations(model, allModels || []);
                            if (navRels.length > 0) {
                                setAppendRelationRecord(navRels[0]);
                            }
                        }
                    }}
                    options={bulkActionsAvailable}
                />
            </div>
            {bulkActionsToApply.includes("__change_field__") && (
                <>
                    <Select
                        size="small"
                        placeholder={_("Select field")}
                        style={{ minWidth: 160 }}
                        value={bulkChangeFieldKey ?? undefined}
                        onChange={(v) => { setBulkChangeFieldKey(v); setBulkChangeFieldValue(null); }}
                        options={model.fields
                            .filter((f) => !["eid", "creation_date", "modification_date"].includes(f.key))
                            .map((f) => ({ label: f.label, value: f.key }))}
                        allowClear
                    />
                    {bulkChangeField && (
                        bulkChangeField.options ? (
                            <Select
                                size="small"
                                placeholder={_("Select value")}
                                style={{ minWidth: 180 }}
                                value={bulkChangeFieldValue ?? undefined}
                                onChange={(v) => setBulkChangeFieldValue(v)}
                                options={bulkChangeField.options}
                                allowClear
                            />
                        ) : bulkChangeField.type === "boolean" ? (
                            <Select
                                size="small"
                                placeholder={_("Select value")}
                                style={{ minWidth: 120 }}
                                value={bulkChangeFieldValue ?? undefined}
                                onChange={(v) => setBulkChangeFieldValue(v)}
                                options={[{ label: _("True"), value: true }, { label: _("False"), value: false }]}
                                allowClear
                            />
                        ) : bulkChangeField.type === "date" ? (
                            <DatePicker
                                size="small"
                                value={bulkChangeFieldValue ? dayjs(bulkChangeFieldValue) : null}
                                onChange={(v) => setBulkChangeFieldValue(v ? v.toISOString() : null)}
                            />
                        ) : bulkChangeField.type === "number" ? (
                            <InputNumber
                                size="small"
                                placeholder={_("Value")}
                                value={bulkChangeFieldValue}
                                onChange={(v) => setBulkChangeFieldValue(v)}
                                style={{ minWidth: 120 }}
                            />
                        ) : (
                            <Input
                                size="small"
                                placeholder={_("Value")}
                                value={bulkChangeFieldValue ?? ""}
                                onChange={(e) => setBulkChangeFieldValue(e.target.value)}
                                style={{ minWidth: 160 }}
                            />
                        )
                    )}
                </>
            )}
            {(bulkActionsToApply.includes("__navigate_to_related__") || bulkActionsToApply.includes("__append_related_list__")) && (() => {
                const navRelations = getNavigableRelations(model, allModels || []);
                const isAppend = bulkActionsToApply.includes("__append_related_list__");
                const currentRelation = isAppend ? appendRelationRecord : navigateToRelation;
                return (
                    <Select
                        size="small"
                        placeholder={isAppend ? _("Select relation to append") : _("Select relation")}
                        style={{ minWidth: 220 }}
                        showSearch
                        value={currentRelation ? `${currentRelation.targetResource}|${currentRelation.filterKey}` : undefined}
                        onChange={(val) => {
                            const selected = navRelations.find(
                                (r) => `${r.targetResource}|${r.filterKey}` === val
                            );
                            if (isAppend) {
                                setAppendRelationRecord(selected || null);
                            } else {
                                setNavigateToRelation(selected || null);
                            }
                        }}
                        filterOption={(input, option) => {
                            if (!option?.label) return false;
                            const searchLower = String(input).toLowerCase();
                            const labelLower = String(option.label).toLowerCase();
                            const navRel = navRelations.find(
                                (r) => `${r.targetResource}|${r.filterKey}` === option?.value
                            );
                            const modelLabelLower = (navRel?.modelLabel || "").toLowerCase();
                            return labelLower.includes(searchLower) || modelLabelLower.includes(searchLower);
                        }}
                        options={navRelations.map((r) => ({
                            label: `${r.label} → ${r.modelLabel}`,
                            value: `${r.targetResource}|${r.filterKey}`,
                        }))}
                        allowClear
                    />
                );
            })()}
            <Button
                type="primary"
                size="small"
                disabled={bulkActionsToApply.length === 0}
                onClick={() => {
                    if (bulkActionsToApply.includes("__append_related_list__") && appendRelationRecord) {
                        // Append related list below the current one
                        const records = bulkSelectedRowKeys.map((k) => bulkSelectedRowsMapRef.current.get(k)).filter(Boolean);
                        if (records.length === 0) return;
                        let filterIds: (string | number)[] = [];
                        if (appendRelationRecord.isForward) {
                            filterIds = records.map((r: any) => {
                                const pk = model.pkField || getRecordId(r);
                                return r[pk] ?? r.id ?? r.eid;
                            }).filter((v: any) => v !== undefined && v !== null);
                        } else {
                            const sourceKey = appendRelationRecord.sourceValueKey || appendRelationRecord.filterKey;
                            filterIds = records.map((r: any) => r[sourceKey]).filter((v: any) => v !== undefined && v !== null);
                        }
                        if (filterIds.length === 0) return;
                        const newEntry: AppendedListDef = {
                            id: `${appendRelationRecord.targetResource}-${Date.now()}`,
                            modelResource: appendRelationRecord.targetResource,
                            filterKey: appendRelationRecord.filterKey,
                            filterIds,
                            parentListId: null,
                        };
                        setAppendedLists((prev) => [...prev, newEntry]);
                        clearBulkSelection();
                        setBulkActionsToApply([]);
                        setAppendRelationRecord(null);
                    } else if (bulkActionsToApply.includes("__navigate_to_related__") && navigateToRelation) {
                        executeNavigateToRelated();
                    } else {
                        setBulkActionModalOpen(true);
                    }
                }}
            >
                {_("Apply")}
            </Button>
        </div>
    ) : null;

    const bulkConfirmationModal = (
        <Modal
            open={bulkActionModalOpen}
            title={_("Confirm bulk action")}
            onCancel={() => { if (!isBulkExecuting) setBulkActionModalOpen(false); }}
            footer={[
                <Button key="cancel" onClick={() => setBulkActionModalOpen(false)} disabled={isBulkExecuting}>
                    {_("Cancel")}
                </Button>,
                <Button key="ok" type="primary" loading={isBulkExecuting} onClick={executeBulkActions}>
                    {_("Confirm")}
                </Button>,
            ]}
        >
            <p>
                {_("You are about to apply the following actions to {count} rows:")
                    .replace("{count}", String(bulkSelectedRowKeys.length))}
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
                {bulkActionsToApply.map((actionKey) => {
                    const label = bulkActionsAvailable.find((a) => a && a.value === actionKey)?.label ?? actionKey;
                    const extra = actionKey === "__change_field__" && bulkChangeField
                        ? ` → ${bulkChangeField.label}: ${String(bulkChangeFieldValue ?? "")}`
                        : "";
                    return <li key={actionKey}>{label}{extra}</li>;
                })}
            </ul>
        </Modal>
    );

    const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
    const listTitle = !isEmbedded
        ? renderModelHeading({
            model,
            title: modelDisplayLabel,
            actionLabel: _("List"),
            moduleLabel: model.module ? getModuleLabel(model.module) : undefined,
        })
        : undefined;
    const numericBarColor = modelTone.soft || token.colorPrimaryBg || "rgba(22, 119, 255, 0.16)";
    const viewSelector = (
        <Select
            size="small"
            value={currentViewName}
            onChange={handleChangeViewName}
            loading={isLoadingViewNames}
            options={availableViewNames.map((name) => ({ label: name, value: name }))}
            style={{ minWidth: 180 }}
        />
    );

    const viewTabsNode = selectedViewNames.length > 1 && !isTotalsDetailsView ? (
        <Tabs
            size="small"
            activeKey={currentViewName}
            onChange={handleChangeViewName}
            items={selectedViewNames.map((name) => ({ key: name, label: renderToneTabLabel(name, modelTone) }))}
        />
    ) : null;


    const listToggleButton = (
        <Tooltip title={_("View list")}>
            <Button
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={() => {
                    markLayoutPrefsTouched();
                    setListVisible((prev) => !prev);
                }}
            />
        </Tooltip>
    );

    const exportButton = !isEmbedded ? (
        <Tooltip title={_("Export CSV")}>
            <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => setExportRequested(true)}
                loading={exportRequested && isAllRowsLoading}
            />
        </Tooltip>
    ) : null;

    const columnsToggleButton = (
        <Tooltip title={columnsSelectorOpen ? _("Hide view configuration") : _("Show view configuration")}>
            <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => {
                    setColumnsSelectorOpen((prev) => {
                        const next = !prev;
                        if (next) syncColumnsSelectionToDisplay();
                        return next;
                    });
                }}
                aria-label={columnsSelectorOpen ? _("Hide view configuration") : _("Show view configuration")}
            />
        </Tooltip>
    );

    const createRelationButton = isRelationView && showCreate ? (
        <Tooltip title={_("Add relation")}>
            <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                    e.preventDefault();
                    const params = new URLSearchParams();
                    if (filter) params.append(filter.field, String(filter.value));
                    const returnTo = `${location.pathname}${location.search}${location.hash}`;
                    if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                    const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
                    navigate(`/${resourcePath}/create?${params.toString()}`);
                }}
            />
        </Tooltip>
    ) : null;

    const associateExistingFkButton = isRelationView
        && showCreate
        && filter?.field
        && filter?.value !== undefined
        && filter?.value !== null
        && !relationConfig?.otherKey
        ? (
            <Tooltip title={_("Associate existing")}>
                <Button
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={(e) => {
                        e.preventDefault();
                        const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
                        const params = new URLSearchParams();
                        params.append("select_mode", "1");
                        params.append("select_mode_fk", "1");
                        params.append("relate_resource", resourcePath);
                        params.append("relate_target_key", String(filter!.field));
                        params.append("relate_target_id", String(filter!.value));
                        const returnTo = `${location.pathname}${location.search}${location.hash}`;
                        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                        navigate(`/${resourcePath}?${params.toString()}`);
                    }}
                />
            </Tooltip>
        )
        : null;
    const createNewAndRelateButton = isRelationView
        && showCreate
        && relationConfig?.otherResource
        && relationConfig?.otherKey
        && (relationConfig?.targetKey || filter?.field)
        && filter?.value !== undefined
        && filter?.value !== null
        ? (
            <Tooltip title={_("Create new and relate")}>
                <Button
                    size="small"
                    icon={<ShareAltOutlined />}
                    onClick={(e) => {
                        e.preventDefault();
                        const otherKey = relationConfig?.otherKey;
                        const targetKey = relationConfig?.targetKey || filter?.field;
                        const targetId = filter?.value;
                        if (!otherKey || !targetKey || targetId === undefined || targetId === null) return;
                        const params = new URLSearchParams();
                        const relationResource = relationConfig?.resourcePath || resolveResourcePath(relationConfig?.resource || model.name, allModels);
                        const relatedModel = findModelByName(allModels, relationConfig?.otherResource || relationConfig?.otherResourcePath);
                        const relatedResource = relatedModel
                            ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels)
                            : null;
                        if (!relatedResource) {
                            message.warning(_("No create route for the related model. Opening relation create form."));
                            params.append(targetKey, String(targetId));
                            const returnTo = `${location.pathname}${location.search}${location.hash}`;
                            if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                            navigate(`/${relationResource}/create?${params.toString()}`);
                            return;
                        }
                        params.append("relate_resource", relationResource);
                        params.append("relate_target_key", targetKey);
                        params.append("relate_other_key", otherKey);
                        params.append("relate_target_id", String(targetId));
                        const returnTo = `${location.pathname}${location.search}${location.hash}`;
                        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                        navigate(`/${relatedResource}/create?${params.toString()}`);
                    }}
                />
            </Tooltip>
        )
        : null;

    const embeddedActionBar = isEmbedded ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
            {columnsToggleButton}
            {listToggleButton}
            <Tooltip title={_("Analyze")}>
                <Button
                    size="small"
                    icon={<BarChartOutlined />}
                    onClick={() => {
                        markLayoutPrefsTouched();
                        analyzeTouchedRef.current = true;
                        setIsStatsFlipped(false);
                        setAnalyzeOpen((prev) => !prev);
                    }}
                />
            </Tooltip>
            <Tooltip title={_("Switch orientation")}>
                <Button
                    size="small"
                    icon={<ColumnHeightOutlined />}
                    onClick={() => {
                        markLayoutPrefsTouched();
                        setIsAnalyzeVertical((prev) => !prev);
                    }}
                />
            </Tooltip>
            <Tooltip title={_("Switch positions")}>
                <Button
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => {
                        markLayoutPrefsTouched();
                        setIsAnalyzeFirst((prev) => !prev);
                    }}
                />
            </Tooltip>
            {resolvedLayoutPreferenceType && (
                <Tooltip title={_("Save layout")}>
                    <Button
                        size="small"
                        icon={<SaveOutlined />}
                        onClick={() => openSaveViewModalFor("layout")}
                        loading={isSavingLayoutPrefs}
                    />
                </Tooltip>
            )}
            {associateExistingFkButton}
            {createRelationButton}
            {createNewAndRelateButton}
            <Tooltip title={_("Export CSV")}>
                <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => setExportRequested(true)}
                    loading={exportRequested && isAllRowsLoading}
                />
            </Tooltip>
        </div>
    ) : null;

    const listAnalyzeLayoutStyle: React.CSSProperties = {
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "nowrap",
        flexDirection: isAnalyzeVertical ? "column" : "row",
    };

    const listContainerStyle: React.CSSProperties = {
        flex: isAnalyzeVertical ? "1 1 auto" : "2 1 520px",
        minWidth: isAnalyzeVertical ? 0 : 360,
        width: isAnalyzeVertical ? "100%" : undefined,
        overflow: "auto",
        order: isAnalyzeFirst ? 2 : 1,
    };

    const analyzeContainerStyle: React.CSSProperties = {
        flex: isAnalyzeVertical ? "1 1 auto" : (listVisible ? "1 1 420px" : "1 1 520px"),
        minWidth: isAnalyzeVertical ? 0 : 360,
        width: isAnalyzeVertical ? "100%" : undefined,
        overflow: "visible",
        order: isAnalyzeFirst ? 1 : 2,
    };

    const renderGalleryItem = (record: any) => {
        const { resource, id } = getTargetInfo(record);
        const fileId = getGalleryItemId(record, id);
        const label = getGalleryItemLabel(record, fileId);
        const handleClick = () => {
            if (resource && id !== undefined && id !== null) {
                if (paneNav?.isInMultiPane) {
                    paneNav.openDetail(resource, id);
                } else {
                    go({ to: { resource, action: "show", id } });
                }
            }
        };
        return renderSharedGalleryCard({
            item: record,
            itemId: fileId,
            label,
            apiUrl,
            imageWidth: galleryImageWidth,
            imageHeight: galleryImageHeight,
            borderColor: token.colorBorder,
            textColor: token.colorText,
            onClick: resource && id !== undefined && id !== null ? handleClick : undefined,
        });
    };

    const galleryPageSize = typeof tablePagination === "object" && tablePagination?.pageSize
        ? tablePagination.pageSize
        : 10;
    const handleGalleryPageChange = useCallback((page: number, nextPageSize?: number) => {
        setGalleryPage(page);
        if (nextPageSize && nextPageSize !== pageSize) {
            setPageSize(nextPageSize);
        }
        if (!isClientFiltering) {
            if (typeof tableProps.onChange === "function") {
                tableProps.onChange({ current: page, pageSize: nextPageSize ?? pageSize }, {}, {} as any, {} as any);
                return;
            }
            const pagination = tableProps.pagination;
            if (typeof pagination === "object" && typeof pagination.onChange === "function") {
                pagination.onChange(page, nextPageSize ?? pageSize);
            }
        }
    }, [isClientFiltering, pageSize, tableProps]);
    const serverCurrentPage = !isClientFiltering && typeof tableProps.pagination === "object"
        ? Number(tableProps.pagination.current || 1)
        : 1;
    const serverTotal = !isClientFiltering && typeof tableProps.pagination === "object"
        ? Number(tableProps.pagination.total || 0)
        : 0;
    useEffect(() => {
        if (isClientFiltering) return;
        if (Number.isFinite(serverCurrentPage) && serverCurrentPage > 0 && serverCurrentPage !== galleryPage) {
            setGalleryPage(serverCurrentPage);
        }
    }, [galleryPage, isClientFiltering, serverCurrentPage]);
    const galleryRows = useMemo(() => {
        if (!isGalleryView) return [];
        if (!isClientFiltering) return filteredDataSource;
        const start = (galleryPage - 1) * galleryPageSize;
        return filteredDataSource.slice(start, start + galleryPageSize);
    }, [filteredDataSource, galleryPage, galleryPageSize, isClientFiltering, isGalleryView]);
    const galleryPaginationProps = useMemo(() => {
        if (!isGalleryView) return undefined;
        if (!isClientFiltering) {
            return {
                current: galleryPage,
                pageSize: galleryPageSize,
                total: Number.isFinite(serverTotal) ? serverTotal : undefined,
                hideOnSinglePage: typeof tablePagination === "object" ? tablePagination.hideOnSinglePage : true,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                onChange: handleGalleryPageChange,
                onShowSizeChange: handleGalleryPageChange,
            };
        }
        return {
            current: galleryPage,
            pageSize: galleryPageSize,
            total: filteredDataSource.length,
            hideOnSinglePage: true,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: handleGalleryPageChange,
            onShowSizeChange: handleGalleryPageChange,
        };
    }, [filteredDataSource.length, galleryPage, galleryPageSize, handleGalleryPageChange, isClientFiltering, isGalleryView, serverTotal, tablePagination]);
    const calendarDateFieldKeySet = useMemo(
        () => new Set(calendarDateFieldOptions.map((field) => field.key)),
        [calendarDateFieldOptions]
    );
    useEffect(() => {
        if (!isCalendarView) return;
        if (calendarDateField && calendarDateFieldKeySet.has(calendarDateField)) return;
        const fallback = calendarDateFieldOptions[0]?.key || "";
        if (fallback !== calendarDateField) setCalendarDateField(fallback);
    }, [calendarDateField, calendarDateFieldKeySet, calendarDateFieldOptions, isCalendarView]);
    const calendarEntries = useMemo(() => {
        if (!isCalendarView || !calendarDateField) return [];
        const entries: Array<{
            key: string | number;
            record: any;
            date: ReturnType<typeof dayjs>;
            resource: string | null;
            id: any;
            label: string;
        }> = [];
        filteredDataSource.forEach((record: any) => {
            const recordDate = getCalendarRecordDate(record, calendarDateField);
            if (!recordDate) return;
            const { resource, id } = getTargetInfo(record);
            entries.push({
                key: getRowKey(record),
                record,
                date: recordDate,
                resource,
                id,
                label: getRecordDisplayLabel(record),
            });
        });
        return entries;
    }, [calendarDateField, filteredDataSource, isCalendarView]);
    const calendarEarliestDateTs = useMemo(() => {
        if (calendarEntries.length === 0) return null;
        let earliest = calendarEntries[0].date.valueOf();
        for (let index = 1; index < calendarEntries.length; index += 1) {
            const value = calendarEntries[index].date.valueOf();
            if (value < earliest) earliest = value;
        }
        return earliest;
    }, [calendarEntries]);
    const calendarInitSignatureRef = useRef("");
    useEffect(() => {
        if (!isCalendarView) return;
        const signature = `${calendarDateField}|${calendarMode}|${calendarEarliestDateTs ?? "none"}`;
        if (calendarInitSignatureRef.current === signature) return;
        calendarInitSignatureRef.current = signature;
        if (calendarEarliestDateTs === null) {
            setCalendarAnchorDate(dayjs().startOf(calendarMode));
            return;
        }
        setCalendarAnchorDate(dayjs(calendarEarliestDateTs).startOf(calendarMode));
    }, [calendarDateField, calendarEarliestDateTs, calendarMode, isCalendarView]);
    const calendarEntriesByDate = useMemo(() => {
        const grouped = new Map<string, typeof calendarEntries>();
        calendarEntries.forEach((entry) => {
            const key = entry.date.format("YYYY-MM-DD");
            const existing = grouped.get(key) || [];
            existing.push(entry);
            grouped.set(key, existing);
        });
        return grouped;
    }, [calendarEntries]);
    const calendarRangeDays = useMemo(() => {
        const current = calendarAnchorDate.startOf(calendarMode);
        if (calendarMode === "week") {
            const start = current.startOf("week");
            return Array.from({ length: 7 }, (_unused, offset) => start.add(offset, "day"));
        }
        const start = current.startOf("month").startOf("week");
        const end = current.endOf("month").endOf("week");
        const totalDays = end.diff(start, "day") + 1;
        return Array.from({ length: totalDays }, (_unused, offset) => start.add(offset, "day"));
    }, [calendarAnchorDate, calendarMode]);
    const calendarPeriodLabel = useMemo(() => {
        if (calendarMode === "week") {
            const weekStart = calendarAnchorDate.startOf("week");
            const weekEnd = weekStart.endOf("week");
            return `${weekStart.format("MMM D, YYYY")} - ${weekEnd.format("MMM D, YYYY")}`;
        }
        return calendarAnchorDate.startOf("month").format("MMMM YYYY");
    }, [calendarAnchorDate, calendarMode]);
    const renderCalendarItem = (entry: (typeof calendarEntries)[number], index: number) => {
        if (!entry.resource || entry.id === undefined || entry.id === null) {
            return (
                <div key={`${entry.key}-${index}`} style={{ fontSize: 12, lineHeight: 1.3 }}>
                    {entry.label}
                </div>
            );
        }
        return (
            <a
                key={`${entry.key}-${index}`}
                href={getShowHref(entry.resource, entry.id, allModels)}
                style={{ display: "block", fontSize: 12, lineHeight: 1.3, color: token.colorLink, textDecoration: "none", wordWrap: "break-word", overflowWrap: "break-word" }}
                title={entry.label}
            >
                {entry.label}
            </a>
        );
    };
    const renderCalendarView = () => {
        if (calendarDateFieldOptions.length === 0) {
            return <Empty description={_("No date/datetime fields available for calendar view.")} />;
        }
        const selectedDateField = model.fields.find((field) => field.key === calendarDateField);
        const selectedLabel = selectedDateField?.label || calendarDateField;
        return (
            <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Space wrap size={8}>
                        <Select
                            size="small"
                            value={calendarMode}
                            onChange={(value: "month" | "week") => setCalendarMode(value)}
                            options={[
                                { label: _("Monthly"), value: "month" },
                                { label: _("Weekly"), value: "week" },
                            ]}
                            style={{ minWidth: 120 }}
                        />
                        <Select
                            size="small"
                            value={calendarDateField}
                            onChange={(value) => setCalendarDateField(value)}
                            options={calendarDateFieldOptions.map((field) => ({ label: field.label, value: field.key }))}
                            style={{ minWidth: 220 }}
                            placeholder={_("Date field")}
                        />
                    </Space>
                    <Space size={8}>
                        <Tooltip title={_("Previous")}>
                            <Button
                                size="small"
                                icon={<ArrowLeftOutlined />}
                                aria-label={_("Previous")}
                                onClick={() => setCalendarAnchorDate((prev) => prev.subtract(1, calendarMode).startOf(calendarMode))}
                            />
                        </Tooltip>
                        <Tooltip title={_("Today")}>
                            <Button
                                size="small"
                                icon={<CalendarOutlined />}
                                aria-label={_("Today")}
                                onClick={() => setCalendarAnchorDate(dayjs().startOf(calendarMode))}
                            />
                        </Tooltip>
                        <Tooltip title={_("Next")}>
                            <Button
                                size="small"
                                icon={<ArrowRightOutlined />}
                                aria-label={_("Next")}
                                onClick={() => setCalendarAnchorDate((prev) => prev.add(1, calendarMode).startOf(calendarMode))}
                            />
                        </Tooltip>
                    </Space>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>
                    {calendarPeriodLabel} {selectedLabel ? `- ${selectedLabel}` : ""}
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    {CALENDAR_WEEKDAYS.map((label) => (
                        <div
                            key={label}
                            style={{
                                padding: "6px 8px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: token.colorTextSecondary,
                                background: token.colorFillAlter,
                                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            }}
                        >
                            {label}
                        </div>
                    ))}
                    {calendarRangeDays.map((day) => {
                        const dayKey = day.format("YYYY-MM-DD");
                        const entries = calendarEntriesByDate.get(dayKey) || [];
                        const isOutsideCurrentMonth = calendarMode === "month" && day.month() !== calendarAnchorDate.month();
                        const isToday = day.isSame(dayjs(), "day");
                        return (
                            <div
                                key={dayKey}
                                style={{
                                    minHeight: 120,
                                    padding: 8,
                                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                                    borderRight: day.day() === 6 ? "none" : `1px solid ${token.colorBorderSecondary}`,
                                    background: isOutsideCurrentMonth ? token.colorFillAlter : token.colorBgContainer,
                                    opacity: isOutsideCurrentMonth ? 0.75 : 1,
                                    display: "grid",
                                    alignContent: "start",
                                    gap: 4,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: isToday ? 700 : 600,
                                        color: isToday ? token.colorPrimary : token.colorTextSecondary,
                                    }}
                                >
                                    {day.format("D")}
                                </div>
                                <div style={{ display: "grid", gap: 2 }}>
                                    {entries.map((entry, index) => renderCalendarItem(entry, index))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const listContent = (
        <>
            {embeddedActionBar}
            <Modal
                open={saveViewModalOpen}
                title={_("Save view")}
                onCancel={() => {
                    setSaveViewModalOpen(false);
                    setPendingSaveTarget(null);
                }}
                onOk={handleConfirmSaveView}
                okText={pendingSaveTarget === "layout" ? _("Save layout") : _("Save analyze")}
                okButtonProps={{ disabled: !pendingSaveTarget }}
            >
                <div style={{ display: "grid", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("View name")}</div>
                        <Input value={saveViewName} onChange={(event) => setSaveViewName(event.target.value)} />
                    </div>
                    <Checkbox checked={saveViewAsNew} onChange={(event) => setSaveViewAsNew(event.target.checked)}>
                        {_("Save as new view")}
                    </Checkbox>
                </div>
            </Modal>
            <Modal
                open={renameViewModalOpen}
                title={_("Rename view")}
                onCancel={() => setRenameViewModalOpen(false)}
                onOk={handleRenameView}
                okText={_("Rename")}
            >
                <Input value={renameViewName} onChange={(event) => setRenameViewName(event.target.value)} />
            </Modal>
            {viewTabsNode}
            {layoutPrefsReady && !filtersCollapsed && (
                <Card
                    size="small"
                    title={
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>{_("Filters")}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                                {!filtersCollapsed && searchField && (
                                    <Form
                                        {...searchFormProps}
                                        layout="inline"
                                        style={{ flex: 1, minWidth: 240 }}
                                        onFinish={(values) => {
                                            if (useLocalSearch && isClientFiltering) {
                                                setLocalSearch(values?.q ?? "");
                                                return;
                                            }
                                            searchFormProps.onFinish?.(values);
                                        }}
                                    >
                                        <Form.Item name="q" style={{ marginBottom: 0, width: "100%" }}>
                                            <Input placeholder={_("Search all fields...")} prefix={<SearchOutlined />} allowClear style={{ width: "100%" }} />
                                        </Form.Item>
                                    </Form>
                                )}
                            </div>
                        </div>
                    }
                    style={{ marginBottom: 16 }}
                    styles={{ body: { display: "grid", gap: 12 } }}
                >
                    <></>
            </Card>
            )}
            {columnsSelectorOpen && (
                <Card
                    size="small"
                    title={<span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>{_("View configuration")}</span>}
                    style={{ marginBottom: 16 }}
                    styles={{ body: { display: "grid", gap: 12 } }}
                >
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Advanced filters")}</div>
                            {filterRules.length === 0 ? (
                                <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{_("No filters yet.")}</div>
                            ) : (
                                filterRules.map((rule) => {
                                    const field = model.fields.find((f) => f.key === rule.fieldKey);
                                    const type = field?.type || "string";
                                    const operatorOptions = type === "number"
                                        ? [
                                            { label: _("="), value: "eq" },
                                            { label: _(">"), value: "gt" },
                                            { label: _(">="), value: "gte" },
                                            { label: _("<"), value: "lt" },
                                            { label: _("<="), value: "lte" },
                                            { label: _("Between"), value: "between" },
                                        ]
                                        : type === "date"
                                            ? [
                                                { label: _("On"), value: "on" },
                                                { label: _("After"), value: "after" },
                                                { label: _("Before"), value: "before" },
                                                { label: _("Between"), value: "between" },
                                            ]
                                            : type === "boolean"
                                                ? [{ label: _("Is"), value: "is" }]
                                                : [
                                                    { label: _("Contains"), value: "contains" },
                                                    { label: _("Equals"), value: "equals" },
                                                ];

                                    const renderDateInput = (value: any, onChange: (val: any) => void) => {
                                        const mode = value?.mode || "absolute";
                                        if (mode === "relative") {
                                            return (
                                                <Space wrap>
                                                    <InputNumber min={1} value={value?.count ?? 1} onChange={(val) => onChange({ ...value, mode: "relative", count: val ?? 1 })} />
                                                    <Select
                                                        value={value?.direction || "next"}
                                                        onChange={(val) => onChange({ ...value, mode: "relative", direction: val })}
                                                        options={[
                                                            { label: _("Previous"), value: "previous" },
                                                            { label: _("Current"), value: "current" },
                                                            { label: _("Next"), value: "next" },
                                                        ]}
                                                    />
                                                    <Select
                                                        value={value?.unit || "weeks"}
                                                        onChange={(val) => onChange({ ...value, mode: "relative", unit: val })}
                                                        options={[
                                                            { label: _("Days"), value: "days" },
                                                            { label: _("Weeks"), value: "weeks" },
                                                            { label: _("Months"), value: "months" },
                                                            { label: _("Quarters"), value: "quarters" },
                                                            { label: _("Years"), value: "years" },
                                                        ]}
                                                    />
                                                </Space>
                                            );
                                        }
                                        return (
                                            <DatePicker
                                                value={value?.date ? dayjs(value.date) : undefined}
                                                onChange={(val) => onChange({ mode: "absolute", date: val ? val.toISOString() : null })}
                                            />
                                        );
                                    };

                                    return (
                                        <div key={rule.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                            <Select
                                                style={{ minWidth: 180 }}
                                                value={rule.fieldKey}
                                                onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, fieldKey: value, operator: undefined, value: undefined, value2: undefined } : item))}
                                                options={model.fields.map((f) => ({ label: f.label, value: f.key }))}
                                                placeholder={_("Field")}
                                            />
                                            <Select
                                                style={{ minWidth: 140 }}
                                                value={rule.operator}
                                                onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, operator: value } : item))}
                                                options={operatorOptions}
                                                placeholder={_("Operator")}
                                            />
                                            {type === "number" && rule.operator === "between" && (
                                                <>
                                                    <InputNumber
                                                        value={rule.value}
                                                        onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                                                    />
                                                    <InputNumber
                                                        value={rule.value2}
                                                        onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: value } : item))}
                                                    />
                                                </>
                                            )}
                                            {type === "number" && rule.operator !== "between" && (
                                                <InputNumber
                                                    value={rule.value}
                                                    onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                                                />
                                            )}
                                            {type === "boolean" && (
                                                <Select
                                                    style={{ minWidth: 120 }}
                                                    value={rule.value}
                                                    onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                                                    options={[
                                                        { label: _("True"), value: true },
                                                        { label: _("False"), value: false },
                                                    ]}
                                                    placeholder={_("Value")}
                                                />
                                            )}
                                            {type === "date" && rule.operator === "between" && (
                                                <>
                                                    {renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item)))}
                                                    {renderDateInput(rule.value2, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: val } : item)))}
                                                </>
                                            )}
                                            {type === "date" && rule.operator !== "between" && (
                                                renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item)))
                                            )}
                                            {type === "string" && (
                                                <Input
                                                    value={rule.value}
                                                    onChange={(event) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item))}
                                                    placeholder={_("Value")}
                                                    style={{ minWidth: 200 }}
                                                />
                                            )}
                                            {type === "date" && (
                                                <Select
                                                    size="small"
                                                    value={rule.value?.mode || "absolute"}
                                                    onChange={(val) => {
                                                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: { ...(item.value || {}), mode: val } } : item));
                                                    }}
                                                    options={[
                                                        { label: _("Date"), value: "absolute" },
                                                        { label: _("Relative"), value: "relative" },
                                                    ]}
                                                />
                                            )}
                                            {type === "date" && rule.operator === "between" && (
                                                <Select
                                                    size="small"
                                                    value={rule.value2?.mode || "absolute"}
                                                    onChange={(val) => {
                                                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: { ...(item.value2 || {}), mode: val } } : item));
                                                    }}
                                                    options={[
                                                        { label: _("Date"), value: "absolute" },
                                                        { label: _("Relative"), value: "relative" },
                                                    ]}
                                                />
                                            )}
                                            <Button
                                                size="small"
                                                danger
                                                onClick={() => setFilterRules((prev) => prev.filter((item) => item.id !== rule.id))}
                                            >
                                                {_("Remove")}
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                                <Button
                                    size="small"
                                    icon={<FilterOutlined />}
                                    onClick={() => setFilterRules((prev) => [...prev, { id: `${Date.now()}-${Math.random()}` }])}
                                >
                                    {_("Add Filter")}
                                </Button>
                                {filterRules.length > 0 && (
                                    <Button size="small" onClick={() => setFilterRules([])}>
                                        {_("Clear filters")}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Views shown")}</div>
                            <Select
                                mode="multiple"
                                size="small"
                                value={selectedViewNames}
                                onChange={(values) => {
                                    const next = [
                                        ...selectedViewNames.filter((name) => (values as string[]).includes(name)),
                                        ...(values as string[]).filter((name) => !selectedViewNames.includes(name)),
                                    ];
                                    updateSelectedViewNames(next);
                                }}
                                loading={isLoadingViewNames}
                                options={availableViewNames.map((name) => ({ label: name, value: name }))}
                                style={{ minWidth: 240 }}
                            />
                            {selectedViewNames.length > 1 && (
                                <div style={{ display: "grid", gap: 6 }}>
                                    {selectedViewNames.map((name, index) => (
                                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ flex: 1 }}>{name}</div>
                                            <Tooltip title={_("Move up")}>
                                                <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveSelectedView(name, "up")} />
                                            </Tooltip>
                                            <Tooltip title={_("Move down")}>
                                                <Button size="small" icon={<ArrowDownOutlined />} disabled={index === selectedViewNames.length - 1} onClick={() => moveSelectedView(name, "down")} />
                                            </Tooltip>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Active view")}</div>
                            {viewSelector}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                            <Button
                                size="small"
                                onClick={() => {
                                    setRenameViewName(currentViewName);
                                    setRenameViewModalOpen(true);
                                }}
                            >
                                {_("Rename view")}
                            </Button>
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={availableViewNames.length <= 1}
                                onClick={confirmDeleteView}
                            >
                                {_("Delete view")}
                            </Button>
                            {resolvedLayoutPreferenceType && (
                                <Button
                                    size="small"
                                    icon={<SaveOutlined />}
                                    onClick={() => openSaveViewModalFor("layout")}
                                    loading={isSavingLayoutPrefs}
                                >
                                    {_("Save layout")}
                                </Button>
                            )}
                            <Button
                                size="small"
                                icon={<FilterOutlined />}
                                onClick={() => {
                                    markLayoutPrefsTouched();
                                    setFiltersCollapsed((prev) => !prev);
                                }}
                            >
                                {filtersCollapsed ? _("Show Filters") : _("Hide Filters")}
                            </Button>
                            <Button
                                size="small"
                                icon={<BarChartOutlined />}
                                onClick={() => {
                                    markLayoutPrefsTouched();
                                    analyzeTouchedRef.current = true;
                                    setIsStatsFlipped(false);
                                    setAnalyzeOpen((prev) => !prev);
                                }}
                            >
                                {_("Analyze")}
                            </Button>
                            <Button
                                size="small"
                                icon={<ColumnHeightOutlined />}
                                onClick={() => {
                                    markLayoutPrefsTouched();
                                    setIsAnalyzeVertical((prev) => !prev);
                                }}
                            >
                                {_("Switch orientation")}
                            </Button>
                            <Button
                                size="small"
                                icon={<SwapOutlined />}
                                onClick={() => {
                                    markLayoutPrefsTouched();
                                    setIsAnalyzeFirst((prev) => !prev);
                                }}
                            >
                                {_("Switch positions")}
                            </Button>
                        </div>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>{_("Columns")}</span>
                            {selectedColumnKeys && selectedColumnKeys.length > 0 && (
                                <Button size="small" onClick={() => { setSelectedColumnKeys(null); setColumnOrder(null); }}>
                                    {_("Reset to default")}
                                </Button>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Select columns")}</div>
                            <Checkbox.Group
                                value={selectedColumnKeys || []}
                                onChange={(values) => handleColumnSelectionChange(values as string[])}
                                options={allFieldOptions}
                            />
                            {(!selectedColumnKeys || selectedColumnKeys.length === 0) && (
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 6 }}>
                                    Using default columns. Select fields to customize.
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Column order")}</div>
                            {orderedSelectedColumns.length === 0 ? (
                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("No custom order yet.")}</div>
                            ) : (
                                orderedSelectedColumns.map((key, index) => {
                                    const field = model.fields.find((item) => item.key === key);
                                    if (!field) return null;
                                    return (
                                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <div style={{ flex: 1 }}>{field.label}</div>
                                            <Tooltip title={_("Move left")}>
                                                <Button size="small" icon={<ArrowLeftOutlined />} disabled={index === 0} onClick={() => moveColumnOrder(key, "left")} />
                                            </Tooltip>
                                            <Tooltip title={_("Move right")}>
                                                <Button size="small" icon={<ArrowRightOutlined />} disabled={index === orderedSelectedColumns.length - 1} onClick={() => moveColumnOrder(key, "right")} />
                                            </Tooltip>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {isTotalsDetailsView && (
                            <div>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Totals summary function")}</div>
                                <div style={{ display: "grid", gap: 6 }}>
                                    {totalsSummaryConfigFields.length === 0 ? (
                                        <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("No numeric fields available.")}</div>
                                    ) : totalsSummaryConfigFields.map((field) => {
                                        const options = [
                                            { label: _("Sum"), value: "sum" },
                                            { label: _("Average"), value: "avg" },
                                            { label: _("Count"), value: "count" },
                                            { label: _("Max"), value: "max" },
                                            { label: _("Min"), value: "min" },
                                            { label: _("Std Dev"), value: "stddev" },
                                        ];
                                        return (
                                            <div key={`summary-${field.key}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ flex: 1 }}>{field.label}</div>
                                                <Select
                                                    size="small"
                                                    style={{ minWidth: 150 }}
                                                    value={resolveTotalsSummaryFn(field)}
                                                    options={options}
                                                    onChange={(value) => {
                                                        markLayoutPrefsTouched();
                                                        setTotalsSummaryFunctions((prev) => ({ ...prev, [field.key]: value as TotalsSummaryFn }));
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}
            <div style={listAnalyzeLayoutStyle}>
                {listVisible && (
                    <div style={listContainerStyle}>
                    {isCalendarView ? (
                        renderCalendarView()
                    ) : isGalleryView ? (
                        <>
                            {galleryRows.length === 0 ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#bfbfbf", fontSize: 12 }}><FileTextOutlined style={{ fontSize: 16 }} />{_("No images available")}</div>
                            ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                                    {galleryRows.map((record) => renderGalleryItem(record))}
                                </div>
                            )}
                            {galleryPaginationProps && (
                                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                                    <Pagination {...galleryPaginationProps} />
                                </div>
                            )}
                        </>
                    ) : isCrosstabView ? (
                        crosstabBodyNode
                    ) : (
                        <>
                        {!selectMode && preFilterBanner}
                        {selectModeBanner}
                        {!selectMode && bulkActionsToolbar}
                        {renderDynamicListTotalsBoxes()}
                        {/* --- Row right-click context menu --- */}
                        {rowContextMenuVisible && createPortal(
                            <>
                                <style>{`
                                    body.jm-light .veloiq-ctx-menu.ant-card,
                                    body.jm-dark  .veloiq-ctx-menu.ant-card {
                                        background-color: revert !important;
                                    }
                                    body.jm-light .veloiq-ctx-menu .ant-menu,
                                    body.jm-dark  .veloiq-ctx-menu .ant-menu {
                                        background-color: revert !important;
                                        color: revert !important;
                                    }
                                    body.jm-light .veloiq-ctx-menu .ant-menu-item,
                                    body.jm-dark  .veloiq-ctx-menu .ant-menu-item {
                                        color: revert !important;
                                    }
                                `}</style>
                                <div
                                style={{
                                    position: "fixed",
                                    top: 0,
                                    left: 0,
                                    width: "100vw",
                                    height: "100vh",
                                    zIndex: 1050,
                                }}
                                onClick={() => setRowContextMenuVisible(false)}
                                onContextMenu={(e) => { e.preventDefault(); setRowContextMenuVisible(false); }}
                            >
                                <div
                                    className="veloiq-ctx-menu"
                                    style={{
                                        position: "fixed",
                                        top: rowContextMenuPosition.y,
                                        left: rowContextMenuPosition.x,
                                        zIndex: 1051,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                    <Card
                                        size="small"
                                        styles={{ body: { padding: 4 } }}
                                        style={{
                                            boxShadow: token.boxShadowSecondary,
                                            borderRadius: token.borderRadiusLG,
                                            minWidth: 220,
                                            borderColor: token.colorBorderSecondary,
                                        }}
                                    >
                                        <Menu
                                            style={{
                                                border: 'none',
                                            }}
                                            selectable={false}
                                            onClick={handleContextMenuClick}
                                            items={[
                                                { key: "__open_show__", label: _("Open show page"), icon: <EyeOutlined /> },
                                                { key: "__open_new_tab__", label: _("Open in new tab"), icon: <LinkOutlined /> },
                                                { key: "__open_new_window__", label: _("Open in new window"), icon: <LinkOutlined /> },
                                                { type: "divider" as const },
                                                ...(bulkActionsAvailable ?? []).map((action: any) => ({
                                                    key: action.value,
                                                    label: _(action.label),
                                                })),
                                            ]}
                                        />
                                    </Card>
                                </div>
                            </div>
                            </>,
                            document.body
                        )}
                        {(!isTotalsDetailsView || isTdFlipped) && <Table
                            {...tableProps}
                            className={isEmptyTable ? "compact-empty-table" : undefined}
                            dataSource={filteredDataSource}
                            pagination={tablePagination}
                            size="small"
                            scroll={{ x: true }}
                            locale={isEmptyTable ? { emptyText: null } : undefined}
                            rowKey={getRowKey}
                            rowSelection={internalRowSelection}
                            onRow={(record) => {
                                const { resource, id } = getTargetInfo(record);
                                return {
                                    onClick: (event) => handleRowClick(record, event),
                                    onContextMenu: (event) => handleRowRightClick(record, event),
                                    style: { cursor: resource && id !== undefined && id !== null ? "pointer" : "default" },
                                };
                            }}
                            onChange={(pagination, filters, sorter, extra) => {
                                const nextFilters: Record<string, string[]> = {};
                                Object.entries(filters || {}).forEach(([key, values]) => {
                                    if (!values) return;
                                    nextFilters[key] = (values as Array<string | number>).map((val) => String(val));
                                });
                                setColumnFiltersSelected(nextFilters);
                                if (extra?.action === "sort") {
                                    const sortIntent = sortIntentRef.current;
                                    sortIntentRef.current = null;
                                    setColumnSort((prev) => resolveNextColumnSort(prev, sorter, sortIntent));
                                } else {
                                    sortIntentRef.current = null;
                                }
                                // Range-encoded values are handled client-side via onFilter; strip
                                // them before forwarding to the backend to avoid type errors.
                                const isRangeEncoded = (v: unknown) => {
                                    const s = String(v ?? "");
                                    return s.startsWith("__range__:") || s.startsWith("__catrange__:") || s.startsWith("__daterange__:");
                                };
                                const serverFilters = Object.fromEntries(
                                    Object.entries(filters || {}).map(([k, vals]) => [
                                        k,
                                        vals?.some(isRangeEncoded) ? null : vals,
                                    ])
                                );
                                // Also explicitly evict any range values already sitting in Refine's
                                // activeFilters (e.g. from a stale URL or a previous render cycle
                                // before the stripping was in effect).
                                const cleanActiveFilters = (activeFilters || []).filter((f: any) => {
                                    const v = f.value;
                                    const vals = Array.isArray(v) ? v : [v];
                                    return !vals.some(isRangeEncoded);
                                });
                                if (cleanActiveFilters.length !== (activeFilters || []).length) {
                                    setFilters(cleanActiveFilters, "replace");
                                }
                                // eid is sorted client-side by its _label value; strip it from the
                                // server sorter so the backend isn't asked to sort by numeric eid.
                                const isEidSort = (s: any) => s?.field === "eid" || s?.columnKey === "eid";
                                const serverSorter = Array.isArray(sorter)
                                    ? sorter.filter((s) => !isEidSort(s))
                                    : isEidSort(sorter) ? [] : sorter;
                                tableProps.onChange?.(pagination, serverFilters, serverSorter, extra);
                            }}
                        >
                            {displayFields.map((field) => (
                                <Table.Column
                                    key={field.key}
                                    dataIndex={field.key}
                                    title={field.label}
                                    sorter={{ compare: (a, b) => compareSortValues(field, a, b), multiple: getSortPriority(columnSort, field.key) }}
                                    align={(field.type === "number" && !isReferenceField(field) && !isPkField(field, model)) ? "right" : undefined}
                                    filters={columnFilters.get(field.key)}
                                    filteredValue={columnFiltersSelected[field.key] || null}
                                    sortOrder={columnSort.find((item) => item.fieldKey === field.key)?.order ?? null}
                                    onFilterDropdownOpenChange={(visible) => {
                                        if (visible && !columnFilterDropdownEverOpened) {
                                            setColumnFilterDropdownEverOpened(true);
                                        }
                                    }}
                                    onHeaderCell={() => ({
                                        onClick: (event: React.MouseEvent) => {
                                            sortIntentRef.current = {
                                                fieldKey: field.key,
                                                additive: event.ctrlKey || event.metaKey,
                                            };
                                        },
                                    })}
                                    onFilter={(value, record: any) => matchesColumnFilterValue(field, record, value)}
                                    render={(value, record: any) => {
                                        const { resource, id } = getTargetInfo(record);
                                        const renderValue = () => {
                                            const showToken = normalizeFieldViewType(field.showViewType || "");
                                            if (showToken && !(showToken === "read-only-field" && field.reference)) {
                                                return renderFieldValue(field, record, allModels, true);
                                            }
                                            if (field.reference && value && hasReferenceModel(field.reference, allModels)) {
                                                return (
                                                    <ReferenceField
                                                        id={value}
                                                        resource={field.reference}
                                                        onLabel={(label) => handleReferenceLabel(field.reference!, value, label)}
                                                    />
                                                );
                                            }
                                            if (isPkField(field, model) && record._label) return record._label;
                                            if (field.type === 'boolean') return <Checkbox checked={value} disabled />;
                                            if (field.type === 'number' && !field.reference) {
                                                const formatted = formatNumberValue(value);
                                                const maxValue = numericColumnMaxes[field.key] ?? 0;
                                                return renderNumericValueBar(value, maxValue, formatted, numericBarColor);
                                            }
                                            if (field.type === 'date') return formatDateValue(value);
                                            if (field.type === 'datetime') return formatDateTimeValue(value) ?? value;
                                            if (field.type === 'time') return formatTimeValue(value);
                                            if (field.options) return renderOptionTag(field, value);
                                            return value;
                                        };
                                        // Reference cells render their own <a> (ReferenceField),
                                        // which navigates to the referenced record — don't wrap them
                                        // in the row-navigation <a> (invalid nested anchors).
                                        if (!id || !resource || field.reference) return renderValue();
                                        return (
                                            <a
                                                href={getShowHref(resource, id, allModels)}
                                                onClick={(e) => {
                                                    if (!shouldHandleLinkClick(e)) return;
                                                    e.preventDefault();
                                                    if (paneNav?.isInMultiPane) {
                                                        paneNav.openDetail(resource, id);
                                                    } else {
                                                        go({ to: { resource, action: "show", id } });
                                                    }
                                                }}
                                                style={{ cursor: "pointer", color: 'inherit', textDecoration: 'none' }}
                                            >
                                                {renderValue()}
                                            </a>
                                        );
                                    }}
                                />
                            ))}
                            {showActions && (
                                <Table.Column title={_("Actions")} key="actions" width={140}
                                              render={(_unused, record: any) => {
                                                  const { resource, id, isLinkRow } = getTargetInfo(record);
                                                  if (!id || !resource) return <Tooltip title={`${_("Debug: Cannot find target")}. ID: ${id}, Resource: ${resource}. Keys: ${Object.keys(record).join(",")}`}><Button size="small" danger icon={<BugOutlined />} /></Tooltip>;
                                                  const deleteResource = isLinkRow ? model.name : resource;
                                                  const deleteId = isLinkRow && relationConfig?.targetKey && relationConfig?.otherKey
                                                      ? `${record[relationConfig.targetKey]}:${record[relationConfig.otherKey]}`
                                                      : id;
                                                      return (
                                                      <Space>
                                                          <Tooltip title={_("View")}><Button size="small" icon={<EyeOutlined />} onClick={() => go({ to: { resource, action: "show", id } })} /></Tooltip>
                                                          <Tooltip title={_("Edit")}><Button size="small" icon={<EditOutlined />} onClick={() => go({ to: { resource, action: "edit", id } })} /></Tooltip>
                                                          <Tooltip title={_("Delete")}>
                                                              <DeleteButton hideText size="small" recordItemId={deleteId} resource={deleteResource} />
                                                          </Tooltip>
                                                      </Space>
                                                  );
                                              }}
                                />
                            )}
                        </Table>}
                        </>
                    )}
                    </div>
                )}
                {analyzeOpen && !isEmptyTable && analyzePrefsReady && (!isTotalsDetailsView || isTdFlipped) && (
                    <div style={analyzeContainerStyle}>
                        <Card
                            size="small"
                            title={<span style={{ color: modelTone.text, fontWeight: 600 }}>{_("Analyze")}</span>}
                            styles={{
                                header: {
                                    background: `linear-gradient(135deg, ${modelTone.solid}18 0%, ${modelTone.solid}0a 100%)`,
                                },
                                body: { padding: 0 },
                            }}
                        >
                            <div style={{ perspective: 1600, padding: 12 }}>
                                <div
                                    style={{
                                        display: "grid",
                                        transformStyle: "preserve-3d",
                                        transition: "transform 0.6s",
                                        transform: isStatsFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                                    }}
                                >
                                    <Card
                                        size="small"
                                        style={{
                                            gridArea: "1 / 1",
                                            backfaceVisibility: "hidden",
                                            pointerEvents: isStatsFlipped ? "none" : "auto",
                                        }}
                                        styles={{ body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } }}
                                    >
                                        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }}>
                                            <Tooltip title={_("Save preferences")}>
                                                <Button size="small" icon={<SaveOutlined />} onClick={() => openSaveViewModalFor("analyze")} loading={isSavingAnalyzePrefs} />
                                            </Tooltip>
                                            <Tooltip title={_("Stats")}>
                                                <Button size="small" icon={<FileTextOutlined />} onClick={() => setIsStatsFlipped(true)} />
                                            </Tooltip>
                                            <Tooltip title={_("Export chart PDF")}>
                                                <Button size="small" icon={<FilePdfOutlined />} onClick={exportChartPdf} />
                                            </Tooltip>
                                            <Tooltip title={_("Export chart PNG")}>
                                                <Button size="small" icon={<DownloadOutlined />} onClick={exportChartImage} aria-label={_("Export chart")} />
                                            </Tooltip>
                                        </div>
                                        <AnalysisChart
                                            data={chartData.groups}
                                            seriesKeys={chartData.seriesKeys}
                                            seriesLabels={chartData.seriesLabels}
                                            chartType={chartType}
                                            svgRef={chartSvgRef}
                                            animationKey={chartAnimationKey}
                                            animationStage={chartAnimationStage}
                                            rawRows={chartData.filteredRawRows}
                                            numericFields={numericFields}
                                            categoryField1={categoryField1}
                                            categoryField2={categoryField2}
                                            formatCategoryValue={formatCategoryValue}
                                            summaryFn={summaryFn}
                                            allFields={model.fields}
                                            title={chartTitle}
                                            numericBarColor={numericBarColor}
                                        />
                                        <Collapse
                                            size="small"
                                            defaultActiveKey={[]}
                                            items={[
                                                {
                                                    key: "configure-chart",
                                                    label: _("Customize chart"),
                                                    children: (
                                                        <div style={{ display: "grid", gap: 16 }}>
                                                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Category 1")}</div>
                                                                    <Select
                                                                        value={categoryField1 || undefined}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setCategoryField1(value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                                                        placeholder={_("Select category")}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Category 2")}</div>
                                                                    <Select
                                                                        value={categoryField2 || "__none__"}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setCategoryField2(value === "__none__" ? null : value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={[
                                                                            { label: _("None"), value: "__none__" },
                                                                            ...categoricalFields
                                                                                .filter((field) => field.key !== categoryField1)
                                                                                .map((field) => ({ label: field.label, value: field.key })),
                                                                        ]}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 160 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Chart Type")}</div>
                                                                    <Select
                                                                        value={chartType}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setChartType(value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={[
                                                                            { label: _("Area"), value: "area" },
                                                                            { label: _("Horizontal Area"), value: "area-horizontal" },
                                                                            { label: _("Bars"), value: "bar" },
                                                                            { label: _("Stacked Bars"), value: "stacked" },
                                                                            { label: _("Horizontal Bars"), value: "bar-horizontal" },
                                                                            { label: _("Horizontal Stacked"), value: "stacked-horizontal" },
                                                                            { label: _("Lines"), value: "line" },
                                                                            { label: _("Pie"), value: "pie" },
                                                                            { label: _("Donut"), value: "donut" },
                                                                            { label: _("Scatter"), value: "scatter" },
                                                                            { label: _("Bubble"), value: "bubble" },
                                                                            { label: _("Histogram"), value: "histogram" },
                                                                            { label: _("Box Plot"), value: "box" },
                                                                            { label: _("Waterfall"), value: "waterfall" },
                                                                            { label: _("Heatmap"), value: "heatmap" },
                                                                            { label: _("Crosstab"), value: "crosstab" },
                                                                            { label: _("Radar"), value: "radar" },
                                                                            { label: _("Combo (Bar + Line)"), value: "combo" },
                                                                            { label: _("3D Scatter"), value: "3d" },
                                                                        ]}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 200 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Summary")}</div>
                                                                    <Select
                                                                        value={summaryFn}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setSummaryFn(value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={[
                                                                            { label: _("Sum"), value: "sum" },
                                                                            { label: _("Average"), value: "avg" },
                                                                            { label: _("Count"), value: "count" },
                                                                            { label: _("Max"), value: "max" },
                                                                            { label: _("Min"), value: "min" },
                                                                            { label: _("Std Dev"), value: "stddev" },
                                                                        ]}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 180 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Ranking Filter")}</div>
                                                                    <Select
                                                                        value={rankingMode}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setRankingMode(value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={[
                                                                            { label: _("None"), value: "none" },
                                                                            { label: _("Top N"), value: "top" },
                                                                            { label: _("Bottom N"), value: "bottom" },
                                                                        ]}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 220 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("Ranking Column")}</div>
                                                                    <Select
                                                                        value={rankingFieldKey || undefined}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            setRankingFieldKey(value);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        options={numericFields.map((field) => ({ label: field.label, value: field.key }))}
                                                                        placeholder={_("Select numeric column")}
                                                                        disabled={rankingMode === "none" || numericFields.length === 0}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 120 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{_("N")}</div>
                                                                    <InputNumber
                                                                        min={1}
                                                                        value={rankingN}
                                                                        onChange={(value) => {
                                                                            markAnalyzePrefsTouched();
                                                                            const nextN = Number(value);
                                                                            setRankingN(Number.isFinite(nextN) && nextN > 0 ? Math.floor(nextN) : 10);
                                                                        }}
                                                                        style={{ width: "100%" }}
                                                                        disabled={rankingMode === "none"}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("Series")}</div>
                                                                    <Tooltip title={_("Unselect All")}>
                                                                        <Button
                                                                            size="small"
                                                                            icon={<CloseCircleOutlined />}
                                                                            onClick={() => {
                                                                                markAnalyzePrefsTouched();
                                                                                setSelectedSeriesKeys([]);
                                                                            }}
                                                                        />
                                                                    </Tooltip>
                                                                </div>
                                                                <Checkbox.Group
                                                                    value={selectedSeriesKeys || []}
                                                                    onChange={(values) => {
                                                                        markAnalyzePrefsTouched();
                                                                        setSelectedSeriesKeys(values as string[]);
                                                                    }}
                                                                    options={
                                                                        (numericFields.length > 0
                                                                            ? numericFields.map((field) => ({ label: field.label, value: field.key }))
                                                                            : [{ label: _("Count"), value: "__count__" }])
                                                                    }
                                                                />
                                                            </div>
                                                            {isAllRowsLoading && (
                                                                <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                                                                    {_("Loading all rows for analysis...")}
                                                                </div>
                                                            )}
                                                            {allRowsError && (
                                                                <div style={{ color: token.colorError, fontSize: 12 }}>
                                                                    {allRowsError}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </Card>
                                    <Card
                                        size="small"
                                        style={{
                                            gridArea: "1 / 1",
                                            backfaceVisibility: "hidden",
                                            transform: "rotateY(180deg)",
                                            pointerEvents: isStatsFlipped ? "auto" : "none",
                                        }}
                                        styles={{ body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } }}
                                    >
                                        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }}>
                                            <Tooltip title={_("Analysis")}>
                                                <Button size="small" icon={<BarChartOutlined />} onClick={() => setIsStatsFlipped(false)} />
                                            </Tooltip>
                                            <Tooltip title={_("Export stats PDF")}>
                                                <Button size="small" icon={<FilePdfOutlined />} onClick={exportStatsPdf} />
                                            </Tooltip>
                                        </div>
                                        <div style={{ display: "grid", gap: 16 }}>
                                            {statsSummary.numericStats.length > 0 && (
                                                <Card size="small" title={<span style={statsTitleStyle}>{_("Numeric columns")}</span>}>
                                                    <Table
                                                        dataSource={statsSummary.numericStats}
                                                        size="small"
                                                        pagination={false}
                                                        rowKey={(row) => row.key}
                                                    >
                                                        <Table.Column
                                                            title={_("Field")}
                                                            dataIndex="label"
                                                            key="label"
                                                            render={(label: string) => <span style={statsLabelStyle}>{label}</span>}
                                                            onHeaderCell={() => ({ style: statsHeaderStyle })}
                                                        />
                                                        <Table.Column title={_("Sum")} key="sum" align="right" render={(_unused, row: any) => renderStatBar(row.sum, statsNumericMaxes.sum, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                        <Table.Column title={_("Average")} key="avg" align="right" render={(_unused, row: any) => renderStatBar(row.avg, statsNumericMaxes.avg, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                        <Table.Column title={_("Min")} key="min" align="right" render={(_unused, row: any) => renderStatBar(row.min, statsNumericMaxes.min, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                        <Table.Column title={_("Max")} key="max" align="right" render={(_unused, row: any) => renderStatBar(row.max, statsNumericMaxes.max, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                        <Table.Column title={_("Std Dev")} key="stddev" align="right" render={(_unused, row: any) => renderStatBar(row.stddev, statsNumericMaxes.stddev, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                    </Table>
                                                </Card>
                                            )}
                                            {statsSummary.categoricalStats.length > 0 && (
                                                <Collapse
                                                    size="small"
                                                    defaultActiveKey={[]}
                                                    items={[
                                                        {
                                                            key: "categorical-columns",
                                                            label: <span style={statsTitleStyle}>{_("Categorical columns (distinct < 20)")}</span>,
                                                            children: statsSummary.categoricalStats.map((field) => (
                                                                <div key={field.key} style={{ marginBottom: 12 }}>
                                                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                                        <span style={statsLabelStyle}>{field.label}</span>
                                                                    </div>
                                                                    <Table
                                                                        dataSource={field.counts}
                                                                        size="small"
                                                                        pagination={false}
                                                                        rowKey={(row) => row.value}
                                                                    >
                                                                        <Table.Column title={_("Value")} dataIndex="value" key="value" onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                                        <Table.Column
                                                                            title={_("Count")}
                                                                            dataIndex="count"
                                                                            key="count"
                                                                            align="right"
                                                                            onHeaderCell={() => ({ style: statsHeaderStyle })}
                                                                            render={(value: number) => {
                                                                                const maxCount = Math.max(1, ...field.counts.map((entry) => entry.count));
                                                                                return renderStatBar(value, maxCount, (val) => formatNumberValue(val));
                                                                            }}
                                                                        />
                                                                    </Table>
                                                                </div>
                                                            )),
                                                        },
                                                    ]}
                                                />
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </>
    );

    // --- Render appended related-model lists stacked below the current one ---
    const appendedListsNodes = useMemo(() => {
        if (appendedLists.length === 0) return null;
        return appendedLists.map((entry) => {
            const relatedModel = findModelByName(allModels, entry.modelResource);
            if (!relatedModel) return null;
            const filterParam: Record<string, string> = {};
            filterParam[entry.filterKey + "__in"] = entry.filterIds.join(",");
            return (
                <div key={entry.id} style={{ marginTop: 24, borderTop: `2px solid ${token.colorBorderSecondary}`, paddingTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                            {relatedModel.label || relatedModel.name}
                            <Typography.Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
                                ({_("filtered by")} {entry.filterIds.length} {_("rows")})
                            </Typography.Text>
                        </Typography.Title>
                        <Button
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => setAppendedLists((prev) => prev.filter((e) => e.id !== entry.id))}
                        >
                            {_("Take this list out")}
                        </Button>
                    </div>
                    <DynamicList
                        model={relatedModel}
                        allModels={allModels}
                        filter={filterParam}
                        isEmbedded={true}
                        showCreate={false}
                    />
                </div>
            );
        });
    }, [appendedLists, allModels, token.colorBorderSecondary]);

    if (isEmbedded) return (
        <>
            {listContent}
            {appendedListsNodes}
            {bulkConfirmationModal}
        </>
    );

    const renderListHeaderButtons = ({ defaultButtons }: { defaultButtons: React.ReactNode }) => (
        <>
            {extraHeaderButtons}
            {metadataButton}
            {metadataModal}
            {columnsToggleButton}
            {listToggleButton}
            {exportButton}
            {/* Named queries have no create endpoint — suppress the Create button. */}
            {!model.isNamedQuery && renderIconOnlyButtons(defaultButtons)}
        </>
    );

    return (
        <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
            <ToneSharedStyles />
            {bulkConfirmationModal}
            {isRelationView ? (
                <VerticalActionsLayout position="top-right" onBarMount={setActionsBarEl}>
                    <List
                        title={renderWrappedPageTitle(listTitle)}
                        resource={model.resource || model.name}
                        headerButtons={() => null}
                    >
                        {listContent}
                        {appendedListsNodes}
                    </List>
                </VerticalActionsLayout>
            ) : (
                <StandardList
                    title={renderWrappedPageTitle(listTitle)}
                    resource={model.resource || model.name}
                    headerButtons={renderListHeaderButtons}
                >
                    {listContent}
                    {appendedListsNodes}
                </StandardList>
            )}
        </div>
    );
};
















export { DynamicShow } from "./pages/DynamicShow";
export { DynamicCreate } from "./pages/DynamicCreate";
export { DynamicEdit } from "./pages/DynamicEdit";
export { useStandardShowTabs } from "./hooks/useStandardShowTabs";
export { useStandardEditTabs } from "./hooks/useStandardEditTabs";
export { renderRelationBlock } from "./relations/renderRelationBlock";
export { useDataDetailLevel } from "./hooks/useDataDetailLevel";
export { DataDetailSlider } from "./DataDetailSlider";
export type { DataDetailLevelState } from "./hooks/useDataDetailLevel";

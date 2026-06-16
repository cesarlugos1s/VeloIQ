import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Collapse,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Spin,
    Switch,
    Table,
    Tabs,
    Tooltip,
    Typography,
    message,
    theme,
} from "antd";
import {
    ArrowDownOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined,
    ArrowUpOutlined,
    BarChartOutlined,
    ColumnHeightOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    FilterOutlined,
    PlusOutlined,
    SaveOutlined,
    SearchOutlined,
    SettingOutlined,
    ShareAltOutlined,
    SwapOutlined,
    UnorderedListOutlined,
} from "@ant-design/icons";
import { useApiUrl, useGo, useWarnAboutChange } from "@refinedev/core";
import { useLocation, useNavigate } from "react-router-dom";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";
import dayjs from "dayjs";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { useModelTone } from "../../../utils/modelTone";
import type { FieldDef, ModelDef, RelationDef } from "../types";
import { formatNumberValue, formatDateValue, escapeHtml } from "../utils/formatting";
import {
    normalizeFilterRules,
    normalizeColumnSortPreference,
    resolveNextColumnSort,
    getSortPriority,
} from "../utils/sorting";
import type { ColumnSortState, ColumnSortIntent, TotalsSummaryFn } from "../utils/sorting";
import {
    buildStatsHtml,
    buildStatsSummary,
    openPdfWindow,
    renderStatBar,
    renderNumericValueBar,
} from "../utils/statistics";
import { fetchPolymorphicGroups } from "../utils/polymorphic";
import {
    findModelByName,
    getListViewFields,
    getPolymorphicReferenceInfo,
    getRecordDisplayLabel,
    isPkField,
    isReferenceField,
    resolveModelByEntityType,
    resolveResourcePath,
} from "../utils/model";
import { getShowHref, shouldHandleLinkClick } from "../utils/navigation";
import {
    ToneSharedStyles,
    isDarkColor,
    renderOptionTag,
    renderToneTabLabel,
    toneScopeStyle,
} from "../utils/colors";
import { getDefaultViewName, normalizeViewName, normalizeFieldViewType, useViewSettings } from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import { renderFieldValue } from "../fields/renderFieldValue";
import { AnalysisChart } from "../analysis/AnalysisChart";
import { CrosstabTable } from "../analysis/CrosstabTable";
import { buildColumnFilterOptions, matchesColumnFilterValue } from "../utils/columnFilters";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const { Title } = Typography;

export const PolymorphicRelatedObjectsTable: React.FC<{
    rel: RelationDef;
    record: any;
    relationModel: ModelDef;
    parentModel?: ModelDef;
    allModels: ModelDef[];
    showActions?: boolean;
    showCreate?: boolean;
    allowInlineEdit?: boolean;
    layoutPreferenceType?: "ShowLayout" | "EditLayout";
    viewVariant?: "default" | "totals-details";
    viewMode?: "table" | "crosstab";
}> = ({ rel, record, relationModel, parentModel, allModels, showActions = false, showCreate = false, allowInlineEdit = false, layoutPreferenceType, viewVariant = "default", viewMode = "table" }) => {
    const recordId = record?.[parentModel?.pkField ?? "eid"] ?? record?.eid ?? record?.id;
    const apiUrl = useApiUrl();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupedIds, setGroupedIds] = useState<Map<string, Set<string | number>>>(new Map());
    const [unresolvedIds, setUnresolvedIds] = useState<Array<string | number>>([]);
    const polyInfo = useMemo(
        () => getPolymorphicReferenceInfo(rel, relationModel, allModels),
        [rel.otherKey, rel.otherResource, relationModel, allModels]
    );

    useEffect(() => {
        if (!recordId || !rel.otherKey || !polyInfo) {
            setGroupedIds(new Map());
            setUnresolvedIds([]);
            return;
        }
        let isMounted = true;
        const fetchGroups = async () => {
            setLoading(true);
            setError(null);
            try {
                const { groups, unresolved } = await fetchPolymorphicGroups({
                    apiUrl,
                    rel,
                    recordId: recordId,
                    referenceResource: polyInfo.referenceResource,
                    allModels,
                });
                if (isMounted) {
                    setGroupedIds(groups);
                    setUnresolvedIds(unresolved);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load related records");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchGroups();
        return () => {
            isMounted = false;
        };
    }, [apiUrl, recordId, rel.label, rel.otherKey, rel.resource, rel.targetKey, allModels, polyInfo?.referenceResource]);

    if (!polyInfo) return null;

    const fallbackModel = rel.polymorphicType
        ? resolveModelByEntityType(allModels, rel.polymorphicType)
        : undefined;
    const hasGroups = groupedIds.size > 0;

    return (
        <div>
            {loading && <Spin size="small" />}
            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
            {!loading && !error && !hasGroups && fallbackModel && (
                <RelatedObjectsTable
                    rel={{ ...rel, otherResource: fallbackModel.name, label: `${rel.label} (${fallbackModel.label})` }}
                    record={record}
                    relatedModel={fallbackModel}
                    showActions={showActions}
                    showCreate={showCreate}
                    allowInlineEdit={allowInlineEdit}
                    layoutPreferenceType={layoutPreferenceType}
                    viewVariant={viewVariant}
                    viewMode={viewMode}
                    allowedRelatedIds={new Set()}
                    allModels={allModels}
                />
            )}
            {Array.from(groupedIds.entries()).map(([resourceName, idSet]) => {
                const targetModel = findModelByName(allModels, resourceName);
                if (!targetModel) return null;
                const relForType: RelationDef = {
                    ...rel,
                    otherResource: resourceName,
                    label: `${rel.label} (${targetModel.label})`,
                };
                return (
                    <RelatedObjectsTable
                        key={`${rel.relationName || rel.resource}-${resourceName}`}
                        rel={relForType}
                        record={record}
                        relatedModel={targetModel}
                        showActions={showActions}
                        showCreate={showCreate}
                        allowInlineEdit={allowInlineEdit}
                        layoutPreferenceType={layoutPreferenceType}
                        viewVariant={viewVariant}
                        viewMode={viewMode}
                        allowedRelatedIds={idSet}
                        allModels={allModels}
                    />
                );
            })}
            {unresolvedIds.length > 0 && (
                <Alert
                    type="warning"
                    message={`${unresolvedIds.length} related records could not be resolved to a model type.`}
                    showIcon
                    style={{ marginTop: 12 }}
                />
            )}
        </div>
    );
};





export const RelatedObjectsTable: React.FC<{
    rel: RelationDef;
    record: any;
    relatedModel: ModelDef;
    parentModel?: ModelDef;
    showActions?: boolean;
    showCreate?: boolean;
    title?: React.ReactNode;
    allowInlineEdit?: boolean;
    allowedRelatedIds?: Set<string | number>;
    allModels?: ModelDef[];
    layoutPreferenceType?: "ShowLayout" | "EditLayout";
    viewVariant?: "default" | "totals-details";
    viewMode?: "table" | "crosstab";
}> = ({ rel, record, relatedModel, parentModel, showActions = false, showCreate = false, title, allowInlineEdit = false, allowedRelatedIds, allModels, layoutPreferenceType, viewVariant = "default", viewMode = "table" }) => {
    const isCrosstabView = viewMode === "crosstab";
    const recordId = record?.[parentModel?.pkField ?? "eid"] ?? record?.eid ?? record?.id;
    const apiUrl = useApiUrl();
    const go = useGo();
    const paneNav = usePaneNavigation();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = theme.useToken();
    const relatedModelTone = useModelTone(relatedModel);
    const relatedResourcePath = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
        color: relatedModelTone.solid,
        margin: 0,
    };
    const chartSvgRef = useRef<SVGSVGElement | null>(null);
    const skipNextAnimationRef = useRef(false);
    const [rows, setRows] = useState<any[]>([]);
    const [localSearch, setLocalSearch] = useState("");
    const [filterRules, setFilterRules] = useState<Array<{
        id: string;
        fieldKey?: string;
        operator?: string;
        value?: any;
        value2?: any;
    }>>([]);
    const [filtersCollapsed, setFiltersCollapsed] = useState(true);
    const [columnsSelectorOpen, setColumnsSelectorOpen] = useState(false);
    const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[] | null>(null);
    const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
    const [totalsSummaryFunctions, setTotalsSummaryFunctions] = useState<Record<string, TotalsSummaryFn>>({});
    const [columnFiltersSelected, setColumnFiltersSelected] = useState<Record<string, string[]>>({});
    const [columnSort, setColumnSort] = useState<ColumnSortState[]>([]);
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
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [serverTotalRows, setServerTotalRows] = useState(0);
    const [fullDataLoaded, setFullDataLoaded] = useState(false);
    const [relationRowsCapped, setRelationRowsCapped] = useState(false);
    const [loadedRowsCount, setLoadedRowsCount] = useState(0);
    const [loadAllRelatedRequested, setLoadAllRelatedRequested] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listVisible, setListVisible] = useState(true);
    const [isAnalyzeVertical, setIsAnalyzeVertical] = useState(false);
    const [isAnalyzeFirst, setIsAnalyzeFirst] = useState(false);
    const [labelCache, setLabelCache] = useState<Record<string, string>>({});
    const [analyzeOpen, setAnalyzeOpen] = useState(false);
    const analyzeTouchedRef = useRef(false);
    const analyzePrefsTouchedRef = useRef(false);
    const analyzePrefsLoadedRef = useRef(false);
    const [analyzePrefsReady, setAnalyzePrefsReady] = useState(false);
    const analyzePrefsResourceRef = useRef<string | null>(null);
    const [categoryField1, setCategoryField1] = useState<string | null>(null);
    const [categoryField2, setCategoryField2] = useState<string | null | undefined>(undefined);
    // Fields exposed as Excel-style multi-select filter dropdowns above the crosstab body.
    const [crosstabFilterFields, setCrosstabFilterFields] = useState<string[]>([]);
    // Live staged edits for editable-crosstab cells (recordId -> fieldKey -> value); mirrored
    // into the edit `form` so the existing Save button (saveAllEdits) persists them.
    const [crosstabStaged, setCrosstabStaged] = useState<Record<string, Record<string, number>>>({});
    const [chartType, setChartType] = useState<"bar" | "line" | "area" | "stacked" | "pie" | "donut" | "bar-horizontal" | "stacked-horizontal" | "area-horizontal" | "scatter" | "bubble" | "histogram" | "box" | "waterfall" | "heatmap" | "crosstab" | "radar" | "combo">("area");
    const [summaryFn, setSummaryFn] = useState<"sum" | "avg" | "count" | "max" | "min" | "stddev">("sum");
    const [selectedSeriesKeys, setSelectedSeriesKeys] = useState<string[] | null>(null);
    const [rankingMode, setRankingMode] = useState<"none" | "top" | "bottom">("none");
    const [rankingFieldKey, setRankingFieldKey] = useState<string | null>(null);
    const [rankingN, setRankingN] = useState<number>(10);
    const [exportRequested, setExportRequested] = useState(false);
    const [isStatsFlipped, setIsStatsFlipped] = useState(false);
    const [isSavingAnalyzePrefs, setIsSavingAnalyzePrefs] = useState(false);
    const [chartAnimationKey, setChartAnimationKey] = useState(0);
    const [chartAnimationStage, setChartAnimationStage] = useState<"enter" | "update">("enter");
    const [isTotalsDetailsFlipped, setIsTotalsDetailsFlipped] = useState(false);
    const defaultDisplayFields = useMemo(() => getListViewFields(relatedModel), [relatedModel]);
    const orderedColumnKeys = useMemo(() => {
        if (!selectedColumnKeys || selectedColumnKeys.length === 0) return null;
        const order = columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys;
        const selectedSet = new Set(selectedColumnKeys);
        const availableKeys = new Set(relatedModel.fields.map((field) => field.key));
        return order.filter((key) => selectedSet.has(key) && availableKeys.has(key));
    }, [columnOrder, relatedModel.fields, selectedColumnKeys]);
    const displayFields = useMemo(() => {
        if (!orderedColumnKeys) return defaultDisplayFields;
        const fieldMap = new Map(relatedModel.fields.map((field) => [field.key, field]));
        return orderedColumnKeys
            .map((key) => fieldMap.get(key))
            .filter((field): field is FieldDef => Boolean(field));
    }, [defaultDisplayFields, orderedColumnKeys, relatedModel.fields]);
    const numericBarColor = relatedModelTone.soft || token.colorPrimaryBg || "rgba(22, 119, 255, 0.16)";
    const [form] = Form.useForm();
    const [savingAll, setSavingAll] = useState(false);
    const [hasPendingEdits, setHasPendingEdits] = useState(false);
    const { setWarnWhen } = useWarnAboutChange();
    const [isSavingLayoutPrefs, setIsSavingLayoutPrefs] = useState(false);
    const layoutPrefsTouchedRef = useRef(false);
    const layoutPrefsLoadedRef = useRef(false);
    const layoutPrefsResourceRef = useRef<string | null>(null);
    const sortIntentRef = useRef<ColumnSortIntent>(null);
    const { settings: viewSettings } = useViewSettings();
    const relationsMaxRowsToLoad = Math.max(0, Number(viewSettings?.relationsMaxRowsToLoad ?? 1000));

    const markAnalyzePrefsTouched = useCallback(() => {
        analyzePrefsTouchedRef.current = true;
    }, []);

    const markLayoutPrefsTouched = useCallback(() => {
        layoutPrefsTouchedRef.current = true;
    }, []);

    const persistLayoutPreferences = useCallback(async (viewName: string) => {
        if (!layoutPreferenceType) return;
        const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
            totalsSummaryFunctions,
            columnFilters: columnFiltersSelected,
            columnSort: columnSort.length > 0 ? columnSort : null,
            custom_view_name: resolvedViewName,
        };
        setIsSavingLayoutPrefs(true);
        try {
            const targetTypes = layoutPreferenceType === "ShowLayout"
                ? ["ShowLayout", "EditLayout"]
                : layoutPreferenceType === "EditLayout"
                    ? ["EditLayout", "ShowLayout"]
                    : [layoutPreferenceType];
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
    }, [apiUrl, analyzeOpen, columnFiltersSelected, columnOrder, columnSort, filtersCollapsed, filterRules, isAnalyzeFirst, isAnalyzeVertical, layoutPreferenceType, listVisible, pageSize, selectedColumnKeys, relatedModel.name, relatedModel.resource, totalsSummaryFunctions, allModels]);

    const persistAnalyzePreferences = useCallback(async (viewName: string) => {
        const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, categoryField1, categoryField2, chartType, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, crosstabFilterFields, relatedModel.name, relatedModel.resource, allModels]);

    const categoricalFields = useMemo(() => {
        return relatedModel.fields.filter((field) => isPkField(field, relatedModel) || (field.type !== "number" || field.reference));
    }, [relatedModel]);

    const numericFields = useMemo(() => {
        return relatedModel.fields.filter((field) => !isPkField(field, relatedModel) && field.type === "number" && !field.reference);
    }, [relatedModel]);

    const resetLayoutDefaults = useCallback(() => {
        setListVisible(true);
        setAnalyzeOpen(false);
        setIsAnalyzeVertical(false);
        setIsAnalyzeFirst(false);
        setFiltersCollapsed(true);
        setPageSize(10);
        setSelectedColumnKeys(null);
        setColumnOrder(null);
    }, []);

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
            const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, relatedModel.name, relatedModel.resource, allModels]);

    const loadViewNames = useCallback(async () => {
        const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, relatedModel.name, relatedModel.resource, allModels]);

    const openSaveViewModalFor = useCallback((target: "layout" | "analyze") => {
        setSaveViewName(currentViewName || getDefaultViewName());
        setSaveViewAsNew(false);
        setPendingSaveTarget(target);
        setSaveViewModalOpen(true);
    }, [currentViewName]);

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
            const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, availableViewNames, currentViewName, relatedModel.name, relatedModel.resource, renameViewName, allModels, loadViewNames]);

    const confirmDeleteView = useCallback(() => {
        Modal.confirm({
            title: _(_("Delete view")),
            content: `Delete "${currentViewName}" and all its saved preferences?`,
            okText: _("Delete"),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, currentViewName, relatedModel.name, relatedModel.resource, allModels, loadViewNames]);

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

    const relatedViewTabsNode = selectedViewNames.length > 1 && viewVariant !== "totals-details" ? (
        <Tabs
            size="small"
            activeKey={currentViewName}
            onChange={handleChangeViewName}
            items={selectedViewNames.map((name) => ({ key: name, label: renderToneTabLabel(name, relatedModelTone) }))}
        />
    ) : null;

    useEffect(() => {
        loadViewNames();
    }, [loadViewNames]);

    useEffect(() => {
        if (!viewNamesLoaded) return;
        analyzePrefsTouchedRef.current = false;
        layoutPrefsTouchedRef.current = false;
        analyzePrefsLoadedRef.current = false;
        layoutPrefsLoadedRef.current = false;
        setColumnsSelectorOpen(false);
        setSaveViewName(currentViewName);
        setSaveViewAsNew(false);
        resetLayoutDefaults();
        resetAnalyzeDefaults();
    }, [currentViewName, resetAnalyzeDefaults, resetLayoutDefaults, viewNamesLoaded]);

    useEffect(() => {
        const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
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
    }, [apiUrl, currentViewName, relatedModel.name, relatedModel.resource, allModels]);

    useEffect(() => {
        if (!layoutPreferenceType) return;
        const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
        const viewKey = `${resourceKey}::${layoutPreferenceType}::${currentViewName}`;
        if (layoutPrefsResourceRef.current !== viewKey) {
            layoutPrefsLoadedRef.current = false;
            layoutPrefsResourceRef.current = viewKey;
        }
        if (layoutPrefsLoadedRef.current) return;
        let cancelled = false;
        const applyPrefs = (prefs: any) => {
            if (!prefs || typeof prefs !== "object") return false;
            // Embedded relation tables should always render the list body; do not hide it via saved layout prefs.
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
                    setCurrentPage(1);
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
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=${layoutPreferenceType}&custom_view_name=${encodeURIComponent(currentViewName)}`);
                if (!response.ok) {
                    throw new Error(`Load failed (${response.status})`);
                }
                const data = await response.json();
                if (cancelled || layoutPrefsTouchedRef.current) return;
                const prefs = data?.preferences;
                const applied = applyPrefs(prefs);
                if (!applied && layoutPreferenceType === "EditLayout") {
                    const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (cancelled || layoutPrefsTouchedRef.current) return;
                        applyPrefs(fallbackData?.preferences);
                    }
                } else if (!applied && layoutPreferenceType === "ShowLayout") {
                    const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (cancelled || layoutPrefsTouchedRef.current) return;
                        applyPrefs(fallbackData?.preferences);
                    }
                }
                layoutPrefsLoadedRef.current = true;
            } catch {
                // Silent failure on auto-load.
            }
        };
        loadPreferences();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, currentViewName, layoutPreferenceType, relatedModel.name, relatedModel.resource, allModels, viewNamesLoaded]);

    const normalizeFieldValue = useCallback((field: FieldDef, value: any) => {
        if (field.type === "date" && value) {
            if (typeof value?.toISOString === "function") return value.toISOString();
            if (typeof value?.format === "function") return value.format("YYYY-MM-DD");
        }
        return value;
    }, []);

    const hasActiveFilterRules = useMemo(() => {
        return filterRules.some((rule) => rule.fieldKey && rule.operator && (rule.value !== undefined && rule.value !== null && rule.value !== ""));
    }, [filterRules]);

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

    const getFieldValueForFilter = useCallback((field: FieldDef, recordRow: any) => {
        const raw = recordRow?.[field.key];
        if (raw === undefined || raw === null) return raw;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || raw;
        }
        if (field.options) {
            return field.options.find((option) => option.value === raw)?.label || raw;
        }
        return raw;
    }, [labelCache]);

    const matchesRule = useCallback((recordRow: any, rule: any) => {
        const field = relatedModel.fields.find((f) => f.key === rule.fieldKey);
        if (!field || !rule.operator) return true;
        const rawValue = getFieldValueForFilter(field, recordRow);
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

        if (field.type === "date") {
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
                    return time >= range.start.valueOf() && time <= range.end.valueOf();
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
    }, [getFieldValueForFilter, relatedModel.fields, resolveRelativeDate]);

    const applyGlobalSearch = useCallback((data: any[]) => {
        const query = localSearch.trim().toLowerCase();
        if (!query) return data;
        return data.filter((recordRow: any) => {
            const candidates = [
                recordRow?._label,
                ...relatedModel.fields.flatMap((field) => {
                    const value = recordRow?.[field.key];
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
    }, [labelCache, localSearch, relatedModel.fields]);

    const applyFilterRules = useCallback((data: any[]) => {
        if (!hasActiveFilterRules) return data;
        return data.filter((recordRow) => filterRules.every((rule) => matchesRule(recordRow, rule)));
    }, [filterRules, hasActiveFilterRules, matchesRule]);

    const filteredRows = useMemo(() => {
        return applyFilterRules(applyGlobalSearch(rows || []));
    }, [applyFilterRules, applyGlobalSearch, rows]);

    const columnFilteredRows = useMemo(() => {
        const activeEntries = Object.entries(columnFiltersSelected).filter(([, values]) => values && values.length > 0);
        if (activeEntries.length === 0) return filteredRows;
        return filteredRows.filter((row) =>
            activeEntries.every(([fieldKey, selectedValues]) => {
                const field = relatedModel.fields.find((f) => f.key === fieldKey);
                if (!field) return true;
                return selectedValues.some((value) => matchesColumnFilterValue(field, row, value));
            })
        );
    }, [filteredRows, columnFiltersSelected, relatedModel.fields]);

    useEffect(() => {
        setCurrentPage(1);
    }, [localSearch, filterRules]);

    useEffect(() => {
        if (!allowInlineEdit) return;
        if (form.isFieldsTouched()) return;
        const initialValues: Record<string, any> = {};
        rows.forEach((row) => {
            const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
            if (rowId === undefined || rowId === null) return;
            initialValues[rowId] = {};
            relatedModel.fields.forEach((field) => {
                initialValues[rowId][field.key] = row?.[field.key];
            });
        });
        form.setFieldsValue(initialValues);
    }, [allowInlineEdit, form, relatedModel.fields, filteredRows]);

    useEffect(() => {
        if (!allowInlineEdit) {
            setWarnWhen(false);
            return;
        }
        setWarnWhen(hasPendingEdits);
        return () => setWarnWhen(false);
    }, [allowInlineEdit, hasPendingEdits, setWarnWhen]);

    const saveAllEdits = useCallback(async () => {
        if (!allowInlineEdit) return;
        setSavingAll(true);
        try {
            const values = form.getFieldsValue(true) as Record<string, Record<string, any>>;
            const updates: Array<{ rowId: string | number; payload: Record<string, any> }> = [];

            rows.forEach((row) => {
                const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
                if (rowId === undefined || rowId === null) return;
                const rowValues = values?.[rowId];
                if (!rowValues) return;
                const payload: Record<string, any> = {};
                relatedModel.fields.forEach((field) => {
                    if (isPkField(field, relatedModel)) return;
                    if (!Object.prototype.hasOwnProperty.call(rowValues, field.key)) return;
                    const newVal = normalizeFieldValue(field, rowValues[field.key]);
                    const oldVal = normalizeFieldValue(field, row?.[field.key]);
                    const unchanged = (newVal === oldVal) || (newVal === null && oldVal === null) || (newVal === undefined && oldVal === undefined);
                    if (!unchanged) {
                        payload[field.key] = newVal;
                    }
                });
                if (Object.keys(payload).length > 0) {
                    updates.push({ rowId, payload });
                }
            });

            const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
            for (const update of updates) {
                const response = await authenticatedFetch(`${apiUrl}/${resource}/${update.rowId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(update.payload),
                });
                if (!response.ok) {
                    throw new Error(`Failed to update ${relatedModel.name}`);
                }
                const updated = await response.json();
                setRows((prev) =>
                    prev.map((item) => {
                        const itemId = item?.eid ?? item?.id ?? item?.__relationKey;
                        if (itemId !== update.rowId) return item;
                        return { ...item, ...updated };
                    })
                );
            }
            setHasPendingEdits(false);
            setCrosstabStaged({});
            message.success("Changes saved.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save changes");
        } finally {
            setSavingAll(false);
        }
    }, [allowInlineEdit, apiUrl, form, normalizeFieldValue, relatedModel.fields, relatedModel.name, relatedModel.resource, allModels, rows]);

    const handleDeleteRelationRow = useCallback((row: any) => {
        const relationRow = row?.__relationRow;
        const deleteId = relationRow && rel.targetKey && rel.otherKey
            ? `${relationRow["eid_from"]}:${relationRow["eid_to"]}`
            : relationRow?.id ?? relationRow?.eid;
        if (deleteId === undefined || deleteId === null) return;

        Modal.confirm({
            title: _("Delete"),
            content: _("Are you sure you want to delete this relation?"),
            okText: _("Delete"),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                    const response = await authenticatedFetch(`${apiUrl}/${relationResource}/${encodeURIComponent(String(deleteId))}`, {
                        method: "DELETE",
                    });
                    if (!response.ok) {
                        throw new Error(`Delete failed (${response.status})`);
                    }
                    const deletedRelationKey = row?.__relationKey;
                    setRows((prev) => prev.filter((item) => {
                        if (deletedRelationKey && item?.__relationKey === deletedRelationKey) {
                            return false;
                        }
                        const itemRelationRow = item?.__relationRow;
                        if (!itemRelationRow) return true;
                        const itemDeleteId = rel.targetKey && rel.otherKey
                            ? `${itemRelationRow[rel.targetKey]}:${itemRelationRow[rel.otherKey]}`
                            : itemRelationRow?.id ?? itemRelationRow?.eid;
                        return String(itemDeleteId) !== String(deleteId);
                    }));
                    message.success(_("Relation deleted."));
                } catch (err) {
                    message.error(err instanceof Error ? err.message : _("Failed to delete relation."));
                }
            },
        });
    }, [apiUrl, allModels, rel.otherKey, rel.resource, rel.resourcePath, rel.targetKey]);

    const renderEditableInput = (field: FieldDef, rowId?: string | number) =>
        renderInput(field, allModels, relatedModel, rowId);

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

    const getSortValue = useCallback((field: FieldDef, recordRow: any) => {
        const raw = recordRow?.[field.key];
        if (raw === undefined || raw === null) return null;
        if (isPkField(field, relatedModel) && recordRow?._label) return recordRow._label;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] ?? raw;
        }
        if (field.options) {
            return field.options.find((option) => option.value === raw)?.label ?? raw;
        }
        if (field.type === "date") {
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? raw : parsed.getTime();
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

    const shouldUseFullDataMode = useMemo(() => {
        if (loadAllRelatedRequested) return true;
        return false;
    }, [loadAllRelatedRequested]);

    const fetchRelatedDetailsByIds = useCallback(async (ids: any[], signal: AbortSignal) => {
        const uniqueIds = Array.from(new Set(ids.filter((value: any) => value !== undefined && value !== null)));
        if (!rel.otherResource || uniqueIds.length === 0) return [];

        const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
        try {
            const bulkResponse = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: relatedResource, ids: uniqueIds }),
                signal,
            });
            if (bulkResponse.ok) {
                const bulkData = await bulkResponse.json();
                if (Array.isArray(bulkData?.items)) {
                    return bulkData.items;
                }
            }
        } catch (bulkError) {
            if (bulkError instanceof DOMException && bulkError.name === "AbortError") {
                throw bulkError;
            }
        }

        const relatedRecords: any[] = [];
        const batchSize = 20;
        for (let index = 0; index < uniqueIds.length; index += batchSize) {
            const batch = uniqueIds.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch.map(async (id) => {
                try {
                    const relatedResponse = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`, { signal });
                    if (!relatedResponse.ok) {
                        console.warn(`Failed to load ${relatedResource} ${id}`);
                        return null;
                    }
                    return relatedResponse.json();
                } catch (fetchError) {
                    if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
                        throw fetchError;
                    }
                    console.warn(`Failed to load ${rel.otherResourcePath || rel.otherResource} ${id}`, fetchError);
                    return null;
                }
            }));
            relatedRecords.push(...batchResults.filter(Boolean));
        }
        return relatedRecords;
    }, [apiUrl, allModels, rel.otherResource, rel.otherResourcePath]);

    // --- PERFORMANCE TRACING ---
    const traceLog = (label: string, detail?: string) => {
        if (typeof window === 'undefined' || sessionStorage.getItem('jm_trace') !== '1') return;
        const now = performance.now();
        console.log(`[JM_TRACE ${now.toFixed(1)}ms] ${label}${detail ? ' | ' + detail : ''}`);
    };

    useEffect(() => {
        if (!recordId || !rel.otherResource || !rel.otherKey) {
            setRows([]);
            setServerTotalRows(0);
            setFullDataLoaded(false);
            setRelationRowsCapped(false);
            setLoadedRowsCount(0);
            setLoadAllRelatedRequested(false);
            return;
        }
        if (!shouldUseFullDataMode && rows.length > 0) {
            return;
        }
        if (shouldUseFullDataMode && fullDataLoaded) {
            return;
        }
        let isMounted = true;
        const controller = new AbortController();
        const { signal } = controller;
        const fetchRows = async () => {
            const fetchStart = performance.now();
            traceLog('RelatedObjectsTable', `fetchRows start rel=${rel.resource} targetKey=${rel.targetKey} eid=${recordId}`);
            setLoading(true);
            setError(null);
            try {
                const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                const relationFetchPageSize = 500;
                let relationRows: any[] = [];
                let relationTotal = 0;

                if (shouldUseFullDataMode) {
                    let start = 0;
                    while (true) {
                        const params = new URLSearchParams();
                        params.set("_start", String(start));
                        params.set("_end", String(start + relationFetchPageSize));
                        params.append(rel.targetKey, String(recordId));
                        const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
                        if (!relationResponse.ok) {
                            throw new Error(`Failed to load ${rel.label} relations`);
                        }
                        const pageRows = await relationResponse.json();
                        if (!Array.isArray(pageRows)) break;
                        relationRows = relationRows.concat(pageRows);
                        if (pageRows.length < relationFetchPageSize) break;
                        start += relationFetchPageSize;
                    }
                    relationTotal = relationRows.length;
                    if (isMounted) {
                        setRelationRowsCapped(false);
                    }
                } else {
                    const cap = Math.max(0, relationsMaxRowsToLoad);
                    let start = 0;
                    let totalFromHeader = 0;
                    while (cap === 0 || relationRows.length < cap) {
                        const remaining = cap > 0 ? cap - relationRows.length : relationFetchPageSize;
                        const fetchSize = Math.min(relationFetchPageSize, Math.max(remaining, 1));
                        const params = new URLSearchParams();
                        params.set("_start", String(start));
                        params.set("_end", String(start + fetchSize));
                        params.append(rel.targetKey, String(recordId));
                        const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
                        if (!relationResponse.ok) {
                            throw new Error(`Failed to load ${rel.label} relations`);
                        }
                        const totalHeader = Number(relationResponse.headers.get("x-total-count") || 0);
                        if (Number.isFinite(totalHeader) && totalHeader > 0) {
                            totalFromHeader = totalHeader;
                        }
                        const pageRows = await relationResponse.json();
                        if (!Array.isArray(pageRows) || pageRows.length === 0) break;
                        relationRows = relationRows.concat(pageRows);
                        if (pageRows.length < fetchSize) break;
                        start += fetchSize;
                    }
                    relationTotal = relationRows.length;
                    if (isMounted) {
                        const capped = (totalFromHeader > 0 && totalFromHeader > relationRows.length) || (cap > 0 && relationRows.length >= cap);
                        setRelationRowsCapped(capped);
                        setLoadedRowsCount(relationRows.length);
                    }
                }

                const relatedIds = relationRows
                    .map((row: any) => row?.[rel.otherKey as string])
                    .filter((value: any) => value !== undefined && value !== null);
                if (relatedIds.length === 0) {
                    if (isMounted) {
                        setRows([]);
                        setServerTotalRows(relationTotal);
                        if (shouldUseFullDataMode) {
                            setLoadedRowsCount(0);
                            setRelationRowsCapped(false);
                        }
                    }
                    return;
                }
                const filteredRelationRows = allowedRelatedIds
                    ? relationRows.filter((row: any) => allowedRelatedIds.has(row?.[rel.otherKey as string]))
                    : relationRows;
                const filteredRelatedIds = allowedRelatedIds
                    ? relatedIds.filter((value: any) => allowedRelatedIds.has(value))
                    : relatedIds;
                if (filteredRelatedIds.length === 0) {
                    if (isMounted) {
                        setRows([]);
                        setServerTotalRows(relationTotal);
                        if (shouldUseFullDataMode) {
                            setLoadedRowsCount(0);
                            setRelationRowsCapped(false);
                        }
                    }
                    return;
                }

                const relatedRecords = await fetchRelatedDetailsByIds(filteredRelatedIds, signal);
                const relatedById = new Map<any, any>(
                    relatedRecords.map((item) => [item?.eid ?? item?.id, item])
                );
                const mergedRows = filteredRelationRows
                    .map((relationRow: any, index: number) => {
                        const relatedId = relationRow?.[rel.otherKey as string];
                        const relatedRecord = relatedById.get(relatedId);
                        if (!relatedRecord) return null;
                        return {
                            ...relatedRecord,
                            __relationRow: relationRow,
                            __relationKey: `${relatedId ?? "unknown"}-${index}`,
                        };
                    })
                    .filter(Boolean);
                if (isMounted) {
                    setRows(mergedRows);
                    setServerTotalRows(shouldUseFullDataMode ? mergedRows.length : relationTotal);
                    setFullDataLoaded(shouldUseFullDataMode);
                    if (shouldUseFullDataMode) {
                        setLoadedRowsCount(mergedRows.length);
                        setRelationRowsCapped(false);
                    }
                }
                const fetchElapsed = performance.now() - fetchStart;
                traceLog('RelatedObjectsTable', `fetchRows done rel=${rel.resource} rows=${mergedRows.length} elapsed=${fetchElapsed.toFixed(0)}ms`);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load related records");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchRows();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [apiUrl, currentPage, pageSize, recordId, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, allowedRelatedIds, allModels, rel.resourcePath, rel.otherResourcePath, shouldUseFullDataMode, fetchRelatedDetailsByIds, fullDataLoaded, relationsMaxRowsToLoad, rows.length]);

    useEffect(() => {
        if (!shouldUseFullDataMode && fullDataLoaded) {
            setFullDataLoaded(false);
        }
    }, [fullDataLoaded, shouldUseFullDataMode]);

    useEffect(() => {
        if (loading) return;
        if (analyzeTouchedRef.current) return;
        if (filteredRows.length <= 1 && analyzeOpen) {
            setAnalyzeOpen(false);
        }
    }, [analyzeOpen, filteredRows.length, loading]);

    useEffect(() => {
        if (loading) return;
        if (analyzeTouchedRef.current) return;
        if (filteredRows.length > 1 && !analyzeOpen) {
            setAnalyzeOpen(true);
        }
    }, [analyzeOpen, filteredRows.length, loading]);

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

    const formatCategoryValue = useCallback((field: FieldDef | undefined, recordRow: any) => {
        if (!field) return _("All");
        const raw = recordRow?.[field.key];
        if (raw === undefined || raw === null) return "-";
        if (isPkField(field, relatedModel) && recordRow?._label) return recordRow._label;
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            return field.options.find((option) => option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        return String(raw);
    }, [labelCache]);

    const chartTitle = useMemo(() => {
        const cat1Label = categoryField1 ? relatedModel.fields.find((field) => field.key === categoryField1)?.label : "All";
        const cat2Label = categoryField2 ? relatedModel.fields.find((field) => field.key === categoryField2)?.label : null;
        const parts = [relatedModel.label || relatedModel.name, cat1Label];
        if (cat2Label) parts.push(cat2Label);
        return parts.filter(Boolean).join(" • ");
    }, [categoryField1, categoryField2, relatedModel.fields, relatedModel.label, relatedModel.name]);

    const chartData = useMemo(() => {
        const data = Array.isArray(columnFilteredRows) ? columnFilteredRows : [];
        const cat1Field = categoryField1 ? relatedModel.fields.find((field) => field.key === categoryField1) : undefined;
        const cat2Field = categoryField2 ? relatedModel.fields.find((field) => field.key === categoryField2) : undefined;
        const groupMap = new Map<string, { key: string; label: string; values: Record<string, number> }>();
        const rawSeriesKeys = numericFields.length > 0 ? numericFields.map((field) => field.key) : ["__count__"];
        const numericFieldMap = new Map<string, FieldDef>(
            numericFields.map((field) => [field.key, field])
        );
        const selectedSeriesKeysValid = (selectedSeriesKeys || []).filter((key) => {
            if (key === "__count__" && numericFields.length === 0) return true;
            return numericFieldMap.has(key);
        });
        const candidateSeriesKeys = selectedSeriesKeysValid.length > 0 ? selectedSeriesKeysValid : rawSeriesKeys;
        const rankingSeriesKey = rankingFieldKey && numericFieldMap.has(rankingFieldKey) ? rankingFieldKey : null;
        const aggregationKeys = Array.from(new Set([...(candidateSeriesKeys || []), ...(rankingSeriesKey ? [rankingSeriesKey] : [])]));
        const statsMap = new Map<string, Record<string, number[]>>();
        data.forEach((recordRow: any) => {
            const cat1Value = formatCategoryValue(cat1Field, recordRow);
            const cat2Value = cat2Field ? formatCategoryValue(cat2Field, recordRow) : null;
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
                    const value = Number(recordRow?.[field.key]);
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
        const baseGroups = Array.from(groupMap.values());
        const seriesKeys = candidateSeriesKeys;
        const seriesLabels = numericFields.length > 0
            ? numericFields.reduce<Record<string, string>>((acc, field) => {
                acc[field.key] = field.label;
                return acc;
            }, { "__count__": _("Count") })
            : { "__count__": _("Count") };
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
        const filteredRawRows = data.filter((recordRow: any) => {
            const cat1Value = formatCategoryValue(cat1Field, recordRow);
            const cat2Value = cat2Field ? formatCategoryValue(cat2Field, recordRow) : null;
            const label = cat2Field ? `${cat1Value} • ${cat2Value}` : `${cat1Value}`;
            return allowedGroupKeys.has(label);
        });
        return {
            groups,
            seriesKeys,
            seriesLabels,
            filteredRawRows,
        };
    }, [columnFilteredRows, categoryField1, categoryField2, relatedModel.fields, numericFields, formatCategoryValue, summaryFn, selectedSeriesKeys, rankingMode, rankingFieldKey, rankingN]);

    // ---- Crosstab view body --------------------------------------------------
    const editableCrosstab = isCrosstabView && allowInlineEdit;

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
        // Mirror into the edit form so the existing Save button (saveAllEdits) persists it.
        updates.forEach(({ recordId, fieldKey, value }) => {
            form.setFieldValue([recordId, fieldKey], value);
        });
        setHasPendingEdits(true);
    }, [form]);

    const getCrosstabStagedValue = useCallback((recordId: string | number, fieldKey: string) => {
        return crosstabStaged[String(recordId)]?.[fieldKey];
    }, [crosstabStaged]);

    // Resolve FK display labels (dc_title) for reference fields used as crosstab categories/filters.
    const crosstabResolvedRefIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!isCrosstabView) return;
        const refFields = [categoryField1, categoryField2, ...crosstabFilterFields]
            .filter((k): k is string => Boolean(k))
            .map((k) => relatedModel.fields.find((f) => f.key === k))
            .filter((f): f is FieldDef => Boolean(f && f.reference));
        if (refFields.length === 0) return;
        const data = columnFilteredRows || [];
        let cancelled = false;
        (async () => {
            for (const field of refFields) {
                const resourcePath = field.referencePath || resolveResourcePath(field.reference as string, allModels);
                const ids = Array.from(new Set(data.map((r) => r?.[field.key]).filter((v) => v !== undefined && v !== null)))
                    .filter((id) => !crosstabResolvedRefIdsRef.current.has(`${field.reference}:${id}`));
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
                            setLabelCache((prev) => {
                                const key = `${field.reference}:${id}`;
                                return prev[key] === String(label) ? prev : { ...prev, [key]: String(label) };
                            });
                        } catch {
                            // best-effort
                        }
                    }));
                }
            }
        })();
        return () => { cancelled = true; };
    }, [isCrosstabView, categoryField1, categoryField2, crosstabFilterFields, columnFilteredRows, relatedModel.fields, allModels, apiUrl]);

    // Filter dropdown options for the crosstab filter fields (full range grouping, independent of columns).
    const crosstabFilterOptions = useMemo(() => {
        if (crosstabFilterFields.length === 0) return new Map<string, { text: string; value: string }[]>();
        const rangeCount = viewSettings?.maxDistinctColumnFilterValuesToRanges ?? 20;
        const fields = crosstabFilterFields
            .map((k) => relatedModel.fields.find((f) => f.key === k))
            .filter((f): f is FieldDef => Boolean(f));
        return buildColumnFilterOptions({ fields, data: filteredRows || [], rangeCount });
    }, [crosstabFilterFields, filteredRows, viewSettings, relatedModel.fields]);

    const crosstabFilterRow = crosstabFilterFields.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {crosstabFilterFields.map((fieldKey) => {
                const field = relatedModel.fields.find((f) => f.key === fieldKey);
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
                                    options={relatedModel.fields.filter((field) => !isPkField(field, relatedModel)).map((field) => ({ label: field.label, value: field.key }))}
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

    const crosstabBodyNode = (
        <div>
            {crosstabConfigPanel}
            {crosstabFilterRow}
            <CrosstabTable
                rows={columnFilteredRows}
                rowField={categoryField1}
                colField={categoryField2 ?? null}
                cellFieldKeys={(selectedSeriesKeys && selectedSeriesKeys.length > 0) ? selectedSeriesKeys : numericFields.map((f) => f.key)}
                cellFieldLabels={Object.fromEntries(relatedModel.fields.map((f) => [f.key, f.label]))}
                allFields={relatedModel.fields}
                allModels={allModels}
                summaryFn={summaryFn}
                formatCategoryValue={formatCategoryValue}
                numericBarColor={numericBarColor}
                editable={editableCrosstab ? {
                    pkField: relatedModel.pkField || "eid",
                    getStagedValue: getCrosstabStagedValue,
                    onCommitCell: stageCrosstabCellEdits,
                    confirmProration: true,
                } : undefined}
            />
        </div>
    );

    const numericColumnMaxes = useMemo(() => {
        const maxes: Record<string, number> = {};
        const data = filteredRows || [];
        displayFields.forEach((field) => {
            if (field.type !== "number" || field.reference) return;
            const values = data
                .map((row) => Number(row?.[field.key]))
                .filter((value) => !Number.isNaN(value) && Number.isFinite(value));
            if (values.length === 0) {
                maxes[field.key] = 0;
                return;
            }
            maxes[field.key] = Math.max(...values.map((val) => Math.abs(val)));
        });
        return maxes;
    }, [filteredRows, displayFields]);

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

    const formatValueForExport = useCallback((field: FieldDef, recordRow: any) => {
        const raw = recordRow?.[field.key];
        if (raw === undefined || raw === null) return "";
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            return field.options.find((option) => option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        return String(raw);
    }, [labelCache]);

    useEffect(() => {
        if (!exportRequested) return;
        const escapeCsv = (value: string) => {
            if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
                return `"${value.replace(/"/g, "\"\"")}"`;
            }
            return value;
        };
        const headers = relatedModel.fields.map((field) => field.label);
        const csvRows = filteredRows.map((recordRow) => {
            return relatedModel.fields.map((field) => escapeCsv(formatValueForExport(field, recordRow)));
        });
        const csv = [headers.map(escapeCsv).join(","), ...csvRows.map((row) => row.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${relatedModel.name}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExportRequested(false);
    }, [exportRequested, filteredRows, relatedModel.fields, relatedModel.name, formatValueForExport]);

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
                link.download = `${relatedModel.name}-chart.png`;
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
            const chartHeading = chartTitle || `${relatedModel.label} Chart`;
            openPdfWindow(
                `${relatedModel.name}-chart`,
                `<h2>${escapeHtml(chartHeading)}</h2><img src="${dataUrl}" style="width: 100%; height: auto;" />`
            );
        };
        img.src = url;
    };
    const exportStatsPdf = () => {
        openPdfWindow(`${relatedModel.name}-stats`, buildStatsHtml(statsSummary));
    };

    const columnFilters = useMemo(() => {
        // Build grouped filter options (ranges past the distinct threshold) from the loaded
        // rows. The loaded set is capped by relationsMaxRowsToLoad; the "Load all related"
        // banner surfaces when capped so the user knows values may be partial.
        const rangeCount = viewSettings?.maxDistinctColumnFilterValuesToRanges ?? 20;
        return buildColumnFilterOptions({ fields: displayFields, data: filteredRows || [], rangeCount });
    }, [displayFields, filteredRows, viewSettings]);

    const allFieldOptions = useMemo(() => {
        return relatedModel.fields.map((field) => ({ label: field.label, value: field.key }));
    }, [relatedModel.fields]);

    const orderedSelectedColumns = useMemo(() => {
        if (!selectedColumnKeys || selectedColumnKeys.length === 0) return [];
        return orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : selectedColumnKeys;
    }, [orderedColumnKeys, selectedColumnKeys]);

    const syncColumnsSelectionToDisplay = useCallback(() => {
        const keys = displayFields.map((field) => field.key);
        if (keys.length === 0) return;
        setSelectedColumnKeys(keys);
        setColumnOrder(columnOrder && columnOrder.length > 0 ? columnOrder : keys);
    }, [columnOrder, displayFields]);

    useEffect(() => {
        if (selectedColumnKeys !== null) return;
        const defaults = defaultDisplayFields.map((field) => field.key);
        if (defaults.length === 0) return;
        setSelectedColumnKeys(defaults);
        setColumnOrder(defaults);
    }, [defaultDisplayFields, selectedColumnKeys]);

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

    const statsSummary = useMemo(() => {
        return buildStatsSummary(columnFilteredRows, displayFields, labelCache);
    }, [columnFilteredRows, displayFields, labelCache]);
    const isTotalsDetailsVariant = viewVariant === "totals-details";
    const getDefaultTotalsSummaryFn = useCallback((field: FieldDef): TotalsSummaryFn => {
        if (isPkField(field, relatedModel)) return "count";
        return "sum";
    }, [relatedModel]);
    const resolveTotalsSummaryFn = useCallback((field: FieldDef): TotalsSummaryFn => {
        return totalsSummaryFunctions[field.key] || getDefaultTotalsSummaryFn(field);
    }, [getDefaultTotalsSummaryFn, totalsSummaryFunctions]);
    const computeTotalsSummaryValue = useCallback((field: FieldDef): number => {
        const fn = resolveTotalsSummaryFn(field);
        const rawValues = filteredRows.map((row) => row?.[field.key]);
        if (field.type === "number" && !field.reference) {
            const numericValues = rawValues
                .map((value) => Number(value))
                .filter((value) => !Number.isNaN(value) && Number.isFinite(value));
            if (fn === "count") return numericValues.length;
            if (numericValues.length === 0) return 0;
            if (fn === "avg") return numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
            if (fn === "max") return Math.max(...numericValues);
            if (fn === "min") return Math.min(...numericValues);
            if (fn === "stddev") {
                const mean = numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
                const variance = numericValues.reduce((acc, val) => acc + (val - mean) ** 2, 0) / numericValues.length;
                return Math.sqrt(variance);
            }
            return numericValues.reduce((acc, val) => acc + val, 0);
        }
        if (fn === "distinct") {
            const distinct = new Set(rawValues.map((value) => String(value ?? "-")));
            return distinct.size;
        }
        return rawValues.length;
    }, [filteredRows, resolveTotalsSummaryFn]);
    const formatCategoricalBoxValue = useCallback((field: FieldDef, raw: any) => {
        if (raw === undefined || raw === null) return "-";
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            return field.options.find((option) => option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        return String(raw);
    }, [labelCache]);
    const totalsDetailsCategoricalBoxes = useMemo(() => {
        return displayFields
            .filter((field) => field.type !== "number" || Boolean(field.reference))
            .map((field) => {
                const counts = new Map<string, number>();
                filteredRows.forEach((row) => {
                    const label = formatCategoricalBoxValue(field, row?.[field.key]);
                    counts.set(label, (counts.get(label) || 0) + 1);
                });
                const breakdown = Array.from(counts.entries())
                    .map(([value, count]) => ({ value, count }))
                    .sort((a, b) => b.count - a.count);
                const showBreakdown = breakdown.length > 0 && breakdown.length < 5;
                return {
                    key: field.key,
                    label: field.label,
                    value: breakdown.length,
                    breakdown,
                    showBreakdown,
                };
            });
    }, [displayFields, filteredRows, formatCategoricalBoxValue]);
    const totalsDetailsNumericBoxes = useMemo(() => {
        return displayFields
            .filter((field) => field.type === "number" && !field.reference)
            .map((field) => {
                return {
                    key: field.key,
                    label: field.label,
                    value: computeTotalsSummaryValue(field),
                    summaryFn: resolveTotalsSummaryFn(field),
                };
            });
    }, [computeTotalsSummaryValue, displayFields, resolveTotalsSummaryFn]);
    const totalsSummaryConfigFields = useMemo(() => {
        return displayFields.filter((field) => field.type === "number" && !field.reference);
    }, [displayFields]);

    useEffect(() => {
        setTotalsSummaryFunctions((prev) => {
            const next = { ...prev };
            let changed = false;
            totalsSummaryConfigFields.forEach((field) => {
                if (!next[field.key]) {
                    next[field.key] = getDefaultTotalsSummaryFn(field);
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [getDefaultTotalsSummaryFn, totalsSummaryConfigFields]);

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
        if (isTotalsDetailsVariant) {
            setIsTotalsDetailsFlipped(false);
        }
    }, [currentViewName, isTotalsDetailsVariant]);

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;

    const getSummaryFunctionDisplayText = (fn?: TotalsSummaryFn) => {
        if (!fn) return "";
        const labels: Record<TotalsSummaryFn, string> = {
            sum: _("Sum"),
            avg: _("Average"),
            count: _("Count"),
            max: _("Max"),
            min: _("Min"),
            stddev: _("Std Dev"),
            distinct: _("Distinct"),
        };
        return labels[fn] || fn;
    };

    const renderTotalsBoxes = (keyPrefix = "") => {
        const hasCategoricalBoxes = totalsDetailsCategoricalBoxes.length > 0;
        const hasNumericBoxes = totalsDetailsNumericBoxes.length > 0;
        if (!hasCategoricalBoxes && !hasNumericBoxes) return null;
        const categoricalTone = {
            soft: "#fde68a",
            softer: "#fffbeb",
            text: "#92400e",
            chipBg: "#ffffff",
        };
        const numericTone = relatedModelTone;
        return (
            <div style={{ marginBottom: 12, borderRadius: 8, padding: 10, background: token.colorBgContainer }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ overflowX: "auto", paddingBottom: 2, flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                width: "max-content",
                                minWidth: "100%",
                                display: "flex",
                                justifyContent: "center",
                                gap: 12,
                                alignItems: "stretch",
                            }}
                        >
                            {hasCategoricalBoxes && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }}>
                                    {totalsDetailsCategoricalBoxes.map((item) => (
                                        <Card
                                            key={`${keyPrefix}${item.key}`}
                                            size="small"
                                            variant="borderless"
                                            style={{ minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${categoricalTone.softer} 0%, ${categoricalTone.soft} 100%)` }}
                                            styles={{ body: { padding: 10 } }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 400, color: categoricalTone.text, textAlign: "center", marginTop: 2 }}>
                                                {item.label}
                                            </div>
                                            {item.showBreakdown ? (
                                                <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                                                    {item.breakdown.map((entry) => (
                                                        <div
                                                            key={`${keyPrefix}${item.key}-${entry.value}`}
                                                            style={{
                                                                fontSize: 12,
                                                                color: categoricalTone.text,
                                                                fontWeight: 400,
                                                                textAlign: "center",
                                                                borderRadius: 8,
                                                                background: categoricalTone.chipBg,
                                                                padding: "2px 8px",
                                                            }}
                                                        >
                                                            {`${entry.value}: ${formatNumberValue(entry.count)}`}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 24, fontWeight: 400, color: categoricalTone.text, textAlign: "center", marginTop: 4 }}>{formatNumberValue(item.value)}</div>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {hasCategoricalBoxes && hasNumericBoxes && (
                                <div style={{ borderLeft: `1px solid ${token.colorBorderSecondary}`, margin: "0 2px" }} />
                            )}
                            {hasNumericBoxes && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }}>
                                    {totalsDetailsNumericBoxes.map((item) => (
                                        <Card
                                            key={`${keyPrefix}${item.key}`}
                                            size="small"
                                            variant="borderless"
                                            style={{ minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${numericTone.softer} 0%, ${numericTone.soft} 100%)` }}
                                            styles={{ body: { padding: 10 } }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 400, color: numericTone.text, textAlign: "center", marginTop: 2 }}>
                                                {item.summaryFn && item.summaryFn !== "sum"
                                                    ? `${item.label} (${getSummaryFunctionDisplayText(item.summaryFn)})`
                                                    : item.label}
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 400, color: numericTone.solid, textAlign: "center", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                                                {formatNumberValue(item.value)}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <Tooltip title={isTotalsDetailsFlipped ? _("Show totals") : _("Show details")}>
                        <Button
                            size="small"
                            icon={<SwapOutlined style={{ transform: "rotate(90deg)" }} />}
                            aria-label={isTotalsDetailsFlipped ? _("Show totals") : _("Show details")}
                            onClick={() => setIsTotalsDetailsFlipped((prev) => !prev)}
                            style={{
                                flexShrink: 0,
                                background: relatedModelTone.soft,
                                borderColor: relatedModelTone.border,
                                color: relatedModelTone.text,
                            }}
                        />
                    </Tooltip>
                </div>
                {relationRowsCapped && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {_("Only the first N rows are loaded").replace("N", formatNumberValue(loadedRowsCount || relationsMaxRowsToLoad))}
                        </Typography.Text>
                        <Button
                            size="small"
                            style={{ color: relatedModelTone.text, background: relatedModelTone.soft, border: "none", borderRadius: 8 }}
                            onClick={() => {
                                setCurrentPage(1);
                                setFullDataLoaded(false);
                                setLoadAllRelatedRequested(true);
                            }}
                        >
                            {_("Load all related")}
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="jm-tone-scope" style={toneScopeStyle(relatedModelTone)}>
            <ToneSharedStyles />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ minHeight: 22, display: "flex", alignItems: "center" }}>
                    {title && <Title level={5} style={{ color: relatedModelTone.text, margin: 0 }}>{title}</Title>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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
                    {showCreate && recordId !== undefined && recordId !== null && (
                        <>
                            <Tooltip title={rel.otherResource && rel.otherKey ? _("Associate existing") : _("Add relation")}>
                                <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (rel.otherResource && rel.otherKey && rel.targetKey) {
                                            const params = new URLSearchParams();
                                            const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                                            const relatedModel = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
                                            const relatedResource = relatedModel
                                                ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels)
                                                : null;
                                            if (!relatedResource) return;
                                            params.append("select_mode", "1");
                                            params.append("relate_resource", relationResource);
                                            params.append("relate_target_key", rel.targetKey);
                                            params.append("relate_other_key", rel.otherKey);
                                            params.append("relate_target_id", String(recordId));
                                            const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                            if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                            navigate(`/${relatedResource}?${params.toString()}`);
                                        } else {
                                            const params = new URLSearchParams();
                                            if (rel.targetKey) params.append(rel.targetKey, String(recordId));
                                            const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                                            if (allowInlineEdit) params.append("inline", "1");
                                            const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                            if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                            navigate(`/${relationResource}/create?${params.toString()}`);
                                        }
                                    }}
                                />
                            </Tooltip>
                            {rel.otherResource && rel.otherKey && rel.targetKey && (
                                <Tooltip title={_("Create new and relate")}>
                                    <Button
                                        size="small"
                                        icon={<ShareAltOutlined />}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const otherKey = rel.otherKey;
                                            if (!otherKey) return;
                                            const params = new URLSearchParams();
                                            const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                                            const relatedModel = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
                                            const relatedResource = relatedModel
                                                ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels)
                                                : null;
                                            if (!relatedResource) {
                                                message.warning(_("No create route for the related model. Opening relation create form."));
                                                params.append(rel.targetKey, String(recordId));
                                                if (allowInlineEdit) params.append("inline", "1");
                                                const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                                if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                                navigate(`/${relationResource}/create?${params.toString()}`);
                                                return;
                                            }
                                            params.append("relate_resource", relationResource);
                                            params.append("relate_target_key", rel.targetKey);
                                            params.append("relate_other_key", otherKey);
                                            params.append("relate_target_id", String(recordId));
                                            const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                            if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                            navigate(`/${relatedResource}/create?${params.toString()}`);
                                        }}
                                    />
                                </Tooltip>
                            )}
                        </>
                    )}
                    {allowInlineEdit && (
                        <Tooltip title={_("Save")}>
                            <Button
                                size="small"
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={saveAllEdits}
                                loading={savingAll}
                                aria-label={_("Save")}
                            />
                        </Tooltip>
                    )}
                    <Tooltip title={_("Export CSV")}>
                        <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => setExportRequested(true)}
                            loading={exportRequested}
                        />
                    </Tooltip>
                </div>
            </div>
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
            {relatedViewTabsNode}
            {!filtersCollapsed && (
                <Card
                    size="small"
                    title={
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>{_("Filters")}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                                <Input
                                    placeholder={_("Search all fields...")}
                                    prefix={<SearchOutlined />}
                                    allowClear
                                    value={localSearch}
                                    onChange={(event) => setLocalSearch(event.target.value)}
                                    style={{ minWidth: 240, maxWidth: 420 }}
                                />
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
                                    const field = relatedModel.fields.find((f) => f.key === rule.fieldKey);
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
                                                options={relatedModel.fields.map((f) => ({ label: f.label, value: f.key }))}
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
                            {layoutPreferenceType && (
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
                                icon={<UnorderedListOutlined />}
                                onClick={() => {
                                    markLayoutPrefsTouched();
                                    setListVisible((prev) => !prev);
                                }}
                            >
                                {_("View list")}
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
                                    const field = relatedModel.fields.find((item) => item.key === key);
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
                    </div>
                </Card>
            )}
            <div style={listAnalyzeLayoutStyle}>
                {listVisible && (
                    <div style={listContainerStyle}>
                        {isTotalsDetailsVariant && renderTotalsBoxes(isTotalsDetailsFlipped ? "back-" : "front-")}
                        {(!isTotalsDetailsVariant || isTotalsDetailsFlipped) && (
                        <>
                        <Form
                            form={form}
                            component={false}
                            onValuesChange={() => {
                                if (allowInlineEdit) setHasPendingEdits(true);
                            }}
                        >
                        {isCrosstabView ? crosstabBodyNode : (
                        <Table
                            dataSource={filteredRows}
                            pagination={{
                                current: currentPage,
                                pageSize,
                                total: shouldUseFullDataMode ? filteredRows.length : serverTotalRows,
                                hideOnSinglePage: true,
                                showSizeChanger: true,
                                pageSizeOptions: ["10", "20", "50", "100"],
                                onChange: (page, newPageSize) => {
                                    setCurrentPage(page);
                                    if (newPageSize && newPageSize !== pageSize) {
                                        setPageSize(newPageSize);
                                        setCurrentPage(1);
                                    }
                                },
                                onShowSizeChange: (_, newPageSize) => {
                                    if (newPageSize && newPageSize !== pageSize) {
                                        setPageSize(newPageSize);
                                        setCurrentPage(1);
                                    }
                                },
                            }}
                            size="small"
                            rowKey={(row: any) => row?.__relationKey || row?.eid || row?.id || JSON.stringify(row)}
                            locale={filteredRows.length === 0 ? { emptyText: <span style={{ display: "inline-block", fontSize: 12, color: "#8c8c8c" }}>{_("No related records")}</span> } : undefined}
                            onChange={(_, filters, sorter, extra) => {
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
                            }}
                        >
                            {allowInlineEdit && (
                                <Table.Column
                                    key="relation-link"
                                    // Identify the related entity by its dc_title()/__str__ label
                                    // (the API-provided _label), never the raw PK/FK value.
                                    title={relatedModel.label || relatedModel.name}
                                    sorter={{ compare: (a: any, b: any) => getRecordDisplayLabel(a).localeCompare(getRecordDisplayLabel(b)) }}
                                    filters={Array.from(new Set((filteredRows || []).map((r: any) => getRecordDisplayLabel(r))))
                                        .map((label) => ({ text: label, value: label }))}
                                    filterSearch
                                    onFilter={(value, row: any) => getRecordDisplayLabel(row) === String(value)}
                                    render={(_unused, row: any) => {
                                        const id = row?.eid ?? row?.id;
                                        const label = getRecordDisplayLabel(row);
                                        if (!id) return label;
                                        return (
                                            <a
                                                href={getShowHref(relatedModel.name, id, allModels)}
                                                onClick={(e) => {
                                                    if (!shouldHandleLinkClick(e)) return;
                                                    e.preventDefault();
                                                    if (paneNav?.isInMultiPane) {
                                                        paneNav.openDetail(relatedModel.name, id);
                                                    } else {
                                                        go({ to: { resource: relatedModel.name, action: "show", id } });
                                                    }
                                                }}
                                                style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}
                                            >
                                                {label}
                                            </a>
                                        );
                                    }}
                                />
                            )}
                            {displayFields.map((field) => (
                                <Table.Column
                                    key={field.key}
                                    dataIndex={field.key}
                                    title={field.label}
                                    sorter={{ compare: (a, b) => compareSortValues(field, a, b), multiple: getSortPriority(columnSort, field.key) }}
                                    filters={columnFilters.get(field.key)}
                                    filteredValue={columnFiltersSelected[field.key] || null}
                                    sortOrder={columnSort.find((item) => item.fieldKey === field.key)?.order ?? null}
                                    onHeaderCell={() => ({
                                        onClick: (event: React.MouseEvent) => {
                                            sortIntentRef.current = {
                                                fieldKey: field.key,
                                                additive: event.ctrlKey || event.metaKey,
                                            };
                                        },
                                    })}
                                    onFilter={(value, recordRow: any) => {
                                        if (isPkField(field, relatedModel) && recordRow?._label) {
                                            return String(recordRow._label) === String(value) || String(recordRow.eid) === String(value);
                                        }
                                        const recordValue = recordRow?.[field.key];
                                        return String(recordValue) === String(value);
                                    }}
                                    align={(field.type === "number" && !isReferenceField(field) && !isPkField(field, relatedModel)) ? "right" : undefined}
                                    render={(value, row: any) => {
                                        if (allowInlineEdit && !isPkField(field, relatedModel)) {
                                            const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
                                            return (
                                                <Form.Item
                                                    name={[rowId, field.key]}
                                                    style={{ margin: 0 }}
                                                    valuePropName={field.type === "boolean" ? "checked" : "value"}
                                                    getValueProps={(val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs(val) } : field.type === "time" && val ? { value: dayjs("1970-01-01T" + val) } : { value: val }}
                                                >
                                                    {renderEditableInput(field, rowId)}
                                                </Form.Item>
                                            );
                                        }
                                        const renderValue = () => {
                                            // Delegate to renderFieldValue when a showViewType is configured
                                            const showToken = normalizeFieldViewType(field.showViewType || "");
                                            if (showToken && !(showToken === "read-only-field" && field.reference)) {
                                                return renderFieldValue(field, row, allModels, true);
                                            }
                                            if (field.reference && value) {
                                                const cacheKey = `${field.reference}:${value}`;
                                                return labelCache[cacheKey] || value;
                                            }
                                            if (isPkField(field, relatedModel) && row._label) return row._label;
                                            if (field.type === "boolean") return <Checkbox checked={value} disabled />;
                                            if (field.type === "number" && !field.reference) {
                                                const formatted = formatNumberValue(value);
                                                const maxValue = numericColumnMaxes[field.key] ?? 0;
                                                return renderNumericValueBar(value, maxValue, formatted, numericBarColor);
                                            }
                                            if (field.type === "date") return formatDateValue(value);
                                            if (field.options) return renderOptionTag(field, value);
                                            return value ?? "-";
                                        };
                                        const id = row?.eid ?? row?.id;
                                        if (!id) return renderValue();
                                        return (
                                            <a
                                                href={getShowHref(relatedModel.name, id, allModels)}
                                                onClick={(e) => {
                                                    if (!shouldHandleLinkClick(e)) return;
                                                    e.preventDefault();
                                                    if (paneNav?.isInMultiPane) {
                                                        paneNav.openDetail(relatedModel.name, id);
                                                    } else {
                                                        go({ to: { resource: relatedModel.name, action: "show", id } });
                                                    }
                                                }}
                                                style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}
                                            >
                                                {renderValue()}
                                            </a>
                                        );
                                    }}
                                />
                            ))}
                            {showActions && (
                                <Table.Column
                                    title={_("Actions")}
                                    key="actions"
                                    width={140}
                                    render={(_unused, row: any) => {
                                        const id = row?.eid ?? row?.id;
                                        const relationRow = row?.__relationRow;
                                        const deleteId = relationRow && rel.targetKey && rel.otherKey
                                            ? `${relationRow["eid_from"]}:${relationRow["eid_to"]}`
                                            : relationRow?.id ?? relationRow?.eid;
                                            return (
                                                <Space>
                                                    {id && (
                                                        <>
                                                            <Tooltip title={_("View")}><Button size="small" icon={<EyeOutlined />} onClick={() => {
                                                                if (paneNav?.isInMultiPane) {
                                                                    paneNav.openDetail(relatedModel.name, id);
                                                                } else {
                                                                    go({ to: { resource: relatedModel.name, action: "show", id } });
                                                                }
                                                            }} /></Tooltip>
                                                            <Tooltip title={_("Edit")}><Button size="small" icon={<EditOutlined />} onClick={() => {
                                                                if (allowInlineEdit) {
                                                                    const params = new URLSearchParams();
                                                                    params.append("inline", "1");
                                                                    const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                                                    if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                                                    navigate(`/${relatedResourcePath}/edit/${id}?${params.toString()}`);
                                                                } else {
                                                                    go({ to: { resource: relatedModel.name, action: "edit", id } });
                                                                }
                                                            }} /></Tooltip>
                                                        </>
                                                    )}
                                                    {deleteId && (
                                                        <Tooltip title={_("Delete")}>
                                                            <Button
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => handleDeleteRelationRow(row)}
                                                            />
                                                        </Tooltip>
                                                )}
                                            </Space>
                                        );
                                    }}
                                />
                            )}
                        </Table>
                        )}
                        </Form>
                        {relationRowsCapped && (
                            <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {_("Only the first N rows are loaded").replace("N", formatNumberValue(loadedRowsCount || relationsMaxRowsToLoad))}
                                </Typography.Text>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setCurrentPage(1);
                                        setFullDataLoaded(false);
                                        setLoadAllRelatedRequested(true);
                                    }}
                                >
                                    {_("Load all related")}
                                </Button>
                            </div>
                        )}
                        </>
                        )}
                    </div>
                )}
                {analyzeOpen && columnFilteredRows.length > 0 && analyzePrefsReady && (
                    <div style={analyzeContainerStyle}>
                        <Card
                            size="small"
                            title={<span style={{ color: relatedModelTone.text, fontWeight: 600 }}>{_("Analyze")}</span>}
                            styles={{
                                header: {
                                    background: `linear-gradient(135deg, ${relatedModelTone.solid}18 0%, ${relatedModelTone.solid}0a 100%)`,
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
                                            allFields={relatedModel.fields}
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
        </div>
    );
};

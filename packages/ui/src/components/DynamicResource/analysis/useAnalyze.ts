import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { FieldDef, ModelDef } from "../types";
import { escapeHtml, formatDateTimeValue, formatDateValue, formatTimeValue } from "../utils/formatting";
import { buildStatsHtml, buildStatsSummary, openPdfWindow } from "../utils/statistics";
import { isPkField } from "../utils/model";
import { normalizeViewName } from "../utils/viewConfig";
import { getPlotly } from "../../../utils/plotlyLoader";
import {
    CATEGORY_LABEL_SEPARATOR,
    COUNT_SERIES_KEY,
    aggregateChartData,
    buildCategoryLabeler,
    resolveSeries,
    type AnalyzeChartData,
    type SummaryFn,
} from "./aggregation";
import type { ServerAnalyzeState } from "./useServerAnalyze";
import { DEFAULT_CHART_TYPE, normalizeChartTypeId, type ChartTypeId } from "./chartCatalog";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** Chart-type IDs the Analyze section can render (see chartCatalog). */
export type AnalyzeChartType = ChartTypeId;

/** Ranking filter applied to the aggregated groups. */
export type RankingMode = "none" | "top" | "bottom";

/** Inputs of {@link useAnalyzeSettings}. */
export interface UseAnalyzeSettingsOptions {
    /** Model whose rows are analysed (a list page's model or a relation's related model). */
    model: ModelDef;
    apiUrl: string;
    /** Resource key the Analyze preferences are stored under. */
    prefsResourceKey: string;
    /** Saved view whose Analyze preferences are loaded and saved. */
    currentViewName: string;
}

/**
 * Chart configuration of the Analyze section and its saved preferences.
 *
 * Shared by list pages (`DynamicResource/index.tsx`) and by the list and
 * totals-details relation views (`relations/RelatedObjectsTable.tsx`). It owns
 * the categories, chart type, series, summary function, ranking filter and
 * crosstab filter fields, and loads and saves them as the "Analyze"
 * preferences of the current view.
 *
 * It is split from {@link useAnalyzeResults} because pages need the
 * configuration (for their save dialog and view switching) before they have
 * computed the filtered rows the results are built from. The page keeps the
 * layout state (whether Analyze is open, its position) and the view-change
 * orchestration; it calls `resetPrefsTracking` and `resetAnalyzeDefaults`
 * when the user switches views.
 */
export const useAnalyzeSettings = ({
    model,
    apiUrl,
    prefsResourceKey,
    currentViewName,
}: UseAnalyzeSettingsOptions) => {
    const [categoryField1, setCategoryField1] = useState<string | null>(null);
    const [categoryField2, setCategoryField2] = useState<string | null | undefined>(undefined);
    // Optional third grouping category: added to the category labels (to the column labels on
    // heatmap and crosstab). Never an axis -- numeric axes come from the Series.
    const [categoryField3, setCategoryField3] = useState<string | null>(null);
    // Fields exposed as Excel-style multi-select filter dropdowns above the crosstab body.
    const [crosstabFilterFields, setCrosstabFilterFields] = useState<string[]>([]);
    const [chartType, setChartType] = useState<AnalyzeChartType>(DEFAULT_CHART_TYPE);
    const [summaryFn, setSummaryFn] = useState<SummaryFn>("sum");
    const [selectedSeriesKeys, setSelectedSeriesKeys] = useState<string[] | null>(null);
    const [rankingMode, setRankingMode] = useState<RankingMode>("none");
    const [rankingFieldKey, setRankingFieldKey] = useState<string | null>(null);
    const [rankingN, setRankingN] = useState<number>(10);
    const [isSavingAnalyzePrefs, setIsSavingAnalyzePrefs] = useState(false);
    const [analyzePrefsReady, setAnalyzePrefsReady] = useState(false);
    // Set once the user changes any Analyze control, so a late preference load does not overwrite it.
    const analyzePrefsTouchedRef = useRef(false);
    const analyzePrefsLoadedRef = useRef(false);
    const analyzePrefsResourceRef = useRef<string | null>(null);

    const categoricalFields = useMemo(() => {
        return model.fields.filter((field) => isPkField(field, model) || (field.type !== "number" || field.reference));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- isPkField only reads model.pkField
    }, [model.fields, model.pkField]);

    const numericFields = useMemo(() => {
        return model.fields.filter((field) => !isPkField(field, model) && field.type === "number" && !field.reference);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- isPkField only reads model.pkField
    }, [model.fields, model.pkField]);

    /** Record that the user changed an Analyze control (see `analyzePrefsTouchedRef`). */
    const markAnalyzePrefsTouched = useCallback(() => {
        analyzePrefsTouchedRef.current = true;
    }, []);

    /** Forget earlier user changes and loads, so the next view's preferences load again. */
    const resetPrefsTracking = useCallback(() => {
        analyzePrefsTouchedRef.current = false;
        analyzePrefsLoadedRef.current = false;
    }, []);

    /** Restore the default chart configuration for this model. */
    const resetAnalyzeDefaults = useCallback(() => {
        setCategoryField1(categoricalFields[0]?.key ?? null);
        setCategoryField2(categoricalFields.length > 1 ? categoricalFields[1].key : null);
        setCategoryField3(null);
        setChartType(DEFAULT_CHART_TYPE);
        setSummaryFn("sum");
        setSelectedSeriesKeys(null);
        setRankingMode("none");
        setRankingFieldKey(numericFields[0]?.key ?? null);
        setRankingN(10);
        setCrosstabFilterFields([]);
    }, [categoricalFields, numericFields]);

    /** Save the current chart configuration as the "Analyze" preferences of `viewName`. */
    const persistAnalyzePreferences = useCallback(async (viewName: string) => {
        const preferences = {
            categoryField1,
            categoryField2: categoryField2 ?? null,
            categoryField3,
            chartType,
            summaryFn,
            selectedSeriesKeys: selectedSeriesKeys ?? [],
            rankingMode,
            rankingFieldKey,
            rankingN,
            crosstabFilterFields,
            custom_view_name: normalizeViewName(viewName),
        };
        setIsSavingAnalyzePrefs(true);
        try {
            const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: prefsResourceKey, preferenceType: "Analyze", preferences }),
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
    }, [apiUrl, categoryField1, categoryField2, categoryField3, chartType, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, crosstabFilterFields, prefsResourceKey]);

    // Load the saved "Analyze" preferences of the current view once per resource and view.
    useEffect(() => {
        const viewKey = `${prefsResourceKey}::${currentViewName}`;
        if (analyzePrefsResourceRef.current !== viewKey) {
            analyzePrefsLoadedRef.current = false;
            setAnalyzePrefsReady(false);
            analyzePrefsResourceRef.current = viewKey;
        }
        if (analyzePrefsLoadedRef.current) return;
        let cancelled = false;
        const loadPreferences = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(prefsResourceKey)}&preference_type=Analyze&custom_view_name=${encodeURIComponent(currentViewName)}`);
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
                if ("categoryField3" in prefs) setCategoryField3(prefs.categoryField3 ?? null);
                // Preferences saved before the chart catalogue was unified may hold a legacy ID.
                if ("chartType" in prefs) setChartType(normalizeChartTypeId(prefs.chartType));
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
    }, [apiUrl, currentViewName, prefsResourceKey]);

    // Default categories: the first two categorical fields.
    useEffect(() => {
        if (!categoryField1 && categoricalFields.length > 0) {
            setCategoryField1(categoricalFields[0].key);
        }
        if (categoryField2 === undefined && categoricalFields.length > 1) {
            setCategoryField2(categoricalFields[1].key);
        }
    }, [categoricalFields, categoryField1, categoryField2]);

    // Default series: every numeric field, or a row count when the model has none.
    useEffect(() => {
        if (selectedSeriesKeys !== null) return;
        setSelectedSeriesKeys(numericFields.length > 0 ? numericFields.map((field) => field.key) : [COUNT_SERIES_KEY]);
    }, [numericFields, selectedSeriesKeys]);

    // Keep the ranking column on an existing numeric field; no numeric field disables ranking.
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

    return {
        model,
        categoricalFields,
        numericFields,
        categoryField1,
        setCategoryField1,
        categoryField2,
        setCategoryField2,
        categoryField3,
        setCategoryField3,
        crosstabFilterFields,
        setCrosstabFilterFields,
        chartType,
        setChartType,
        summaryFn,
        setSummaryFn,
        selectedSeriesKeys,
        setSelectedSeriesKeys,
        rankingMode,
        setRankingMode,
        rankingFieldKey,
        setRankingFieldKey,
        rankingN,
        setRankingN,
        isSavingAnalyzePrefs,
        analyzePrefsReady,
        markAnalyzePrefsTouched,
        resetPrefsTracking,
        resetAnalyzeDefaults,
        persistAnalyzePreferences,
    };
};

/** Everything {@link useAnalyzeSettings} returns. */
export type AnalyzeSettings = ReturnType<typeof useAnalyzeSettings>;

/** Inputs of {@link useAnalyzeResults}. */
export interface UseAnalyzeResultsOptions {
    /** Rows the chart aggregates: already filtered by search, filter rules and column filters. */
    rows: any[];
    /** Fields summarised on the statistics side of the card (the visible list columns). */
    statsFields: FieldDef[];
    /** Resolved display labels of referenced records, keyed `"<reference>:<id>"`. */
    labelCache: Record<string, string>;
    /**
     * The server's aggregation, when the list has more rows than the server-aggregation
     * threshold (see useServerAnalyze); `rows` is then not used for the chart.
     */
    server?: ServerAnalyzeState | null;
}

/**
 * What the Analyze section shows for the current configuration: the
 * aggregated chart data, the category labels of each row, the chart title,
 * the statistics on the back of the card, and the chart and statistics exports.
 *
 * Built from the rows in the browser, or -- above the server-aggregation threshold --
 * from the server's aggregation (`server`), which follows the same rules: groups keyed
 * by raw category values are labelled here with the same formatting as browser rows.
 *
 * @param settings the result of {@link useAnalyzeSettings} for the same model.
 * @returns the settings merged with the results, ready for `AnalyzePanel`.
 */
export const useAnalyzeResults = (
    settings: AnalyzeSettings,
    { rows, statsFields, labelCache: pageLabelCache, server = null }: UseAnalyzeResultsOptions,
) => {
    const {
        model,
        numericFields,
        categoryField1,
        categoryField2,
        categoryField3,
        summaryFn,
        selectedSeriesKeys,
        rankingMode,
        rankingFieldKey,
        rankingN,
    } = settings;
    const [isStatsFlipped, setIsStatsFlipped] = useState(false);
    // The Plotly graph div of the chart, used by the PNG/PDF exports.
    const chartGraphRef = useRef<HTMLDivElement | null>(null);

    const serverResult = server?.result ?? null;
    // Titles the server resolved for referenced records, added to the page's own label cache.
    const labelCache = useMemo(() => {
        if (!serverResult) return pageLabelCache;
        const merged = { ...pageLabelCache };
        Object.entries(serverResult.reference_titles || {}).forEach(([fieldKey, titles]) => {
            const reference = model.fields.find((field) => field.key === fieldKey)?.reference;
            if (!reference) return;
            Object.entries(titles).forEach(([id, title]) => { merged[`${reference}:${id}`] = title; });
        });
        return merged;
    }, [pageLabelCache, serverResult, model.fields]);

    /** Display text of a category value: record titles, option labels, translated booleans, formatted dates. */
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- isPkField only reads model.pkField
    }, [labelCache, model.pkField]);

    const categoryKeys = useMemo(
        () => [categoryField1, categoryField2, categoryField3].filter((key): key is string => Boolean(key)),
        [categoryField1, categoryField2, categoryField3],
    );
    // One pseudo-row per server group: its raw category values and its summarised series.
    const serverGroupRows = useMemo(() => {
        if (!serverResult) return null;
        return serverResult.groups.map((group) => {
            const record: Record<string, any> = { ...group.values };
            categoryKeys.forEach((key, index) => { record[key] = group.key[index]; });
            return record;
        });
    }, [serverResult, categoryKeys]);

    const browserChartData = useMemo(() => (serverResult ? null : aggregateChartData({
        rows,
        fields: model.fields,
        numericFields,
        categoryField1,
        categoryField2,
        categoryField3,
        selectedSeriesKeys,
        summaryFn,
        rankingMode,
        rankingFieldKey,
        rankingN,
        formatCategoryValue,
    })), [serverResult, rows, model.fields, numericFields, categoryField1, categoryField2, categoryField3, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, formatCategoryValue]);

    // Labels of one row: its full category label (Category 1 • 2 • 3), and for heatmaps its
    // row (Category 1) and column (Category 2 • 3) labels.
    const categoryLabelOf = useMemo(
        () => buildCategoryLabeler(model.fields, [categoryField1, categoryField2, categoryField3], formatCategoryValue),
        [model.fields, categoryField1, categoryField2, categoryField3, formatCategoryValue],
    );
    const rowCategoryLabelOf = useMemo(
        () => buildCategoryLabeler(model.fields, [categoryField1], formatCategoryValue),
        [model.fields, categoryField1, formatCategoryValue],
    );
    const columnCategoryLabelOf = useMemo(
        () => buildCategoryLabeler(model.fields, [categoryField2, categoryField3], formatCategoryValue),
        [model.fields, categoryField2, categoryField3, formatCategoryValue],
    );

    // Chart data from the server's groups (already summarised and ranked) and its row sample.
    const serverChartData = useMemo((): AnalyzeChartData | null => {
        if (!serverResult || !serverGroupRows) return null;
        const { seriesKeys, seriesLabels } = resolveSeries(numericFields, selectedSeriesKeys);
        const groups = serverResult.groups.map((group, index) => {
            const label = categoryLabelOf(serverGroupRows[index]);
            return { key: label, label, values: group.values };
        });
        return { groups, seriesKeys, seriesLabels, filteredRawRows: serverResult.sample_rows || [] };
    }, [serverResult, serverGroupRows, numericFields, selectedSeriesKeys, categoryLabelOf]);

    const chartData = (serverChartData ?? browserChartData)!;

    // Rows the heatmap and the crosstab summarise per cell. A server group is one cell already
    // summarised, so it is re-summarised with "sum" (the sum of one value is that value).
    const cellRows = serverGroupRows ?? chartData.filteredRawRows;
    const cellSummaryFn: SummaryFn = serverGroupRows ? "sum" : summaryFn;

    // A sample of the rows, when the server sent fewer than match (charts plotting individual rows).
    const sampleInfo = serverResult && (serverResult.sample_rows || []).length < serverResult.total_rows
        ? { shown: serverResult.sample_rows.length, total: serverResult.total_rows }
        : null;

    const chartTitle = useMemo(() => {
        const labelOf = (key: string | null | undefined) => (key ? model.fields.find((field) => field.key === key)?.label : null);
        const parts = [model.label || model.name, categoryField1 ? labelOf(categoryField1) : _("All")];
        [categoryField2, categoryField3].forEach((key) => {
            const label = labelOf(key);
            if (label) parts.push(label);
        });
        return parts.filter(Boolean).join(CATEGORY_LABEL_SEPARATOR);
    }, [categoryField1, categoryField2, categoryField3, model.fields, model.label, model.name]);

    const statsSummary = useMemo(() => {
        if (!serverResult) return buildStatsSummary(rows, statsFields, labelCache);
        // The server's statistics, labelled like buildStatsSummary labels browser rows.
        const numericStats = statsFields
            .filter((field) => serverResult.stats.numeric[field.key])
            .map((field) => ({ key: field.key, label: field.label, ...serverResult.stats.numeric[field.key] }));
        const categoricalStats = statsFields
            .filter((field) => serverResult.stats.categorical[field.key])
            .map((field) => {
                const counts = new Map<string, number>();
                serverResult.stats.categorical[field.key].forEach(([raw, count]) => {
                    const label = formatCategoryValue(field, { [field.key]: raw });
                    counts.set(label, (counts.get(label) || 0) + count);
                });
                return {
                    key: field.key,
                    label: field.label,
                    counts: Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
                };
            })
            .filter((stat) => stat.counts.length > 0 && stat.counts.length < 20);
        return { numericStats, categoricalStats };
    }, [serverResult, rows, statsFields, labelCache, formatCategoryValue]);

    // Largest absolute value per statistic, used to scale the bars in the statistics table.
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

    /**
     * Render the chart with Plotly's own image export onto a canvas filled with
     * the card's background colour (the chart itself has a transparent
     * background), and hand the canvas to `onReady`.
     */
    const renderChartToCanvas = useCallback((onReady: (canvas: HTMLCanvasElement) => void) => {
        const graphDiv = chartGraphRef.current;
        const Plotly = getPlotly();
        if (!graphDiv || !Plotly?.toImage) return;
        let background = "#ffffff";
        for (let el: HTMLElement | null = graphDiv; el; el = el.parentElement) {
            const color = window.getComputedStyle(el).backgroundColor;
            if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) {
                background = color;
                break;
            }
        }
        const width = graphDiv.clientWidth || 1000;
        const height = graphDiv.clientHeight || 420;
        Plotly.toImage(graphDiv, { format: "png", width, height, scale: 2 }).then((dataUrl: string) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                onReady(canvas);
            };
            img.src = dataUrl;
        });
    }, []);

    /** Download the chart as a PNG image. */
    const exportChartImage = useCallback(() => {
        renderChartToCanvas((canvas) => {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const pngUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = pngUrl;
                link.download = `${model.name}-chart.png`;
                link.click();
                URL.revokeObjectURL(pngUrl);
            }, "image/png");
        });
    }, [model.name, renderChartToCanvas]);

    /** Open the chart, under its title, in a printable window for saving as PDF. */
    const exportChartPdf = useCallback(() => {
        renderChartToCanvas((canvas) => {
            const dataUrl = canvas.toDataURL("image/png");
            const chartHeading = chartTitle || `${model.label} Chart`;
            openPdfWindow(
                `${model.name}-chart`,
                `<h2>${escapeHtml(chartHeading)}</h2><img src="${dataUrl}" style="width: 100%; height: auto;" />`
            );
        });
    }, [chartTitle, model.label, model.name, renderChartToCanvas]);

    /** Open the statistics in a printable window for saving as PDF. */
    const exportStatsPdf = useCallback(() => {
        openPdfWindow(`${model.name}-stats`, buildStatsHtml(statsSummary));
    }, [model.name, statsSummary]);

    return {
        ...settings,
        isStatsFlipped,
        setIsStatsFlipped,
        chartGraphRef,
        formatCategoryValue,
        cellRows,
        cellSummaryFn,
        sampleInfo,
        // Server-side aggregation status (null when the browser aggregates).
        serverAggregation: server ? { hasResult: Boolean(server.result), loading: server.loading, error: server.error } : null,
        categoryLabelOf,
        rowCategoryLabelOf,
        columnCategoryLabelOf,
        chartData,
        chartTitle,
        statsSummary,
        statsNumericMaxes,
        exportChartImage,
        exportChartPdf,
        exportStatsPdf,
    };
};

/** Settings and results of the Analyze section; passed to the Analyze panels. */
export type AnalyzeState = ReturnType<typeof useAnalyzeResults>;

/**
 * The chart-type catalogue of the frontend.
 *
 * Every chart-type ID, its label and its icon come from CHART_TYPES. The
 * backend keeps its own definition with the same IDs, labels and icons
 * (veloiq_framework.utils.views_utils); a shared fixture
 * (test-fixtures/charts.json) checks that both match.
 */

const _ = (text: string): string => {
    const translate = typeof window !== "undefined" ? ((window as any)._ as ((t: string) => string) | undefined) : undefined;
    return translate ? translate(text) : text;
};

/** IDs of every chart type, in both layers. */
export type ChartTypeId =
    | "bar"
    | "bar_stacked"
    | "bar_h"
    | "bar_h_stacked"
    | "line"
    | "area"
    | "area_h"
    | "pie"
    | "donut"
    | "scatter"
    | "bubble"
    | "histogram"
    | "box"
    | "waterfall"
    | "heatmap"
    | "scatterpolar"
    | "combo"
    | "crosstab"
    | "scatter3d"
    | "seasonal"
    | "trend";

/** One catalogue entry. */
export interface ChartTypeDef {
    id: ChartTypeId;
    /** Source text of the label; translate it with getChartTypeLabel(). */
    label: string;
    /** Name of the @ant-design/icons icon. */
    icon: string;
    /** Degrees to rotate the icon (horizontal variants of a vertical chart). */
    iconRotate: number;
    /** Offered in the Analyze section. */
    frontend: boolean;
    /** Built by the backend chart helpers. */
    backend: boolean;
}

/** The chart-type catalogue, in the order the chart-type selector lists it. */
export const CHART_TYPES: ReadonlyArray<ChartTypeDef> = [
    { id: "bar", label: "Bars", icon: "BarChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "bar_stacked", label: "Stacked Bars", icon: "BuildOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "bar_h", label: "Horizontal Bars", icon: "BarChartOutlined", iconRotate: 90, frontend: true, backend: true },
    { id: "bar_h_stacked", label: "Horizontal Stacked", icon: "BuildOutlined", iconRotate: 90, frontend: true, backend: true },
    { id: "line", label: "Lines", icon: "LineChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "area", label: "Area", icon: "AreaChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "area_h", label: "Horizontal Area", icon: "AreaChartOutlined", iconRotate: 90, frontend: true, backend: true },
    { id: "pie", label: "Pie", icon: "PieChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "donut", label: "Donut", icon: "PieChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "scatter", label: "Scatter", icon: "DotChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "bubble", label: "Bubble", icon: "DotChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "histogram", label: "Histogram", icon: "BarChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "box", label: "Box Plot", icon: "BoxPlotOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "waterfall", label: "Waterfall", icon: "FallOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "heatmap", label: "Heatmap", icon: "HeatMapOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "scatterpolar", label: "Radar", icon: "RadarChartOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "combo", label: "Combo (Bar + Line)", icon: "FundOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "crosstab", label: "Crosstab", icon: "TableOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "scatter3d", label: "3D Scatter", icon: "DeploymentUnitOutlined", iconRotate: 0, frontend: true, backend: true },
    { id: "seasonal", label: "Seasonal", icon: "StockOutlined", iconRotate: 0, frontend: false, backend: true },
    { id: "trend", label: "Trend", icon: "RiseOutlined", iconRotate: 0, frontend: false, backend: true },
];

/**
 * IDs used before the catalogue was unified, mapped to the current ID.
 * Saved Analyze preferences and dashboard configurations may still hold them;
 * they are converted when read (normalizeChartTypeId).
 */
export const LEGACY_CHART_TYPE_IDS: Readonly<Record<string, ChartTypeId>> = {
    "stacked": "bar_stacked",
    "bar-horizontal": "bar_h",
    "stacked-horizontal": "bar_h_stacked",
    "area-horizontal": "area_h",
    "boxplot": "box",
    "radar": "scatterpolar",
    "3d": "scatter3d",
};

const CHART_TYPE_BY_ID = new Map<string, ChartTypeDef>(CHART_TYPES.map((def) => [def.id, def]));

/** Chart type used when none is chosen or a stored one is unknown. */
export const DEFAULT_CHART_TYPE: ChartTypeId = "area";

/**
 * The current ID for a chart-type ID that may be a legacy one.
 *
 * @param id a stored chart-type ID (current or legacy).
 * @param fallback the ID returned when `id` is not a known chart type.
 */
export const normalizeChartTypeId = (id: unknown, fallback: ChartTypeId = DEFAULT_CHART_TYPE): ChartTypeId => {
    const raw = String(id ?? "").trim();
    if (CHART_TYPE_BY_ID.has(raw)) return raw as ChartTypeId;
    return LEGACY_CHART_TYPE_IDS[raw] ?? fallback;
};

/** The catalogue entry of a chart type. */
export const getChartTypeDef = (id: ChartTypeId): ChartTypeDef | undefined => CHART_TYPE_BY_ID.get(id);

/** Translated label of a chart type. */
export const getChartTypeLabel = (id: ChartTypeId): string => _(CHART_TYPE_BY_ID.get(id)?.label ?? id);

/** The chart types the Analyze section offers, in catalogue order. */
export const getFrontendChartTypes = (): ChartTypeDef[] => CHART_TYPES.filter((def) => def.frontend);

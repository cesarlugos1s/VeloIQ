import React, { useEffect, useMemo, useRef } from "react";
import { theme } from "antd";
import { ensurePlotly, getPlotly } from "../../../utils/plotlyLoader";
import { isDarkColor } from "../utils/colors";
import {
    COUNT_SERIES_KEY,
    aggregateMatrix,
    getSummaryFnOptions,
    seriesValueOf,
    type AnalyzeGroup,
    type SummaryFn,
} from "./aggregation";
import type { ChartTypeId } from "./chartCatalog";
import {
    CHART_HEATMAP_COLORSCALE,
    CHART_HEATMAP_REVERSESCALE,
    CHART_NUMBER_FORMAT,
    buildStandardChartLayout,
    getChartEmptyMessage,
} from "./chartTheme";

/** Height of the Analyze chart, in px. */
const CHART_HEIGHT = 420;

/** Props of {@link AnalysisChart}. */
export interface AnalysisChartProps {
    /** Chart type to draw; "crosstab" is a table and is rendered by CrosstabTable instead. */
    chartType: ChartTypeId;
    /** Aggregated groups (one per category label), after the ranking filter. */
    data: AnalyzeGroup[];
    /** Selected series, in order: Series 1, 2, 3... */
    seriesKeys: string[];
    /** Display label of each series key. */
    seriesLabels: Record<string, string>;
    /** Source rows of the groups shown; used by charts that plot individual values. */
    rawRows: any[];
    /** Full category label of a row (Category 1 • 2 • 3). */
    categoryLabelOf: (record: any) => string;
    /** Heatmap row label of a row (Category 1). */
    rowCategoryLabelOf: (record: any) => string;
    /** Heatmap column label of a row (Category 2 • 3). */
    columnCategoryLabelOf: (record: any) => string;
    summaryFn: SummaryFn;
    /** Rows the heatmap summarises per cell (defaults to rawRows), and the summary to apply. */
    cellRows?: any[];
    cellSummaryFn?: SummaryFn;
    title: string;
    /** Receives the Plotly graph div, for the PNG/PDF exports. */
    graphRef: React.MutableRefObject<HTMLDivElement | null>;
}

/** A Plotly figure: traces plus chart-type-specific layout keys. */
interface ChartFigure {
    traces: any[];
    layout: Record<string, any>;
}

/** Value-axis hover text: the trace name, the category and the formatted number. */
const valueHover = (categoryAxis: "x" | "y", valueAxis: "x" | "y") =>
    `%{fullData.name}<br>%{${categoryAxis}}: %{${valueAxis}:${CHART_NUMBER_FORMAT}}<extra></extra>`;

/** Translated label of a summary function (e.g. "Sum"). */
const getSummaryLabel = (fn: SummaryFn): string =>
    getSummaryFnOptions().find((option) => option.value === fn)?.label ?? fn;

/** The n-th selected series, repeating the last one when fewer are selected (Series 1–3 axes). */
const seriesAt = (seriesKeys: string[], n: number): string =>
    seriesKeys[Math.min(n, seriesKeys.length - 1)] ?? COUNT_SERIES_KEY;

/**
 * Builds the Plotly traces and layout of one chart type.
 *
 * Categories only group and label: numeric axes come from the Series
 * (Scatter: Series 1–2 as X and Y; Bubble: Series 1–3 as X, Y and size;
 * 3D Scatter: Series 1–3 as X, Y and Z). Returns null when there is nothing
 * to draw.
 */
const buildFigure = (props: AnalysisChartProps, summaryLabel: string): ChartFigure | null => {
    const { chartType, data, seriesKeys, seriesLabels, rawRows, categoryLabelOf, rowCategoryLabelOf, columnCategoryLabelOf, summaryFn } = props;
    const labels = data.map((group) => group.label);
    const nameOf = (key: string) => seriesLabels[key] || key;
    const valuesOf = (key: string) => data.map((group) => group.values[key] ?? 0);
    const numericSeries = seriesKeys.filter((key) => key !== COUNT_SERIES_KEY);

    // Points of the raw rows grouped by category label, one trace per label (so the legend toggles labels).
    const pointsByCategory = (axisKeys: string[]) => {
        const byLabel = new Map<string, number[][]>();
        rawRows.forEach((record) => {
            const values = axisKeys.map((key) => seriesValueOf(record, key));
            if (values.some((value) => value === null)) return;
            const label = categoryLabelOf(record);
            if (!byLabel.has(label)) byLabel.set(label, []);
            byLabel.get(label)!.push(values as number[]);
        });
        return byLabel;
    };

    switch (chartType) {
        case "bar":
        case "bar_stacked":
            if (!data.length) return null;
            return {
                traces: seriesKeys.map((key) => ({
                    type: "bar", name: nameOf(key), x: labels, y: valuesOf(key), hovertemplate: valueHover("x", "y"),
                })),
                layout: { barmode: chartType === "bar_stacked" ? "stack" : "group", yaxis: { title: { text: summaryLabel } } },
            };
        case "bar_h":
        case "bar_h_stacked":
            if (!data.length) return null;
            return {
                traces: seriesKeys.map((key) => ({
                    type: "bar", orientation: "h", name: nameOf(key), y: labels, x: valuesOf(key), hovertemplate: valueHover("y", "x"),
                })),
                layout: { barmode: chartType === "bar_h_stacked" ? "stack" : "group", xaxis: { title: { text: summaryLabel } }, yaxis: { automargin: true } },
            };
        case "line":
        case "area":
            if (!data.length) return null;
            return {
                traces: seriesKeys.map((key) => ({
                    type: "scatter", mode: "lines+markers", name: nameOf(key), x: labels, y: valuesOf(key),
                    fill: chartType === "area" ? "tozeroy" : undefined, hovertemplate: valueHover("x", "y"),
                })),
                layout: { yaxis: { title: { text: summaryLabel } } },
            };
        case "area_h":
            if (!data.length) return null;
            return {
                traces: seriesKeys.map((key) => ({
                    type: "scatter", mode: "lines+markers", name: nameOf(key), y: labels, x: valuesOf(key),
                    fill: "tozerox", hovertemplate: valueHover("y", "x"),
                })),
                layout: { xaxis: { title: { text: summaryLabel } } },
            };
        case "pie":
        case "donut": {
            if (!data.length) return null;
            // One pie per series, laid out on a grid, as the backend does.
            const columns = Math.min(seriesKeys.length, 3);
            const rows = Math.ceil(seriesKeys.length / columns);
            return {
                traces: seriesKeys.map((key, index) => ({
                    type: "pie", name: nameOf(key), title: { text: nameOf(key) }, labels, values: valuesOf(key).map((value) => Math.abs(value)),
                    hole: chartType === "donut" ? 0.45 : 0, sort: false, textinfo: "percent", textposition: "inside",
                    domain: { row: Math.floor(index / columns), column: index % columns },
                    hovertemplate: `%{fullData.name}<br>%{label}: %{value:${CHART_NUMBER_FORMAT}} (%{percent})<extra></extra>`,
                })),
                layout: { grid: { rows, columns } },
            };
        }
        case "scatter":
        case "bubble":
        case "scatter3d": {
            const axisKeys = chartType === "scatter"
                ? [seriesAt(numericSeries, 0), seriesAt(numericSeries, 1)]
                : [seriesAt(numericSeries, 0), seriesAt(numericSeries, 1), seriesAt(numericSeries, 2)];
            if (numericSeries.length === 0) return null;
            const byLabel = pointsByCategory(axisKeys);
            if (byLabel.size === 0) return null;
            const [xName, yName, thirdName] = axisKeys.map(nameOf);
            if (chartType === "scatter3d") {
                return {
                    traces: Array.from(byLabel.entries()).map(([label, points]) => ({
                        type: "scatter3d", mode: "markers", name: label,
                        x: points.map((p) => p[0]), y: points.map((p) => p[1]), z: points.map((p) => p[2]), marker: { size: 4 },
                        hovertemplate: `%{fullData.name}<br>${xName}: %{x:${CHART_NUMBER_FORMAT}}<br>${yName}: %{y:${CHART_NUMBER_FORMAT}}<br>${thirdName}: %{z:${CHART_NUMBER_FORMAT}}<extra></extra>`,
                    })),
                    layout: { scene: { xaxis: { title: { text: xName } }, yaxis: { title: { text: yName } }, zaxis: { title: { text: thirdName } } } },
                };
            }
            const isBubble = chartType === "bubble";
            const maxSize = isBubble
                ? Math.max(1, ...Array.from(byLabel.values()).flat().map((p) => Math.abs(p[2])))
                : 1;
            return {
                traces: Array.from(byLabel.entries()).map(([label, points]) => ({
                    type: "scatter", mode: "markers", name: label,
                    x: points.map((p) => p[0]), y: points.map((p) => p[1]),
                    marker: isBubble
                        ? { size: points.map((p) => Math.abs(p[2])), sizemode: "area", sizeref: (2 * maxSize) / (40 ** 2), sizemin: 3 }
                        : { size: 8 },
                    customdata: isBubble ? points.map((p) => p[2]) : undefined,
                    hovertemplate: `%{fullData.name}<br>${xName}: %{x:${CHART_NUMBER_FORMAT}}<br>${yName}: %{y:${CHART_NUMBER_FORMAT}}`
                        + (isBubble ? `<br>${thirdName}: %{customdata:${CHART_NUMBER_FORMAT}}` : "") + "<extra></extra>",
                })),
                layout: { xaxis: { title: { text: xName } }, yaxis: { title: { text: yName } } },
            };
        }
        case "histogram": {
            const traces = numericSeries.map((key) => ({
                type: "histogram", name: nameOf(key), opacity: numericSeries.length > 1 ? 0.7 : 1,
                x: rawRows.map((record) => seriesValueOf(record, key)).filter((value): value is number => value !== null),
            })).filter((trace) => trace.x.length > 0);
            if (!traces.length) return null;
            return { traces, layout: { barmode: "overlay", yaxis: { title: { text: getSummaryLabel("count") } } } };
        }
        case "box": {
            const traces = numericSeries.map((key) => {
                const x: string[] = [];
                const y: number[] = [];
                rawRows.forEach((record) => {
                    const value = seriesValueOf(record, key);
                    if (value === null) return;
                    x.push(categoryLabelOf(record));
                    y.push(value);
                });
                return { type: "box", name: nameOf(key), x, y, boxpoints: "all", jitter: 0.3, pointpos: 0 };
            }).filter((trace) => trace.y.length > 0);
            if (!traces.length) return null;
            return { traces, layout: { boxmode: "group" } };
        }
        case "waterfall": {
            if (!data.length) return null;
            const key = seriesAt(seriesKeys, 0);
            return {
                traces: [{
                    type: "waterfall", name: nameOf(key), x: labels, y: valuesOf(key), measure: labels.map(() => "relative"),
                    hovertemplate: valueHover("x", "y"),
                }],
                layout: { yaxis: { title: { text: summaryLabel } } },
            };
        }
        case "heatmap": {
            const key = seriesAt(seriesKeys, 0);
            const matrix = aggregateMatrix(props.cellRows ?? rawRows, rowCategoryLabelOf, columnCategoryLabelOf, key,
                props.cellSummaryFn ?? summaryFn);
            if (!matrix.rowLabels.length || !matrix.colLabels.length) return null;
            return {
                traces: [{
                    type: "heatmap", name: nameOf(key), x: matrix.colLabels, y: matrix.rowLabels, z: matrix.values,
                    colorscale: CHART_HEATMAP_COLORSCALE, reversescale: CHART_HEATMAP_REVERSESCALE,
                    hovertemplate: `%{y} • %{x}<br>${nameOf(key)} (${summaryLabel}): %{z:${CHART_NUMBER_FORMAT}}<extra></extra>`,
                }],
                layout: { xaxis: { type: "category" }, yaxis: { type: "category", automargin: true } },
            };
        }
        case "scatterpolar": {
            if (!data.length || !seriesKeys.length) return null;
            // A radar needs at least 3 spokes: cycle the selected series when fewer are selected.
            const spokes = seriesKeys.length >= 3 ? seriesKeys : Array.from({ length: 3 }, (_unused, i) => seriesKeys[i % seriesKeys.length]);
            const theta = spokes.map((key, i) => (seriesKeys.length >= 3 ? nameOf(key) : `${nameOf(key)} ${i + 1}`));
            return {
                traces: data.map((group) => ({
                    type: "scatterpolar", name: group.label, fill: "toself", theta: [...theta, theta[0]],
                    r: [...spokes, spokes[0]].map((key) => group.values[key] ?? 0),
                    hovertemplate: `%{fullData.name}<br>%{theta}: %{r:${CHART_NUMBER_FORMAT}}<extra></extra>`,
                })),
                layout: { polar: { bgcolor: "rgba(0,0,0,0)", radialaxis: { hoverformat: CHART_NUMBER_FORMAT } } },
            };
        }
        case "combo": {
            if (!data.length) return null;
            const barKey = seriesAt(seriesKeys, 0);
            const lineKey = seriesAt(seriesKeys, 1);
            return {
                traces: [
                    { type: "bar", name: nameOf(barKey), x: labels, y: valuesOf(barKey), hovertemplate: valueHover("x", "y") },
                    { type: "scatter", mode: "lines+markers", name: nameOf(lineKey), x: labels, y: valuesOf(lineKey), hovertemplate: valueHover("x", "y") },
                ],
                layout: { yaxis: { title: { text: summaryLabel } } },
            };
        }
        default:
            return null;
    }
};

/**
 * The Analyze section's chart, drawn with Plotly.
 *
 * Plotly gives every chart the same interactions: hover values, legend
 * entries that show or hide their trace when clicked, and zoom. Updates are
 * applied with Plotly.react and animated with a layout transition. Colours,
 * fonts, number formats and the legend come from chartTheme, which the
 * backend's charts share.
 */
export const AnalysisChart: React.FC<AnalysisChartProps> = (props) => {
    const { token } = theme.useToken();
    const dark = isDarkColor(token.colorBgContainer);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Chart type last drawn in the graph div: Plotly can only animate (transition) between
    // figures of the same trace types, so a new chart type is drawn fresh instead.
    const drawnChartTypeRef = useRef<ChartTypeId | null>(null);
    const summaryLabel = getSummaryLabel(props.summaryFn);
    const figure = useMemo(() => buildFigure(props, summaryLabel), [
        props.chartType, props.data, props.seriesKeys, props.seriesLabels, props.rawRows,
        props.categoryLabelOf, props.rowCategoryLabelOf, props.columnCategoryLabelOf, props.summaryFn, summaryLabel,
        props.cellRows, props.cellSummaryFn,
    ]);

    // Draw (or update) the figure once Plotly is loaded.
    useEffect(() => {
        const graphDiv = containerRef.current;
        if (!graphDiv || !figure) return;
        let cancelled = false;
        ensurePlotly().then(() => {
            const Plotly = getPlotly();
            if (cancelled || !Plotly) return;
            const base = buildStandardChartLayout(dark, props.title, { height: CHART_HEIGHT, autosize: true });
            const sameChartType = drawnChartTypeRef.current === props.chartType;
            const layout = {
                ...base,
                ...figure.layout,
                xaxis: { ...base.xaxis, ...(figure.layout.xaxis || {}) },
                yaxis: { ...base.yaxis, ...(figure.layout.yaxis || {}) },
                // Animate data updates of the same chart (the SVG chart's enter/update animation).
                ...(sameChartType ? { transition: { duration: 400, easing: "cubic-in-out" } } : {}),
            };
            const config = { responsive: true, displaylogo: false, displayModeBar: false };
            if (sameChartType) {
                Plotly.react(graphDiv, figure.traces, layout, config);
            } else {
                // Switching between trace types (e.g. bars to a 3D scatter) with Plotly.react
                // leaves stale axes/scenes behind and throws inside Plotly; start from a clean div.
                try { Plotly.purge(graphDiv); } catch { /* nothing drawn yet */ }
                Plotly.newPlot(graphDiv, figure.traces, layout, config);
                drawnChartTypeRef.current = props.chartType;
            }
        });
        return () => { cancelled = true; };
    }, [figure, dark, props.title, props.chartType]);

    // Keep the chart sized to its card when the Analyze layout changes (vertical/horizontal, list hidden...).
    useEffect(() => {
        const graphDiv = containerRef.current;
        if (!graphDiv) return;
        const observer = new ResizeObserver(() => {
            const Plotly = getPlotly();
            if (Plotly?.Plots?.resize && graphDiv.isConnected) {
                try { Plotly.Plots.resize(graphDiv); } catch { /* a graph mid-(re)render can throw; the next resize retries */ }
            }
        });
        observer.observe(graphDiv);
        return () => {
            observer.disconnect();
            const Plotly = getPlotly();
            try { Plotly?.purge?.(graphDiv); } catch { /* noop */ }
            drawnChartTypeRef.current = null;
        };
    }, [figure === null]);

    if (!figure) {
        props.graphRef.current = null;
        return (
            <div style={{ padding: 24, color: token.colorTextTertiary, textAlign: "center" }}>
                {getChartEmptyMessage()}
            </div>
        );
    }
    return (
        <div
            ref={(el) => {
                containerRef.current = el;
                props.graphRef.current = el;
            }}
            style={{ width: "100%", height: CHART_HEIGHT }}
        />
    );
};

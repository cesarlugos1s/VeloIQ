/**
 * Map view: the records shown as points on a map, sized and coloured by a measure, or as a
 * density heatmap.
 *
 * Drawn with Plotly's map traces (the vendored runtime already contains them), so the colours,
 * fonts and light/dark theme come from the same chart theme as the Analyze section. The base
 * map is the raster tile layer of the `map_tile_url` setting (the public OpenStreetMap tile server
 * by default; an installation without internet access points it at its own tile server). Under the
 * tiles sits a plain background, which shows while tiles load or when the tile server is unreachable.
 *
 * The component owns the map preferences (location fields, measure, look), like the kanban view
 * owns its split fields; the records it draws arrive already filtered and sorted.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Select, Space, Typography, theme } from "antd";
import { useGo } from "@refinedev/core";
import type { ModelDef } from "./types";
import { ensurePlotly, getPlotly } from "../../utils/plotlyLoader";
import { isDarkColor } from "./utils/colors";
import { CHART_COLORWAY, CHART_FONT_FAMILY, CHART_FONT_SIZE, CHART_THEME_COLORS } from "./analysis/chartTheme";
import { resolveResourcePath } from "./utils/model";
import { getShowHref } from "./utils/navigation";
import { translateText } from "./utils/i18n";
import {
    DEFAULT_MAP_LOOK,
    MAP_MEASURE_COLORSCALE,
    aggregateMapPointsIntoGridCells,
    buildMapPoints,
    getMapCoordinateFieldOptions,
    getMapMeasureFieldOptions,
    getMapRecordTitle,
    getMapViewportForPoints,
    getModelMapLocation,
    type MapLook,
    type MapPoint,
} from "./utils/mapView";

// Resolved at call time — see utils/i18n.ts's translateText for why.
const _ = (text: string): string => translateText(text, text);

const { Text } = Typography;

/** Height of the map, in pixels. */
const MAP_HEIGHT = 520;
/** Marker diameters (px) for the smallest and the largest measure. */
const SMALLEST_MARKER_SIZE = 10;
const LARGEST_MARKER_SIZE = 32;
/** Marker diameter (px) when the points have no measure or all share one value. */
const DEFAULT_MARKER_SIZE = 14;
/** Radius (px) of a heatmap point's influence. */
const HEATMAP_RADIUS = 24;
/**
 * Each marker sits on a white ring with a gray outer edge, so points of any colour stand out on the
 * base map. Plotly's map markers have no outline of their own, so the ring and the edge are two
 * larger markers drawn underneath. Widths are added to the marker's diameter (px).
 */
const MARKER_RING_COLOR = "#ffffff";
const MARKER_RING_EXTRA_DIAMETER = 6;
const MARKER_EDGE_COLOR = "#8a9096";
const MARKER_EDGE_EXTRA_DIAMETER = 10;
/** Plain map background in the light and the dark theme, when no tile layer is configured. */
const PLAIN_BACKGROUND_COLORS = { light: "#eef1f4", dark: "#1b2226" } as const;

export interface MapViewProps {
    /** The model whose records the map shows. */
    model: ModelDef;
    allModels?: ModelDef[];
    /** The records to place on the map (already filtered and sorted). */
    records: any[];
    /** Raster tile URL template of the base map (the `map_tile_url` setting); empty for a plain background only. */
    tileUrl?: string;
    /** Credit for the tile provider (the `map_tile_attribution` setting), shown under the map while tiles are used. */
    tileAttribution?: string;
    /** Above this many points the map draws grid cells instead of single records (the Analyze server aggregation threshold). */
    aggregationThreshold: number;
    /** Buttons shown after the map's dropdowns (e.g. the toggle of the page's Analyze section). */
    toolbarExtra?: React.ReactNode;
}

/** The MapLibre style of the base map: a background, plus the raster tiles when a URL is set. */
const buildMapStyle = (dark: boolean, tileUrl: string | undefined): Record<string, any> => {
    const background = dark ? PLAIN_BACKGROUND_COLORS.dark : PLAIN_BACKGROUND_COLORS.light;
    const layers: Record<string, any>[] = [{ id: "plain-background", type: "background", paint: { "background-color": background } }];
    const sources: Record<string, any> = {};
    if (tileUrl) {
        sources["base-map-tiles"] = { type: "raster", tiles: [tileUrl], tileSize: 256 };
        layers.push({ id: "base-map-tiles", type: "raster", source: "base-map-tiles" });
    }
    return { version: 8, sources, layers };
};

/** The marker diameter of a point: its measure scaled between the smallest and the largest size. */
const getMarkerSize = (measure: number | null, smallest: number, largest: number): number => {
    if (measure === null || largest <= smallest) return DEFAULT_MARKER_SIZE;
    return SMALLEST_MARKER_SIZE + ((LARGEST_MARKER_SIZE - SMALLEST_MARKER_SIZE) * (measure - smallest)) / (largest - smallest);
};

export const MapView: React.FC<MapViewProps> = ({ model, allModels, records, tileUrl, tileAttribution, aggregationThreshold, toolbarExtra }) => {
    const { token } = theme.useToken();
    const go = useGo();
    const dark = isDarkColor(token.colorBgContainer);
    const graphRef = useRef<HTMLDivElement | null>(null);
    // The kind of figure the map div was last drawn with (look, colour bar, theme, tile layer): Plotly can
    // only update a drawn map in place when the trace type, the colour bar and the base map style stay the same.
    const drawnFigureKindRef = useRef<string | null>(null);
    const declaredLocation = useMemo(() => getModelMapLocation(model), [model]);
    const coordinateFieldOptions = useMemo(() => getMapCoordinateFieldOptions(model.fields), [model.fields]);
    const measureFieldOptions = useMemo(() => getMapMeasureFieldOptions(model.fields), [model.fields]);
    const [latitudeFieldKey, setLatitudeFieldKey] = useState<string>(declaredLocation?.latitude ?? "");
    const [longitudeFieldKey, setLongitudeFieldKey] = useState<string>(declaredLocation?.longitude ?? "");
    const [measureFieldKey, setMeasureFieldKey] = useState<string>("");
    const [look, setLook] = useState<MapLook>(DEFAULT_MAP_LOOK);
    const [selectedRecordId, setSelectedRecordId] = useState<string | number | null>(null);
    // Width of the map once laid out: Plotly cannot size a colour bar inside a container that is not laid out yet.
    const [mapWidthPx, setMapWidthPx] = useState(0);

    const measureField = measureFieldOptions.find((field) => field.key === measureFieldKey);
    const { points: recordPoints, recordsWithoutLocation } = useMemo(
        () => buildMapPoints(records, { latitude: latitudeFieldKey, longitude: longitudeFieldKey }, measureFieldKey, (record) => getMapRecordTitle(model, record)),
        [records, latitudeFieldKey, longitudeFieldKey, measureFieldKey, model],
    );
    const isAggregated = recordPoints.length > aggregationThreshold;
    const points: MapPoint[] = useMemo(
        () => (isAggregated ? aggregateMapPointsIntoGridCells(recordPoints) : recordPoints),
        [isAggregated, recordPoints],
    );
    const measureRange = useMemo(() => {
        const measures = points.map((point) => point.measure).filter((value): value is number => value !== null);
        return measures.length > 0 ? { smallest: Math.min(...measures), largest: Math.max(...measures) } : null;
    }, [points]);
    const selectedPoint = selectedRecordId === null ? undefined : recordPoints.find((point) => point.id === selectedRecordId);

    // Draw (or update) the map once Plotly is loaded.
    useEffect(() => {
        const graphDiv = graphRef.current;
        if (!graphDiv || points.length === 0 || mapWidthPx === 0) return;
        let cancelled = false;
        ensurePlotly().then(() => {
            const Plotly = getPlotly();
            if (cancelled || !Plotly) return;
            const colors = dark ? CHART_THEME_COLORS.dark : CHART_THEME_COLORS.light;
            const smallest = measureRange?.smallest ?? 0;
            const largest = measureRange?.largest ?? 0;
            const latitudes = points.map((point) => point.latitude);
            const longitudes = points.map((point) => point.longitude);
            const hoverTexts = points.map((point) => {
                const title = point.recordCount > 1 ? `${point.recordCount} ${_("records")}` : point.label;
                return point.measure === null ? title : `${title}<br>${measureField?.label ?? measureFieldKey}: ${point.measure}`;
            });
            const hasMeasure = measureRange !== null;
            const markerSizes = points.map((point) => (point.recordCount > 1 ? LARGEST_MARKER_SIZE : getMarkerSize(point.measure, smallest, largest)));
            // The dark edge and the white ring under the markers (see MARKER_RING_COLOR); clicks on them select the record too.
            const buildUnderlayTrace = (color: string, extraDiameter: number) => ({
                type: "scattermap",
                mode: "markers",
                lat: latitudes,
                lon: longitudes,
                customdata: points.map((point) => point.id),
                hoverinfo: "skip",
                marker: { size: markerSizes.map((size) => size + extraDiameter), color, opacity: 1 },
            });
            const trace = look === "heatmap"
                ? {
                    type: "densitymap",
                    lat: latitudes,
                    lon: longitudes,
                    ...(hasMeasure ? { z: points.map((point) => point.measure ?? 0) } : {}),
                    radius: HEATMAP_RADIUS,
                    colorscale: MAP_MEASURE_COLORSCALE,
                    showscale: hasMeasure,
                    colorbar: { title: { text: measureField?.label ?? "" }, tickfont: { color: colors.text } },
                    hoverinfo: "skip",
                }
                : {
                    type: "scattermap",
                    mode: "markers",
                    lat: latitudes,
                    lon: longitudes,
                    text: hoverTexts,
                    hoverinfo: "text",
                    customdata: points.map((point) => point.id),
                    marker: {
                        size: markerSizes,
                        color: hasMeasure ? points.map((point) => point.measure ?? smallest) : CHART_COLORWAY[0],
                        ...(hasMeasure
                            ? {
                                colorscale: MAP_MEASURE_COLORSCALE,
                                showscale: true,
                                colorbar: { title: { text: measureField?.label ?? "" }, tickfont: { color: colors.text } },
                            }
                            : {}),
                        opacity: 1,
                    },
                };
            const traces = look === "points"
                ? [buildUnderlayTrace(MARKER_EDGE_COLOR, MARKER_EDGE_EXTRA_DIAMETER), buildUnderlayTrace(MARKER_RING_COLOR, MARKER_RING_EXTRA_DIAMETER), trace]
                : [trace];
            const viewport = getMapViewportForPoints(points, mapWidthPx, MAP_HEIGHT);
            const layout = {
                height: MAP_HEIGHT,
                autosize: true,
                margin: { l: 0, r: 0, t: 0, b: 0 },
                paper_bgcolor: "rgba(0,0,0,0)",
                font: { family: CHART_FONT_FAMILY, size: CHART_FONT_SIZE, color: colors.text },
                showlegend: false,
                map: {
                    style: buildMapStyle(dark, tileUrl),
                    center: { lat: viewport.latitude, lon: viewport.longitude },
                    zoom: viewport.zoom,
                },
            };
            const config = { responsive: true, displaylogo: false, displayModeBar: false };
            // The base map style (theme, tile layer) is only applied when the map is drawn from scratch.
            const figureKind = `${look}:${hasMeasure}:${dark}:${tileUrl ?? ""}`;
            if (drawnFigureKindRef.current === figureKind) {
                // Same kind of trace: update the drawn map in place.
                Plotly.react(graphDiv, traces, layout, config);
                return;
            }
            // Switching between trace types with Plotly.react leaves stale layers behind; start from a clean div.
            try { Plotly.purge(graphDiv); } catch { /* nothing drawn yet */ }
            Plotly.newPlot(graphDiv, traces, layout, config).then(() => {
                if (cancelled) return;
                drawnFigureKindRef.current = figureKind;
                (graphDiv as any).on?.("plotly_click", (event: any) => {
                    const clickedId = event?.points?.[0]?.customdata;
                    setSelectedRecordId(clickedId === undefined || clickedId === null ? null : clickedId);
                });
            });
        });
        return () => { cancelled = true; };
    }, [points, look, dark, tileUrl, measureRange, measureField, measureFieldKey, mapWidthPx]);

    // Keep the map sized to its card when the page layout changes, and release it when the view closes.
    useEffect(() => {
        const graphDiv = graphRef.current;
        if (!graphDiv) return;
        setMapWidthPx(graphDiv.clientWidth);
        const observer = new ResizeObserver(() => {
            setMapWidthPx(graphDiv.clientWidth);
            const Plotly = getPlotly();
            if (Plotly?.Plots?.resize && graphDiv.isConnected) {
                try { Plotly.Plots.resize(graphDiv); } catch { /* a map mid-(re)render can throw; the next resize retries */ }
            }
        });
        observer.observe(graphDiv);
        return () => {
            observer.disconnect();
            try { getPlotly()?.purge?.(graphDiv); } catch { /* noop */ }
            drawnFigureKindRef.current = null;
        };
    }, [points.length === 0]);

    const coordinateOptions = coordinateFieldOptions.map((field) => ({ label: field.label, value: field.key }));
    const resource = resolveResourcePath(model.resource || model.name, allModels);

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <Space wrap size={8} align="start">
                <Select
                    size="small"
                    value={latitudeFieldKey}
                    onChange={setLatitudeFieldKey}
                    options={coordinateOptions}
                    style={{ minWidth: 160 }}
                    aria-label={_("Latitude field")}
                    placeholder={_("Latitude field")}
                />
                <Select
                    size="small"
                    value={longitudeFieldKey}
                    onChange={setLongitudeFieldKey}
                    options={coordinateOptions}
                    style={{ minWidth: 160 }}
                    aria-label={_("Longitude field")}
                    placeholder={_("Longitude field")}
                />
                <Select
                    size="small"
                    allowClear
                    value={measureFieldKey || undefined}
                    onChange={(value?: string) => setMeasureFieldKey(value ?? "")}
                    options={measureFieldOptions.map((field) => ({ label: field.label, value: field.key }))}
                    style={{ minWidth: 160 }}
                    aria-label={_("Measure")}
                    placeholder={_("Measure")}
                />
                <Select
                    size="small"
                    value={look}
                    onChange={setLook}
                    options={[
                        { label: _("Points"), value: "points" },
                        { label: _("Heatmap"), value: "heatmap" },
                    ]}
                    style={{ minWidth: 120 }}
                    aria-label={_("Look")}
                />
                {toolbarExtra}
            </Space>
            {points.length === 0 ? (
                <Empty description={_("No records have a location.")} />
            ) : (
                <div data-map-view style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, overflow: "hidden", background: token.colorBgContainer }}>
                    <div ref={graphRef} style={{ width: "100%", height: MAP_HEIGHT }} />
                </div>
            )}
            <Space wrap size={12}>
                {measureRange && measureField && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {`${measureField.label}: ${measureRange.smallest} – ${measureRange.largest}`}
                    </Text>
                )}
                {tileUrl && tileAttribution && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{tileAttribution}</Text>
                )}
                {isAggregated && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {`${_("Grouped into grid cells")}: ${recordPoints.length} ${_("records")}`}
                    </Text>
                )}
                {recordsWithoutLocation > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {`${_("Records without a location")}: ${recordsWithoutLocation}`}
                    </Text>
                )}
            </Space>
            {selectedPoint && (
                <Space wrap size={8} data-map-selected-record>
                    <Text strong>{selectedPoint.label}</Text>
                    {selectedPoint.measure !== null && measureField && <Text type="secondary">{`${measureField.label}: ${selectedPoint.measure}`}</Text>}
                    {selectedPoint.id !== null && (
                        <Button size="small" type="link" href={getShowHref(resource, selectedPoint.id, allModels)} onClick={(event) => {
                            event.preventDefault();
                            go({ to: getShowHref(resource, selectedPoint.id as string | number, allModels) });
                        }}>
                            {_("Open")}
                        </Button>
                    )}
                </Space>
            )}
        </div>
    );
};

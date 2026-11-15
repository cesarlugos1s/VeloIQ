/**
 * Helpers of the map view: which fields hold a record's position, which fields can be
 * the measure, and how records become the points the map draws.
 *
 * A model offers the map view only when it declares its location fields
 * (`__veloiq_ui__["mapLocation"]`, emitted as `ModelDef.mapLocation`); the fields are never
 * guessed from field names.
 */
import type { FieldDef, ModelDef } from "../types";
import { getCalendarHeatmapFieldOptions } from "./calendar";
import { getRecordDisplayLabel } from "./model";

/** The keys of the fields a record's position is read from. */
export interface MapLocationFieldKeys {
    latitude: string;
    longitude: string;
}

/**
 * The colour scale of the measure (Plotly's Viridis, purple for the lowest value to yellow for the
 * highest). Unlike the Analyze heatmap's scale, its low end is a strong colour, so low values stay
 * visible on a light base map; it is also readable for colour-blind users. The white ring and dark
 * edge under each marker keep the greens of the scale apart from the base map's parks.
 */
export const MAP_MEASURE_COLORSCALE = "Viridis";

/** How the map draws the records: one marker each, or a density heatmap. */
export type MapLook = "points" | "heatmap";
export const DEFAULT_MAP_LOOK: MapLook = "points";

/** The valid range of a latitude and a longitude, in degrees. */
export const MAXIMUM_LATITUDE_DEGREES = 90;
export const MAXIMUM_LONGITUDE_DEGREES = 180;

/** A record placed on the map. For a grid cell (see aggregateMapPointsIntoGridCells) `recordCount` is above 1 and `id` is null. */
export interface MapPoint {
    id: string | number | null;
    latitude: number;
    longitude: number;
    label: string;
    /** The measure's value for the point (the sum for a grid cell); null when there is no measure or the record has none. */
    measure: number | null;
    recordCount: number;
}

export interface MapPoints {
    points: MapPoint[];
    /** Records left off the map because their position is missing or outside the valid range. */
    recordsWithoutLocation: number;
}

/** The fields that can hold a coordinate: numbers that are not references. */
export const getMapCoordinateFieldOptions = (fields: FieldDef[]): FieldDef[] =>
    fields.filter((field) => field.type === "number" && !field.reference);

/** The fields that can be the measure: the same rule as the calendar's heatmap field. */
export const getMapMeasureFieldOptions = (fields: FieldDef[]): FieldDef[] => getCalendarHeatmapFieldOptions(fields);

/** The model's declared location fields, or null when it declares none or names fields it does not have. */
export const getModelMapLocation = (model: Pick<ModelDef, "mapLocation" | "fields">): MapLocationFieldKeys | null => {
    const declared = model.mapLocation;
    if (!declared?.latitude || !declared?.longitude) return null;
    const keys = new Set(model.fields.map((field) => field.key));
    return keys.has(declared.latitude) && keys.has(declared.longitude) ? declared : null;
};

/** Whether the model declares where its records are, which is what makes the map view applicable. */
export const modelHasMapLocation = (model: Pick<ModelDef, "mapLocation" | "fields">): boolean =>
    getModelMapLocation(model) !== null;

/** A coordinate as a number within ±limit degrees; null for an empty, non-numeric or out-of-range value. */
export const toMapCoordinate = (value: unknown, limitDegrees: number): number | null => {
    if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && Math.abs(parsed) <= limitDegrees ? parsed : null;
};

/** The text that names a record on the map: the model's title fields when it has them, else the usual display label. */
export const getMapRecordTitle = (model: Pick<ModelDef, "titleFields">, record: any): string => {
    const titleParts = (model.titleFields ?? [])
        .map((fieldKey) => record?.[fieldKey])
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map(String);
    return titleParts.length > 0 ? titleParts.join(" ") : getRecordDisplayLabel(record);
};

/**
 * Places the records on the map.
 *
 * @param records The records to place.
 * @param location The fields holding latitude and longitude.
 * @param measureFieldKey The field giving each point's value; empty for none.
 * @param getTitle Gives a record's title.
 * @returns The points, and how many records had no valid position.
 */
export const buildMapPoints = (
    records: readonly any[],
    location: MapLocationFieldKeys,
    measureFieldKey: string,
    getTitle: (record: any) => string,
): MapPoints => {
    const points: MapPoint[] = [];
    let recordsWithoutLocation = 0;
    records.forEach((record) => {
        const latitude = toMapCoordinate(record?.[location.latitude], MAXIMUM_LATITUDE_DEGREES);
        const longitude = toMapCoordinate(record?.[location.longitude], MAXIMUM_LONGITUDE_DEGREES);
        if (latitude === null || longitude === null) {
            recordsWithoutLocation += 1;
            return;
        }
        const rawMeasure = measureFieldKey ? record?.[measureFieldKey] : null;
        const measure = rawMeasure === null || rawMeasure === undefined || rawMeasure === "" || typeof rawMeasure === "boolean"
            ? null
            : (Number.isFinite(Number(rawMeasure)) ? Number(rawMeasure) : null);
        points.push({ id: record?.eid ?? record?.id ?? null, latitude, longitude, label: getTitle(record), measure, recordCount: 1 });
    });
    return { points, recordsWithoutLocation };
};

/** The number of grid cells along the longer side of the points' extent when the map has to group points. */
export const MAP_GRID_CELLS_ALONG_LONGER_SIDE = 100;

/**
 * Groups points into the cells of a regular grid over their extent, so a map with more points
 * than the browser can comfortably draw stays responsive. A cell sits at the mean position of its
 * points, carries the sum of their measures and the number of records it stands for.
 */
export const aggregateMapPointsIntoGridCells = (points: readonly MapPoint[]): MapPoint[] => {
    if (points.length === 0) return [];
    let minLatitude = Infinity, maxLatitude = -Infinity, minLongitude = Infinity, maxLongitude = -Infinity;
    points.forEach((point) => {
        minLatitude = Math.min(minLatitude, point.latitude);
        maxLatitude = Math.max(maxLatitude, point.latitude);
        minLongitude = Math.min(minLongitude, point.longitude);
        maxLongitude = Math.max(maxLongitude, point.longitude);
    });
    const longerSide = Math.max(maxLatitude - minLatitude, maxLongitude - minLongitude);
    const cellSize = longerSide > 0 ? longerSide / MAP_GRID_CELLS_ALONG_LONGER_SIDE : 1;
    const cells = new Map<string, { latitudeSum: number; longitudeSum: number; measureSum: number | null; recordCount: number }>();
    points.forEach((point) => {
        const cellKey = `${Math.floor((point.latitude - minLatitude) / cellSize)}:${Math.floor((point.longitude - minLongitude) / cellSize)}`;
        const cell = cells.get(cellKey) ?? { latitudeSum: 0, longitudeSum: 0, measureSum: null, recordCount: 0 };
        cell.latitudeSum += point.latitude * point.recordCount;
        cell.longitudeSum += point.longitude * point.recordCount;
        cell.recordCount += point.recordCount;
        if (point.measure !== null) cell.measureSum = (cell.measureSum ?? 0) + point.measure;
        cells.set(cellKey, cell);
    });
    return Array.from(cells.values()).map((cell) => ({
        id: null,
        latitude: cell.latitudeSum / cell.recordCount,
        longitude: cell.longitudeSum / cell.recordCount,
        label: "",
        measure: cell.measureSum,
        recordCount: cell.recordCount,
    }));
};

/** Side (px) of the whole world at zoom level 0 in the map engine (Plotly's MapLibre uses 512 px tiles). */
const WORLD_SIZE_AT_ZOOM_ZERO_PX = 512;
/** Share of the map's width and height the points' extent may take, leaving a margin around the points. */
const POINTS_EXTENT_SHARE_OF_MAP = 0.85;
const MINIMUM_FIT_ZOOM = 0;
const MAXIMUM_FIT_ZOOM = 14;
/** Zoom used when every point is at one position. */
const SINGLE_POSITION_ZOOM = 10;

const toMercatorY = (latitudeDegrees: number): number =>
    Math.log(Math.tan(Math.PI / 4 + (latitudeDegrees * Math.PI) / 360));
const fromMercatorY = (mercatorY: number): number =>
    (2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2) * (180 / Math.PI);

/**
 * The map's centre and zoom level that show all the points inside a map of the given size.
 * The latitude is fitted in Mercator coordinates, as the map draws it, so points far from the
 * equator do not fall off the top or bottom edge.
 */
export const getMapViewportForPoints = (
    points: readonly MapPoint[],
    mapWidthPx: number,
    mapHeightPx: number,
): { latitude: number; longitude: number; zoom: number } => {
    if (points.length === 0) return { latitude: 0, longitude: 0, zoom: 1 };
    let minMercatorY = Infinity, maxMercatorY = -Infinity, minLongitude = Infinity, maxLongitude = -Infinity;
    points.forEach((point) => {
        const mercatorY = toMercatorY(point.latitude);
        minMercatorY = Math.min(minMercatorY, mercatorY);
        maxMercatorY = Math.max(maxMercatorY, mercatorY);
        minLongitude = Math.min(minLongitude, point.longitude);
        maxLongitude = Math.max(maxLongitude, point.longitude);
    });
    const centre = {
        latitude: fromMercatorY((minMercatorY + maxMercatorY) / 2),
        longitude: (minLongitude + maxLongitude) / 2,
    };
    const longitudeSpanDegrees = maxLongitude - minLongitude;
    const mercatorSpan = maxMercatorY - minMercatorY;
    if (longitudeSpanDegrees <= 0 && mercatorSpan <= 0) return { ...centre, zoom: SINGLE_POSITION_ZOOM };
    // The world is 360 degrees wide and 2π Mercator units tall; each zoom level doubles its size in pixels.
    const zoomToFitLongitude = longitudeSpanDegrees > 0
        ? Math.log2((mapWidthPx * POINTS_EXTENT_SHARE_OF_MAP * 360) / (WORLD_SIZE_AT_ZOOM_ZERO_PX * longitudeSpanDegrees))
        : Infinity;
    const zoomToFitLatitude = mercatorSpan > 0
        ? Math.log2((mapHeightPx * POINTS_EXTENT_SHARE_OF_MAP * 2 * Math.PI) / (WORLD_SIZE_AT_ZOOM_ZERO_PX * mercatorSpan))
        : Infinity;
    const zoom = Math.min(MAXIMUM_FIT_ZOOM, Math.max(MINIMUM_FIT_ZOOM, Math.min(zoomToFitLongitude, zoomToFitLatitude)));
    return { ...centre, zoom };
};

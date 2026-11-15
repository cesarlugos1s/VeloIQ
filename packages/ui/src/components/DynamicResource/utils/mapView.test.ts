import { beforeAll, describe, expect, it } from "vitest";

// The helpers read a translation function from `window` when they load (no DOM here).
let helpers: typeof import("./mapView");
beforeAll(async () => {
    (globalThis as any).window = globalThis;
    helpers = await import("./mapView");
});

const LOCATION = { latitude: "lat", longitude: "lng" };
const titleOf = (record: any) => String(record.name);

describe("toMapCoordinate", () => {
    it("accepts numbers and numeric text within the limit", () => {
        expect(helpers.toMapCoordinate(12.5, 90)).toBe(12.5);
        expect(helpers.toMapCoordinate("-45.25", 180)).toBe(-45.25);
    });
    it("rejects empty, non-numeric, boolean and out-of-range values", () => {
        [null, undefined, "", "abc", true, 91].forEach((value) => expect(helpers.toMapCoordinate(value, 90)).toBeNull());
    });
});

describe("buildMapPoints", () => {
    const records = [
        { eid: 1, name: "A", lat: 10, lng: 20, amount: 5 },
        { eid: 2, name: "B", lat: null, lng: 20, amount: 7 },
        { eid: 3, name: "C", lat: 95, lng: 20, amount: 9 },
        { eid: 4, name: "D", lat: -10, lng: -20 },
    ];
    it("places valid records and counts the others", () => {
        const { points, recordsWithoutLocation } = helpers.buildMapPoints(records, LOCATION, "amount", titleOf);
        expect(points.map((point) => point.id)).toEqual([1, 4]);
        expect(points.map((point) => point.measure)).toEqual([5, null]);
        expect(recordsWithoutLocation).toBe(2);
    });
    it("leaves the measure empty when no measure field is chosen", () => {
        const { points } = helpers.buildMapPoints(records, LOCATION, "", titleOf);
        expect(points.every((point) => point.measure === null)).toBe(true);
    });
});

describe("aggregateMapPointsIntoGridCells", () => {
    it("groups close points into one cell with the summed measure and the record count", () => {
        const points = [
            { id: 1, latitude: 0, longitude: 0, label: "a", measure: 1, recordCount: 1 },
            { id: 2, latitude: 0.001, longitude: 0.001, label: "b", measure: 2, recordCount: 1 },
            { id: 3, latitude: 50, longitude: 50, label: "c", measure: 4, recordCount: 1 },
        ];
        const cells = helpers.aggregateMapPointsIntoGridCells(points);
        expect(cells).toHaveLength(2);
        const grouped = cells.find((cell) => cell.recordCount === 2)!;
        expect(grouped.measure).toBe(3);
        expect(grouped.id).toBeNull();
    });
});

describe("getModelMapLocation", () => {
    const fields = [{ key: "lat", label: "Lat", type: "number" }, { key: "lng", label: "Lng", type: "number" }] as any;
    it("returns the declared fields only when the model has both", () => {
        expect(helpers.getModelMapLocation({ fields, mapLocation: LOCATION })).toEqual(LOCATION);
        expect(helpers.getModelMapLocation({ fields, mapLocation: { latitude: "lat", longitude: "x" } })).toBeNull();
        expect(helpers.getModelMapLocation({ fields })).toBeNull();
    });
});

describe("getMapViewportForPoints", () => {
    const pointAt = (latitude: number, longitude: number) => ({ id: 1, latitude, longitude, label: "", measure: null, recordCount: 1 });
    it("centres on the extent and zooms out for a wide extent", () => {
        const viewport = helpers.getMapViewportForPoints([pointAt(0, -90), pointAt(10, 90)], 1000, 500);
        expect(viewport.latitude).toBeCloseTo(5, 0);
        expect(viewport.longitude).toBe(0);
        expect(viewport.zoom).toBeLessThan(2.5);
    });
    it("keeps both the northern and southern points inside a landscape map", () => {
        // Points spanning about 5 degrees of latitude at 23 degrees north (Mexico), in a 1070 x 520 map.
        const viewport = helpers.getMapViewportForPoints([pointAt(25.78, -100.19), pointAt(20.59, -100.39)], 1070, 520);
        const pixelsPerMercatorUnit = (512 * 2 ** viewport.zoom) / (2 * Math.PI);
        const mercator = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
        const halfHeightPx = ((mercator(25.78) - mercator(20.59)) / 2) * pixelsPerMercatorUnit;
        expect(halfHeightPx).toBeLessThan(260);
    });
    it("uses a close zoom when every point is at one position", () => {
        expect(helpers.getMapViewportForPoints([pointAt(1, 2), pointAt(1, 2)], 800, 500).zoom).toBe(10);
    });
});

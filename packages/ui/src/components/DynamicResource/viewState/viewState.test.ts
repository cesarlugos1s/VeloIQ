import { afterEach, describe, expect, it } from "vitest";
import { getViewTypeCapabilities } from "./viewTypeCapabilities";
import {
    DEFAULT_VIEW_STATE, buildRelationBlockId, buildViewStateBlockKey, copyTemporaryIntoSaved,
    mapLegacyPreferencesToViewStateLayer, mapViewStateToLegacyPreferences, resolveViewState,
} from "./viewStateLayers";
import {
    getTemporaryViewState, resetAllTemporaryLayouts, resetTemporaryPageLayout, updateTemporaryViewState,
} from "../temporaryLayout/temporaryPageLayoutStore";

afterEach(() => resetAllTemporaryLayouts());

describe("view type capabilities", () => {
    it("follows the confirmed applicability matrix", () => {
        expect(getViewTypeCapabilities("table")).toMatchObject({ summaries: false, analyze: true, pagination: true });
        expect(getViewTypeCapabilities("editable-crosstab")).toMatchObject({ pagination: false, summaries: true, analyze: true });
        expect(getViewTypeCapabilities("totals-details").summaries).toBe(true);
        expect(getViewTypeCapabilities("csv").analyze).toBe(false);
        expect(getViewTypeCapabilities("calendar").pagination).toBe(false);
        expect(getViewTypeCapabilities("kanban")).toMatchObject({ multiSort: true, pagination: true, analyze: true });
        expect(getViewTypeCapabilities("image").analyze).toBe(false);
        expect(getViewTypeCapabilities("primary")).toMatchObject({ fieldSequence: true, filters: false, multiSort: false });
    });
    it("supports nothing for an unknown view type", () => {
        expect(Object.values(getViewTypeCapabilities("unknown")).every((v) => v === false)).toBe(true);
    });
});

describe("layer precedence", () => {
    it("applies defaults, then saved, then temporary", () => {
        const state = resolveViewState({
            defaults: { pageSize: 5, page: 2 },
            saved: { pageSize: 20 },
            temporary: { pageSize: 50 },
        });
        expect(state.pageSize).toBe(50);
        expect(state.page).toBe(2);
        expect(state.sortList).toEqual(DEFAULT_VIEW_STATE.sortList);
    });
    it("keeps dormant options in their layer", () => {
        const summaryFunctions = { amount: "sum" as const };
        const state = resolveViewState({ saved: { summaryFunctions }, temporary: { pageSize: 25 } });
        expect(state.summaryFunctions).toEqual(summaryFunctions);
    });
    it("saving copies temporary over saved", () => {
        expect(copyTemporaryIntoSaved({ pageSize: 10, page: 3 }, { pageSize: 30 })).toEqual({ pageSize: 30, page: 3 });
    });
});

describe("legacy preferences", () => {
    const legacy = {
        rowsPerPage: 25,
        filters: [{ field: "name", operator: "contains", value: "a" }],
        tableColumns: { selectedKeys: ["b", "a"], order: ["c", "b", "a"] },
        columnSort: [{ fieldKey: "a", order: "descend" }],
        columnFilters: { status: ["open"] },
        totalsSummaryFunctions: { amount: "avg" },
        analyzeOpen: true, isAnalyzeFirst: false, isAnalyzeVertical: true,
    };
    it("maps to the shared schema", () => {
        const layer = mapLegacyPreferencesToViewStateLayer(legacy);
        expect(layer.pageSize).toBe(25);
        expect(layer.fieldSequence).toEqual({ visibleKeys: ["b", "a"], order: ["c", "b", "a"] });
        expect(layer.sortList).toEqual([{ fieldKey: "a", order: "descend" }]);
        expect(layer.advancedFilterRules?.[0].fieldKey).toBe("name");
        expect(layer.analyze).toEqual({ open: true, first: false, vertical: true });
    });
    it("round-trips through the legacy keys", () => {
        const state = resolveViewState({ saved: mapLegacyPreferencesToViewStateLayer(legacy) });
        const back = mapViewStateToLegacyPreferences(state);
        expect(back.rowsPerPage).toBe(25);
        expect(back.tableColumns).toEqual(legacy.tableColumns);
        expect(back.columnSort).toEqual(legacy.columnSort);
        expect(back.totalsSummaryFunctions).toEqual(legacy.totalsSummaryFunctions);
    });
    it("sets only keys that were saved", () => {
        expect(mapLegacyPreferencesToViewStateLayer({ rowsPerPage: 40 })).toEqual({ pageSize: 40 });
        expect(mapLegacyPreferencesToViewStateLayer(null)).toEqual({});
    });
});

describe("temporary view state per block", () => {
    it("keeps each block of the same model apart and resets with its page", () => {
        const pageKey = "project:show";
        const tasksKey = buildViewStateBlockKey(pageKey, buildRelationBlockId("tasks"));
        const otherKey = buildViewStateBlockKey(pageKey, buildRelationBlockId("subtasks"));
        updateTemporaryViewState(tasksKey, { pageSize: 5 });
        updateTemporaryViewState(otherKey, { pageSize: 50 });
        expect(getTemporaryViewState(tasksKey).pageSize).toBe(5);
        expect(getTemporaryViewState(otherKey).pageSize).toBe(50);
        updateTemporaryViewState(tasksKey, { pageSize: undefined });
        expect(getTemporaryViewState(tasksKey)).toEqual({});
        resetTemporaryPageLayout(pageKey);
        expect(getTemporaryViewState(otherKey)).toEqual({});
    });
});

/**
 * Checks the frontend chart implementation against the fixtures shared with the
 * backend (test-fixtures/charts.json): the same summary function on the same
 * rows must give the same number in both layers, and both layers must use the
 * same chart catalogue and theme.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import type { FieldDef } from "../types";
import { CATEGORY_LABEL_SEPARATOR, aggregateChartData, summarizeValues, type SummaryFn } from "./aggregation";
import { CHART_TYPES, DEFAULT_CHART_TYPE, LEGACY_CHART_TYPE_IDS, normalizeChartTypeId } from "./chartCatalog";
import {
    CHART_COLORWAY,
    CHART_EMPTY_MESSAGE,
    CHART_FONT_FAMILY,
    CHART_FONT_SIZE,
    CHART_HEATMAP_COLORSCALE,
    CHART_HEATMAP_REVERSESCALE,
    CHART_NUMBER_FORMAT,
    buildStandardChartLayout,
} from "./chartTheme";

// `npm test` runs from packages/ui; the fixtures sit at the repository root.
const fixtures = JSON.parse(readFileSync(resolve(process.cwd(), "../../test-fixtures/charts.json"), "utf-8"));
const SUMMARY_FNS: SummaryFn[] = ["sum", "avg", "count", "max", "min", "stddev"];

describe("summary functions", () => {
    for (const testCase of fixtures.summary_cases) {
        it(`summarise ${testCase.name}`, () => {
            for (const fn of SUMMARY_FNS) {
                expect(summarizeValues(testCase.values, fn)).toBeCloseTo(testCase.expected[fn], 9);
            }
        });
    }
});

describe("grouped summaries", () => {
    const fields = [
        { key: "status", label: "Status", type: "string" },
        { key: "priority", label: "Priority", type: "string" },
        { key: "hours", label: "Hours", type: "number" },
    ] as FieldDef[];
    const formatCategoryValue = (field: FieldDef | undefined, record: any) => (field ? String(record?.[field.key]) : "All");

    for (const testCase of fixtures.grouping_cases) {
        for (const fn of SUMMARY_FNS) {
            it(`${fn} of ${testCase.series} by ${testCase.categories.join(", ")}`, () => {
                const result = aggregateChartData({
                    rows: fixtures.grouping_rows,
                    fields,
                    numericFields: fields.filter((field) => field.type === "number"),
                    categoryField1: testCase.categories[0] ?? null,
                    categoryField2: testCase.categories[1] ?? null,
                    categoryField3: testCase.categories[2] ?? null,
                    selectedSeriesKeys: [testCase.series],
                    summaryFn: fn,
                    rankingMode: "none",
                    rankingFieldKey: null,
                    rankingN: 10,
                    formatCategoryValue,
                });
                const actual = Object.fromEntries(result.groups.map((group) => [group.label, group.values[testCase.series]]));
                expect(Object.keys(actual).sort()).toEqual(Object.keys(testCase.expected[fn]).sort());
                for (const [label, expected] of Object.entries(testCase.expected[fn])) {
                    expect(actual[label]).toBeCloseTo(expected as number, 9);
                }
            });
        }
    }
});

describe("chart catalogue", () => {
    it("matches the shared catalogue", () => {
        expect(CHART_TYPES.map((def) => ({ ...def }))).toEqual(fixtures.chart_types);
        expect({ ...LEGACY_CHART_TYPE_IDS }).toEqual(fixtures.legacy_chart_type_ids);
        expect(DEFAULT_CHART_TYPE).toBe(fixtures.default_chart_type);
        expect(CATEGORY_LABEL_SEPARATOR).toBe(fixtures.category_label_separator);
    });

    it("maps legacy chart-type IDs to current ones", () => {
        for (const [legacy, current] of Object.entries(fixtures.legacy_chart_type_ids)) {
            expect(normalizeChartTypeId(legacy)).toBe(current);
        }
        expect(normalizeChartTypeId("not-a-chart")).toBe(fixtures.default_chart_type);
    });
});

describe("chart theme", () => {
    it("matches the shared theme", () => {
        const { theme } = fixtures;
        expect([...CHART_COLORWAY]).toEqual(theme.colorway);
        expect(CHART_HEATMAP_COLORSCALE).toBe(theme.heatmap_colorscale);
        expect(CHART_HEATMAP_REVERSESCALE).toBe(theme.heatmap_reversescale);
        expect(CHART_NUMBER_FORMAT).toBe(theme.number_format);
        expect(CHART_FONT_FAMILY).toBe(theme.font_family);
        expect(CHART_FONT_SIZE).toBe(theme.font_size);
        expect(CHART_EMPTY_MESSAGE).toBe(theme.empty_message);
        const legend = buildStandardChartLayout(false, "").legend;
        for (const [key, value] of Object.entries(theme.legend)) {
            expect(legend[key]).toBe(value);
        }
    });
});

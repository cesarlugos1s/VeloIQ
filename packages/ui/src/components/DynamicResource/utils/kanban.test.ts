import { describe, expect, it } from "vitest";
import type { FieldDef } from "../types";
import { buildKanbanColumns, getDefaultKanbanSplitFieldKeys, getKanbanSplitFieldOptions } from "./kanban";

const statusField: FieldDef = { key: "status", label: "Status", type: "string", options: [{ label: "Proposed", value: "p" }, { label: "Approved", value: "a" }] };
const typeField: FieldDef = { key: "kind", label: "Type", type: "string", options: [{ label: "Forecast", value: "f" }, { label: "Actual", value: "x" }] };
const nameField: FieldDef = { key: "name", label: "Name", type: "string" };
const flagField: FieldDef = { key: "done", label: "Done", type: "boolean" };

const formatValue = (field: FieldDef, record: any) =>
    String(field.options?.find((option) => option.value === record[field.key])?.label ?? record[field.key]);

describe("kanban split fields", () => {
    it("offers categorical fields only", () => {
        expect(getKanbanSplitFieldOptions([nameField, flagField, statusField]).map((f) => f.key)).toEqual(["done", "status"]);
    });
    it("preselects the first field that lists its valid values", () => {
        expect(getDefaultKanbanSplitFieldKeys([nameField, flagField, statusField])).toEqual(["status"]);
    });
    it("falls back to the first categorical field, or none", () => {
        expect(getDefaultKanbanSplitFieldKeys([nameField, flagField])).toEqual(["done"]);
        expect(getDefaultKanbanSplitFieldKeys([nameField])).toEqual([]);
    });
});

describe("buildKanbanColumns", () => {
    const rows = [
        { id: 1, status: "p", kind: "f" }, { id: 2, status: "p", kind: "x" },
        { id: 3, status: "a", kind: "f" }, { id: 4, status: "a", kind: "f" }, { id: 5, status: "a", kind: "f" },
        { id: 6, status: null, kind: "x" },
    ];
    it("joins the split fields' values and orders the columns by header", () => {
        const columns = buildKanbanColumns(rows, [statusField, typeField], 10, formatValue, "(empty)", "All");
        expect(columns.map((c) => c.label)).toEqual(["(empty) - Actual", "Approved - Forecast", "Proposed - Actual", "Proposed - Forecast"]);
        expect(columns.find((c) => c.label === "Approved - Forecast")?.records).toHaveLength(3);
    });
    it("keeps the columns with the most records when there are too many", () => {
        const columns = buildKanbanColumns(rows, [statusField, typeField], 2, formatValue, "(empty)", "All");
        // The biggest column, then the first of the one-record columns by header; shown ordered by header.
        expect(columns.map((c) => c.label)).toEqual(["(empty) - Actual", "Approved - Forecast"]);
    });
    it("makes one column when nothing is split", () => {
        const columns = buildKanbanColumns(rows, [], 10, formatValue, "(empty)", "All");
        expect(columns).toHaveLength(1);
        expect(columns[0]).toMatchObject({ label: "All" });
        expect(columns[0].records).toHaveLength(6);
    });
});

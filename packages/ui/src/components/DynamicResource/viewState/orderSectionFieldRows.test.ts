import { describe, expect, it } from "vitest";
import { orderSectionFieldRows } from "./orderSectionFieldRows";

const field = (name: string, row: number, column: number, section = "s1"): any => ({ name, row, column, section, attribute_or_relation_type: "attribute" });
const relation: any = { name: "tasks", row: 5, column: 1, section: "s1", attribute_or_relation_type: "relation" };

describe("orderSectionFieldRows", () => {
    it("moves fields between the section's slots in sequence order", () => {
        const rows = [field("a", 1, 1), field("b", 1, 2), field("c", 2, 1)];
        const result = orderSectionFieldRows(rows, ["c", "a", "b"]);
        const slotOf = (name: string) => { const r = result.find((x) => x.name === name)!; return [r.row, r.column]; };
        expect(slotOf("c")).toEqual([1, 1]);
        expect(slotOf("a")).toEqual([1, 2]);
        expect(slotOf("b")).toEqual([2, 1]);
    });
    it("keeps sections apart, leaves relations alone and puts fields outside the sequence last", () => {
        const rows = [field("a", 1, 1), field("z", 2, 1), relation, field("x", 1, 1, "s2"), field("y", 2, 1, "s2")];
        const result = orderSectionFieldRows(rows, ["z", "a"]);
        expect(result.find((r) => r.name === "z")).toMatchObject({ row: 1, column: 1 });
        expect(result.find((r) => r.name === "a")).toMatchObject({ row: 2, column: 1 });
        expect(result.find((r) => r.name === "tasks")).toMatchObject({ row: 5 });
        expect(result.find((r) => r.name === "x")).toMatchObject({ row: 1 });
        expect(result.find((r) => r.name === "y")).toMatchObject({ row: 2 });
    });
    it("returns the rows unchanged without a sequence", () => {
        const rows = [field("a", 1, 1)];
        expect(orderSectionFieldRows(rows, [])).toBe(rows);
    });
});

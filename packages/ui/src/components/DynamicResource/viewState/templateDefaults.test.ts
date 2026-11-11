import { beforeAll, describe, expect, it } from "vitest";
import { fieldSequenceFromTemplateRows } from "./templateFieldSequence";

// viewConfig.ts reads `window` when it loads.
let applyRelationViewOverride: typeof import("../utils/viewConfig").applyRelationViewOverride;
beforeAll(async () => {
    (globalThis as any).window = (globalThis as any).window ?? {};
    applyRelationViewOverride = (await import("../utils/viewConfig")).applyRelationViewOverride;
});

const row = (over: any): any => ({ form_type: "list", attribute_or_relation_type: "attribute", section_grid_row: 1, section_grid_col: 1, row: 1, column: 1, ...over });

describe("template defaults", () => {
    it("orders the template's fields by section, row and column and drops duplicates", () => {
        const rows = [
            row({ name: "c", row: 2 }), row({ name: "a", row: 1, column: 1 }), row({ name: "b", row: 1, column: 2 }),
            row({ name: "z", section_grid_row: 2 }), row({ name: "a", section_grid_row: 2, row: 5 }),
            row({ name: "skip", form_type: "show" }), row({ name: "rel", attribute_or_relation_type: "relation" }),
        ];
        expect(fieldSequenceFromTemplateRows(rows, "list")).toEqual(["a", "b", "c", "z"]);
    });
    it("takes a relation row's limit as the block's starting page size", () => {
        const rel: any = { resource: "task", label: "Tasks" };
        expect(applyRelationViewOverride(rel, { limit: 5 } as any, "show").defaultPageSize).toBe(5);
        expect(applyRelationViewOverride(rel, { limit: null } as any, "show").defaultPageSize).toBeUndefined();
        expect(applyRelationViewOverride(rel, { limit: 0 } as any, "show").defaultPageSize).toBeUndefined();
    });
});

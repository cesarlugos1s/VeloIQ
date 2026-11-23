import { describe, expect, it } from "vitest";
import { buildColumnFilterOptions } from "./columnFilters";
import type { FieldDef } from "../types";

const itemField: FieldDef = { key: "item", label: "Item", type: "string", reference: "cw_item", viaLinkTable: true };
const rows = [{ item: 7 }, { item: 7 }, { item: 9 }, { item: null }];

describe("buildColumnFilterOptions of a reference field", () => {
    it("lists the referenced records' titles, filtering by their ids", () => {
        const options = buildColumnFilterOptions({
            fields: [itemField], data: rows,
            referenceTitles: { "cw_item:7": "Widget", "cw_item:9": "Gadget" },
        }).get("item");
        expect(options).toEqual([{ text: "Widget", value: "7" }, { text: "Gadget", value: "9" }]);
    });

    it("falls back to the id for a title that is not known", () => {
        const options = buildColumnFilterOptions({
            fields: [itemField], data: rows, referenceTitles: { "cw_item:7": "Widget" },
        }).get("item");
        expect(options).toEqual([{ text: "Widget", value: "7" }, { text: "9", value: "9" }]);
    });
});

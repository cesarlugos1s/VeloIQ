import { describe, expect, it } from "vitest";
import { getListViewFields } from "./model";
import type { FieldDef, ModelDef } from "../types";

const field = (key: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label: key, type: "string", ...extra });

const modelWith = (fields: FieldDef[]): ModelDef => ({ name: "Inventory", label: "Inventory", fields });

describe("getListViewFields", () => {
    it("keeps the first six fields", () => {
        const model = modelWith(["a", "b", "c", "d", "e", "f", "g"].map((key) => field(key)));
        expect(getListViewFields(model).map((f) => f.key)).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("treats foreign keys and link-table relations alike, as ordinary fields in order", () => {
        const model = modelWith([
            field("a"),
            field("store_id", { reference: "store" }),
            field("item", { reference: "item", viaLinkTable: true }),
            ...["b", "c", "d", "e"].map((key) => field(key)),
            field("place", { reference: "place", viaLinkTable: true }),
            field("product_id", { reference: "product" }),
        ]);
        expect(getListViewFields(model).map((f) => f.key)).toEqual(["a", "store_id", "item", "b", "c", "d"]);
    });

    it("leaves out a field marked showInList false, or the one the list is filtered by", () => {
        const model = modelWith([
            field("a"),
            field("item", { reference: "item", viaLinkTable: true, showInList: false }),
            field("place", { reference: "place", viaLinkTable: true }),
        ]);
        expect(getListViewFields(model, "place").map((f) => f.key)).toEqual(["a"]);
    });
});

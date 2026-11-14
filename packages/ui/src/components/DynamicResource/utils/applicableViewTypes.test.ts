import { beforeAll, describe, expect, it } from "vitest";
import type { ModelDef } from "../types";

// The helpers read a translation function from `window` when they load (no DOM here).
let filterApplicableViewTypes: typeof import("./applicableViewTypes").filterApplicableViewTypes;
beforeAll(async () => {
    (globalThis as any).window = globalThis;
    ({ filterApplicableViewTypes } = await import("./applicableViewTypes"));
});

const modelWith = (fields: ModelDef["fields"], extra: Partial<ModelDef> = {}): ModelDef =>
    ({ name: "m", label: "M", fields, ...extra } as ModelDef);
const ALL = ["table", "gallery", "image", "calendar", "kanban", "crosstab", "editable-crosstab", "totals-details"] as const;

describe("filterApplicableViewTypes", () => {
    it("offers only the always-applicable types for text-only fields", () => {
        const model = modelWith([{ key: "name", label: "Name", type: "string" } as any]);
        expect(filterApplicableViewTypes(ALL, model)).toEqual(["table", "totals-details"]);
    });
    it("offers gallery and image when the model has an image source", () => {
        const model = modelWith([{ key: "pic", label: "Pic", type: "image_url" } as any]);
        expect(filterApplicableViewTypes(ALL, model)).toContain("gallery");
        expect(filterApplicableViewTypes(ALL, modelWith([], { imageSource: "files" }))).toContain("image");
    });
    it("offers crosstab only with a number field that is not a reference", () => {
        const referenceOnly = modelWith([{ key: "owner_id", label: "Owner", type: "number", reference: "user" } as any]);
        expect(filterApplicableViewTypes(ALL, referenceOnly)).not.toContain("crosstab");
        const measure = modelWith([{ key: "amount", label: "Amount", type: "number" } as any]);
        expect(filterApplicableViewTypes(ALL, measure)).toEqual(expect.arrayContaining(["crosstab", "editable-crosstab"]));
    });
    it("offers calendar for a date field and kanban for a flag", () => {
        const model = modelWith([{ key: "due", label: "Due", type: "date" } as any, { key: "done", label: "Done", type: "boolean" } as any]);
        expect(filterApplicableViewTypes(ALL, model)).toEqual(expect.arrayContaining(["calendar", "kanban"]));
    });
});

describe("getSelectableViewTypes", () => {
    it("filters each place's own candidates", async () => {
        const { getSelectableViewTypes } = await import("./applicableViewTypes");
        const model = modelWith([{ key: "name", label: "Name", type: "string" } as any]);
        expect(getSelectableViewTypes("kanban-column", model)).toEqual(["list", "table", "primary", "totals-details"]);
        expect(getSelectableViewTypes("relation-show", model)).not.toContain("editable-table");
        expect(getSelectableViewTypes("relation-edit", model)).toContain("editable-table");
        expect(getSelectableViewTypes("list-page", model)).not.toContain("crosstab");
    });
});

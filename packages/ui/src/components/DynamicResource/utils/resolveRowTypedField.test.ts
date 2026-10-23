import { beforeAll, describe, expect, it } from "vitest";
import type { FieldDef } from "../types";

// The view-config helpers read window._ (i18n) when loaded; tests run in Node.
let resolveRowTypedField: typeof import("./resolveRowTypedField").resolveRowTypedField;
beforeAll(async () => {
    (globalThis as any).window = (globalThis as any).window ?? { _: (text: string) => text };
    ({ resolveRowTypedField } = await import("./resolveRowTypedField"));
});

const valueField: FieldDef = {
    key: "value", label: "Value", type: "string", typeFromField: "value_type", optionsFromField: "options",
};

describe("resolveRowTypedField", () => {
    it("leaves ordinary fields unchanged", () => {
        const field: FieldDef = { key: "name", label: "Name", type: "string" };
        expect(resolveRowTypedField(field, { name: "x" })).toBe(field);
    });

    it("takes a FieldDef type from the row", () => {
        expect(resolveRowTypedField(valueField, { value_type: "number" }).type).toBe("number");
        expect(resolveRowTypedField(valueField, { value_type: "boolean" }).type).toBe("boolean");
    });

    it("maps a field view type token to its read-only and editable views", () => {
        const resolved = resolveRowTypedField(valueField, { value_type: "color" });
        expect(resolved.type).toBe("string");
        expect(resolved.showViewType).toBe("read-only-color");
        expect(resolved.editViewType).toBe("editable-color");
    });

    it("takes the allowed values from the row", () => {
        const resolved = resolveRowTypedField(valueField, { value_type: "string", options: ["a", "b"] });
        expect(resolved.options).toEqual([{ label: "a", value: "a" }, { label: "b", value: "b" }]);
        expect(resolveRowTypedField(valueField, { value_type: "string", options: [] }).options).toBeUndefined();
    });
});

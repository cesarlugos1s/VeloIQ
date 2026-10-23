/**
 * Row-typed fields: a field whose type and allowed values come from other
 * fields of the same row (`FieldDef.typeFromField`, `FieldDef.optionsFromField`).
 *
 * Parameter lists hold one setting per row, and each row's value has its own
 * type (a number, an on/off switch, a color, a pick-list). The field renderers
 * call `resolveRowTypedField` with the row before rendering, so every view type
 * (list, table, show/edit forms, grid cells) gets the right editor and display
 * for each row from this one place.
 */
import type { FieldDef } from "../types";
import { normalizeFieldViewType } from "./viewConfig";

/** The FieldDef types a row may name directly. */
const ROW_TYPED_FIELD_TYPES: ReadonlyArray<FieldDef["type"]> = [
    "string", "number", "boolean", "date", "datetime", "time", "image_url",
];

/** Strip the read-only-/editable- prefix of a field view type token. */
const fieldViewTypeWithoutModePrefix = (token: string): string => token.replace(/^(read-only-|editable-)/, "");

/**
 * Return `field` as it applies to `record`: its type from the row's
 * `typeFromField` value (a FieldDef type, or a field view type token such as
 * "color" for the matching read-only-/editable- views), and its options from
 * the row's `optionsFromField` list. Other fields are returned unchanged.
 */
export function resolveRowTypedField(field: FieldDef, record: any): FieldDef {
    if (!field.typeFromField && !field.optionsFromField) return field;
    const resolved: FieldDef = { ...field };
    if (field.typeFromField) {
        const rowType = record?.[field.typeFromField];
        if (ROW_TYPED_FIELD_TYPES.includes(rowType)) {
            resolved.type = rowType;
        } else if (typeof rowType === "string" && rowType) {
            const base = fieldViewTypeWithoutModePrefix(normalizeFieldViewType(`read-only-${fieldViewTypeWithoutModePrefix(rowType)}`) || "");
            resolved.type = "string";
            if (base) {
                resolved.showViewType = field.showViewType || `read-only-${base}`;
                if (normalizeFieldViewType(`editable-${base}`)) {
                    resolved.editViewType = field.editViewType || `editable-${base}`;
                }
            }
        }
    }
    if (field.optionsFromField) {
        const options = record?.[field.optionsFromField];
        if (Array.isArray(options) && options.length > 0) {
            resolved.options = options.map((option: any) =>
                option !== null && typeof option === "object" && "value" in option
                    ? option
                    : { label: String(option), value: option });
        }
    }
    return resolved;
}

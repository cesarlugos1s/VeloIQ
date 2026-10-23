/**
 * Inline row editing of list pages: the "editable-table" and "editable-list"
 * list view types of DynamicList (top-level lists, one-to-many relation lists,
 * grid cells), for models and non-model data resources alike.
 *
 * Changed cells are staged per row; Save sends one PATCH per changed row and
 * keeps the rows the server refused staged, with the server's (translated)
 * message, so the user can correct them. Each cell's editor is the standard
 * form editor of its field (`renderInput`), resolved for the row, so a
 * row-typed field (parameter lists) gets each row's own editor.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Button, Form, Space, Tooltip, message } from "antd";
import { CloseOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { FieldDef, ModelDef } from "./types";
import { renderInput } from "./fields/renderInput";
import { resolveRowTypedField } from "./utils/resolveRowTypedField";
import { resolveResourcePath } from "./utils/model";
import { authenticatedFetch } from "../../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** The list view types that edit rows inline. */
export const INLINE_EDIT_LIST_VIEW_TYPES = new Set(["editable-table", "editable-list"]);

/** True when `field` can be edited in a list cell (not read-only, a key or a formula). */
export function isInlineEditableField(field: FieldDef, model: ModelDef): boolean {
    if (field.readOnly || field.formula || field.isPk) return false;
    if (model.pkField && field.key === model.pkField) return false;
    if ((model.pkFields || []).includes(field.key)) return false;
    return true;
}

/** Return a form value as JSON for the field's type (dayjs dates become ISO text). */
function formValueAsPayloadValue(field: FieldDef, value: any): any {
    if (dayjs.isDayjs(value)) {
        if (field.type === "date") return value.format("YYYY-MM-DD");
        if (field.type === "time") return value.format("HH:mm:ss");
        return value.toISOString();
    }
    return value;
}

/** Staged inline edits of a list and the actions on them. */
export interface InlineRowEdits {
    /** True while at least one cell has a change that isn't saved. */
    hasPendingEdits: boolean;
    saving: boolean;
    /** Record a cell's new value. */
    stageValue: (rowId: string | number, fieldKey: string, value: any) => void;
    /** The cell's staged value, or `undefined` when the cell is unchanged. */
    stagedValue: (rowId: string | number, fieldKey: string) => any;
    /** The server's message for a row whose save was refused. */
    rowError: (rowId: string | number) => string | undefined;
    save: () => Promise<void>;
    cancel: () => void;
}

/**
 * Keep the staged inline edits of a list and save them.
 *
 * @param model      The list's model (or non-model data resource).
 * @param allModels  Every ModelDef, to resolve the resource path.
 * @param apiUrl     The API base URL.
 * @param onSaved    Called after a save that changed at least one row (e.g. to refetch the list).
 */
export function useInlineRowEdits(model: ModelDef, allModels: ModelDef[] | undefined, apiUrl: string,
                                  onSaved: () => void): InlineRowEdits {
    const [stagedValuesByRowId, setStagedValuesByRowId] = useState<Record<string, Record<string, any>>>({});
    const [saveErrorsByRowId, setSaveErrorsByRowId] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const stageValue = useCallback((rowId: string | number, fieldKey: string, value: any) => {
        setStagedValuesByRowId((previous) => ({ ...previous, [String(rowId)]: { ...(previous[String(rowId)] || {}), [fieldKey]: value } }));
    }, []);

    const stagedValue = useCallback((rowId: string | number, fieldKey: string) => stagedValuesByRowId[String(rowId)]?.[fieldKey], [stagedValuesByRowId]);
    const rowError = useCallback((rowId: string | number) => saveErrorsByRowId[String(rowId)], [saveErrorsByRowId]);
    const cancel = useCallback(() => { setStagedValuesByRowId({}); setSaveErrorsByRowId({}); }, []);

    const save = useCallback(async () => {
        const entries = Object.entries(stagedValuesByRowId);
        if (entries.length === 0) return;
        setSaving(true);
        const resource = resolveResourcePath(model.resource || model.name, allModels);
        const fieldsByKey = new Map(model.fields.map((field) => [field.key, field]));
        const stillStaged: Record<string, Record<string, any>> = {};
        const nextErrors: Record<string, string> = {};
        let savedRows = 0;
        for (const [rowId, values] of entries) {
            const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => {
                const field = fieldsByKey.get(key);
                return [key, field ? formValueAsPayloadValue(field, value) : value];
            }));
            try {
                const response = await authenticatedFetch(`${apiUrl}/${resource}/${encodeURIComponent(rowId)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    stillStaged[rowId] = values;
                    nextErrors[rowId] = typeof body?.detail === "string" ? body.detail : _("Failed to save changes.");
                } else {
                    savedRows += 1;
                }
            } catch (error) {
                stillStaged[rowId] = values;
                nextErrors[rowId] = error instanceof Error ? error.message : _("Failed to save changes.");
            }
        }
        setStagedValuesByRowId(stillStaged);
        setSaveErrorsByRowId(nextErrors);
        setSaving(false);
        if (Object.keys(nextErrors).length > 0) {
            message.error(Object.values(nextErrors)[0]);
        } else {
            message.success(_("Changes saved."));
        }
        if (savedRows > 0) onSaved();
    }, [stagedValuesByRowId, model, allModels, apiUrl, onSaved]);

    return { hasPendingEdits: Object.keys(stagedValuesByRowId).length > 0, saving, stageValue, stagedValue, rowError, save, cancel };
}

/** Save / Cancel buttons of an inline-edited list. */
export const InlineEditActions: React.FC<{ inlineRowEdits: InlineRowEdits }> = ({ inlineRowEdits }) => (
    <Space size={4}>
        <Tooltip title={_("Cancel")}>
            <Button size="small" icon={<CloseOutlined />} onClick={inlineRowEdits.cancel} disabled={!inlineRowEdits.hasPendingEdits || inlineRowEdits.saving} aria-label={_("Cancel")} />
        </Tooltip>
        <Tooltip title={_("Save")}>
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => void inlineRowEdits.save()} loading={inlineRowEdits.saving} disabled={!inlineRowEdits.hasPendingEdits} aria-label={_("Save")} />
        </Tooltip>
    </Space>
);

/**
 * The editor of one list cell: the field's standard form editor for this row,
 * showing the staged value when the cell was changed.
 */
export const InlineCellEditor: React.FC<{
    field: FieldDef;
    record: any;
    rowId: string | number;
    model: ModelDef;
    allModels?: ModelDef[];
    inlineRowEdits: InlineRowEdits;
}> = ({ field, record, rowId, model, allModels, inlineRowEdits }) => {
    const rowField = useMemo(() => resolveRowTypedField(field, record), [field, record]);
    const stagedCellValue = inlineRowEdits.stagedValue(rowId, field.key);
    const value = stagedCellValue !== undefined ? stagedCellValue : record?.[field.key];
    // A form per cell lets the standard editors (which expect Form.Item to give
    // them value/onChange) be reused unchanged.
    return (
        <Form
            component={false}
            fields={[{ name: ["cell"], value }]}
            onValuesChange={(changed) => inlineRowEdits.stageValue(rowId, field.key, changed.cell)}
        >
            <Form.Item
                name="cell"
                style={{ margin: 0, minWidth: 120 }}
                valuePropName={rowField.type === "boolean" ? "checked" : "value"}
                getValueProps={(current) => (rowField.type === "date" || rowField.type === "datetime") && current && !dayjs.isDayjs(current)
                    ? { value: dayjs(current) }
                    : rowField.type === "time" && current && !dayjs.isDayjs(current)
                        ? { value: dayjs("1970-01-01T" + current) }
                        : rowField.type === "boolean" ? { checked: current === true || current === "true" } : { value: current }}
            >
                {renderInput(field, allModels, model, rowId, record)}
            </Form.Item>
        </Form>
    );
};

/**
 * Editor of the filters by field values: pick a field, then the values to keep.
 * The values are the `columnFilters` of the shared view state, so a configuration
 * tool edits exactly what a user sets with the column filters of a list. When the
 * options of a field are known (see buildColumnFilterOptions, which also encodes
 * value ranges) they are offered as choices; otherwise values are typed.
 */
import React from "react";
import { Button, Select, Space, theme } from "antd";
import type { FieldDef } from "../types";
import type { ColumnFilterOption } from "../utils/columnFilters";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface ColumnFilterValuesEditorProps {
    fields: FieldDef[];
    /** Field key to the selected values. */
    selected: Record<string, string[]>;
    /** Same contract as a React state setter, so callers keep their current state. */
    setSelected: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    /** Known value options per field key; a field without any takes typed values. */
    optionsByField?: Map<string, ColumnFilterOption[]>;
}

export const ColumnFilterValuesEditor: React.FC<ColumnFilterValuesEditorProps> = ({ fields, selected, setSelected, optionsByField }) => {
    const { token } = theme.useToken();
    const usedKeys = Object.keys(selected);
    const addableFields = fields.filter((field) => !usedKeys.includes(field.key));
    return (
        <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Filters by field values")}</div>
            {usedKeys.length === 0 && (
                <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{_("No filters yet.")}</div>
            )}
            {usedKeys.map((key) => {
                const options = optionsByField?.get(key);
                return (
                    <Space key={key} align="start" style={{ width: "100%" }}>
                        <span style={{ minWidth: 90 }}>{fields.find((field) => field.key === key)?.label || key}</span>
                        <Select
                            mode={options && options.length > 0 ? "multiple" : "tags"}
                            size="small"
                            style={{ minWidth: 180 }}
                            value={selected[key]}
                            options={options?.map((option) => ({ value: option.value, label: option.text }))}
                            open={options && options.length > 0 ? undefined : false}
                            optionFilterProp="label"
                            onChange={(values) => setSelected((previous) => ({ ...previous, [key]: values }))}
                        />
                        <Button
                            size="small" type="link" danger
                            onClick={() => setSelected((previous) => {
                                const { [key]: _removed, ...rest } = previous;
                                return rest;
                            })}
                        >{_("Remove")}</Button>
                    </Space>
                );
            })}
            <Select
                size="small" showSearch optionFilterProp="label" value={null as any}
                placeholder={_("Add a field filter")}
                options={addableFields.map((field) => ({ value: field.key, label: field.label || field.key }))}
                onChange={(key) => setSelected((previous) => ({ ...previous, [key]: [] }))}
            />
        </div>
    );
};

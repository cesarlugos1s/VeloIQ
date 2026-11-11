/**
 * Multi-sort control: the ordered list of fields a view is sorted by.
 * Shared by every view type that supports multi-sort (see viewTypeCapabilities);
 * it edits the `sortList` of the shared view state, the same list the table
 * headers show and change with a click (Ctrl-click adds a field).
 */
import React from "react";
import { Button, Select, Tooltip, theme } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined } from "@ant-design/icons";
import type { FieldDef } from "../types";
import type { ColumnSortOrder, ColumnSortState } from "../utils/sorting";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface MultiSortControlProps {
    fields: FieldDef[];
    sortList: ColumnSortState[];
    /** Same contract as a React state setter, so callers keep their current state. */
    setSortList: React.Dispatch<React.SetStateAction<ColumnSortState[]>>;
}

/** The first field not yet in the sort list, or undefined when all are used. */
export function findNextUnsortedFieldKey(fields: FieldDef[], sortList: ColumnSortState[]): string | undefined {
    const used = new Set(sortList.map((item) => item.fieldKey));
    return fields.find((field) => !used.has(field.key))?.key;
}

/** Moves one entry of the list by `offset` positions; out-of-range moves return the list unchanged. */
export function moveSortEntry(sortList: ColumnSortState[], index: number, offset: number): ColumnSortState[] {
    const target = index + offset;
    if (target < 0 || target >= sortList.length) return sortList;
    const next = [...sortList];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export const MultiSortControl: React.FC<MultiSortControlProps> = ({ fields, sortList, setSortList }) => {
    const { token } = theme.useToken();
    const nextFieldKey = findNextUnsortedFieldKey(fields, sortList);
    return (
        <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Sorting")}</div>
            {sortList.length === 0 ? (
                <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{_("No sorting yet.")}</div>
            ) : (
                sortList.map((item, index) => (
                    <div key={item.fieldKey} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Select
                            style={{ minWidth: 180 }}
                            value={item.fieldKey}
                            onChange={(value) => setSortList((prev) => prev
                                .filter((other, otherIndex) => otherIndex === index || other.fieldKey !== value)
                                .map((other) => other.fieldKey === item.fieldKey ? { ...other, fieldKey: value } : other))}
                            options={fields.map((field) => ({ label: field.label, value: field.key }))}
                            placeholder={_("Field")}
                        />
                        <Select<ColumnSortOrder>
                            style={{ minWidth: 140 }}
                            value={item.order}
                            onChange={(order) => setSortList((prev) => prev.map((other) => other.fieldKey === item.fieldKey ? { ...other, order } : other))}
                            options={[
                                { label: _("Ascending"), value: "ascend" },
                                { label: _("Descending"), value: "descend" },
                            ]}
                        />
                        <Tooltip title={_("Move up")}>
                            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => setSortList((prev) => moveSortEntry(prev, index, -1))} />
                        </Tooltip>
                        <Tooltip title={_("Move down")}>
                            <Button size="small" icon={<ArrowDownOutlined />} disabled={index === sortList.length - 1} onClick={() => setSortList((prev) => moveSortEntry(prev, index, 1))} />
                        </Tooltip>
                        <Button size="small" danger onClick={() => setSortList((prev) => prev.filter((other) => other.fieldKey !== item.fieldKey))}>
                            {_("Remove")}
                        </Button>
                    </div>
                ))
            )}
            <div style={{ display: "flex", gap: 8 }}>
                <Button
                    size="small"
                    icon={<PlusOutlined />}
                    disabled={nextFieldKey === undefined}
                    onClick={() => nextFieldKey !== undefined && setSortList((prev) => [...prev, { fieldKey: nextFieldKey, order: "ascend" }])}
                >
                    {_("Add sort")}
                </Button>
                {sortList.length > 0 && (
                    <Button size="small" onClick={() => setSortList([])}>
                        {_("Clear sort")}
                    </Button>
                )}
            </div>
        </div>
    );
};

/**
 * Advanced filter builder: the helper for filters with several conditions.
 * Shared by every view type that offers advanced filters (see
 * viewTypeCapabilities); the rules it edits are the `advancedFilterRules` of the
 * shared view state.
 */
import React from "react";
import { Button, DatePicker, Input, InputNumber, Select, Space, theme } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { FieldDef } from "../types";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface AdvancedFilterRuleDraft {
    id: string;
    fieldKey?: string;
    operator?: string;
    value?: any;
    value2?: any;
}

export interface AdvancedFilterBuilderProps {
    fields: FieldDef[];
    rules: AdvancedFilterRuleDraft[];
    /** Same contract as a React state setter, so callers keep their current state. */
    setRules: React.Dispatch<React.SetStateAction<AdvancedFilterRuleDraft[]>>;
}

export const AdvancedFilterBuilder: React.FC<AdvancedFilterBuilderProps> = ({ fields, rules: filterRules, setRules: setFilterRules }) => {
    const { token } = theme.useToken();
    return (
    <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Advanced filters")}</div>
        {filterRules.length === 0 ? (
            <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{_("No filters yet.")}</div>
        ) : (
            filterRules.map((rule) => {
                const field = fields.find((f) => f.key === rule.fieldKey);
                const type = field?.type || "string";
                const operatorOptions = type === "number"
                    ? [
                        { label: _("="), value: "eq" },
                        { label: _(">"), value: "gt" },
                        { label: _(">="), value: "gte" },
                        { label: _("<"), value: "lt" },
                        { label: _("<="), value: "lte" },
                        { label: _("Between"), value: "between" },
                    ]
                    : type === "date"
                        ? [
                            { label: _("On"), value: "on" },
                            { label: _("After"), value: "after" },
                            { label: _("Before"), value: "before" },
                            { label: _("Between"), value: "between" },
                        ]
                        : type === "boolean"
                            ? [{ label: _("Is"), value: "is" }]
                            : [
                                { label: _("Contains"), value: "contains" },
                                { label: _("Equals"), value: "equals" },
                            ];

                const renderDateInput = (value: any, onChange: (val: any) => void) => {
                    const mode = value?.mode || "absolute";
                    if (mode === "relative") {
                        return (
                            <Space wrap>
                                <InputNumber min={1} value={value?.count ?? 1} onChange={(val) => onChange({ ...value, mode: "relative", count: val ?? 1 })} />
                                <Select
                                    value={value?.direction || "next"}
                                    onChange={(val) => onChange({ ...value, mode: "relative", direction: val })}
                                    options={[
                                        { label: _("Previous"), value: "previous" },
                                        { label: _("Current"), value: "current" },
                                        { label: _("Next"), value: "next" },
                                    ]}
                                />
                                <Select
                                    value={value?.unit || "weeks"}
                                    onChange={(val) => onChange({ ...value, mode: "relative", unit: val })}
                                    options={[
                                        { label: _("Days"), value: "days" },
                                        { label: _("Weeks"), value: "weeks" },
                                        { label: _("Months"), value: "months" },
                                        { label: _("Quarters"), value: "quarters" },
                                        { label: _("Years"), value: "years" },
                                    ]}
                                />
                            </Space>
                        );
                    }
                    return (
                        <DatePicker
                            value={value?.date ? dayjs(value.date) : undefined}
                            onChange={(val) => onChange({ mode: "absolute", date: val ? val.toISOString() : null })}
                        />
                    );
                };

                return (
                    <div key={rule.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Select
                            style={{ minWidth: 180 }}
                            value={rule.fieldKey}
                            onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, fieldKey: value, operator: undefined, value: undefined, value2: undefined } : item))}
                            options={fields.map((f) => ({ label: f.label, value: f.key }))}
                            placeholder={_("Field")}
                        />
                        <Select
                            style={{ minWidth: 140 }}
                            value={rule.operator}
                            onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, operator: value } : item))}
                            options={operatorOptions}
                            placeholder={_("Operator")}
                        />
                        {type === "number" && rule.operator === "between" && (
                            <>
                                <InputNumber
                                    value={rule.value}
                                    onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                                />
                                <InputNumber
                                    value={rule.value2}
                                    onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: value } : item))}
                                />
                            </>
                        )}
                        {type === "number" && rule.operator !== "between" && (
                            <InputNumber
                                value={rule.value}
                                onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                            />
                        )}
                        {type === "boolean" && (
                            <Select
                                style={{ minWidth: 120 }}
                                value={rule.value}
                                onChange={(value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))}
                                options={[
                                    { label: _("True"), value: true },
                                    { label: _("False"), value: false },
                                ]}
                                placeholder={_("Value")}
                            />
                        )}
                        {type === "date" && rule.operator === "between" && (
                            <>
                                {renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item)))}
                                {renderDateInput(rule.value2, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: val } : item)))}
                            </>
                        )}
                        {type === "date" && rule.operator !== "between" && (
                            renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item)))
                        )}
                        {type === "string" && (
                            <Input
                                value={rule.value}
                                onChange={(event) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item))}
                                placeholder={_("Value")}
                                style={{ minWidth: 200 }}
                            />
                        )}
                        {type === "date" && (
                            <Select
                                size="small"
                                value={rule.value?.mode || "absolute"}
                                onChange={(val) => {
                                    setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: { ...(item.value || {}), mode: val } } : item));
                                }}
                                options={[
                                    { label: _("Date"), value: "absolute" },
                                    { label: _("Relative"), value: "relative" },
                                ]}
                            />
                        )}
                        {type === "date" && rule.operator === "between" && (
                            <Select
                                size="small"
                                value={rule.value2?.mode || "absolute"}
                                onChange={(val) => {
                                    setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: { ...(item.value2 || {}), mode: val } } : item));
                                }}
                                options={[
                                    { label: _("Date"), value: "absolute" },
                                    { label: _("Relative"), value: "relative" },
                                ]}
                            />
                        )}
                        <Button
                            size="small"
                            danger
                            onClick={() => setFilterRules((prev) => prev.filter((item) => item.id !== rule.id))}
                        >
                            {_("Remove")}
                        </Button>
                    </div>
                );
            })
        )}
        <div style={{ display: "flex", gap: 8 }}>
            <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={() => setFilterRules((prev) => [...prev, { id: `${Date.now()}-${Math.random()}` }])}
            >
                {_("Add Filter")}
            </Button>
            {filterRules.length > 0 && (
                <Button size="small" onClick={() => setFilterRules([])}>
                    {_("Clear filters")}
                </Button>
            )}
        </div>
    </div>
    );
};

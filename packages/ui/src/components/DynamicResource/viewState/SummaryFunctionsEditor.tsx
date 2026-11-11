/**
 * Summary functions editor: the function (sum, average, ...) applied to each
 * summarizable field. Shared by the view types that use summaries (see
 * viewTypeCapabilities); it edits `summaryFunctions` of the shared view state.
 */
import React from "react";
import { Select, theme } from "antd";
import type { FieldDef } from "../types";
import type { TotalsSummaryFn } from "../utils/sorting";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface SummaryFunctionsEditorProps {
    /** The fields a summary can be set on. */
    fields: FieldDef[];
    resolveFunction: (field: FieldDef) => TotalsSummaryFn;
    onChange: (fieldKey: string, summaryFunction: TotalsSummaryFn) => void;
}

export const SummaryFunctionsEditor: React.FC<SummaryFunctionsEditorProps> = ({ fields, resolveFunction, onChange }) => {
    const { token } = theme.useToken();
    const options = [
        { label: _("Sum"), value: "sum" },
        { label: _("Average"), value: "avg" },
        { label: _("Count"), value: "count" },
        { label: _("Max"), value: "max" },
        { label: _("Min"), value: "min" },
        { label: _("Std Dev"), value: "stddev" },
    ];
    return (
        <div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Totals summary function")}</div>
            <div style={{ display: "grid", gap: 6 }}>
                {fields.length === 0 ? (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("No numeric fields available.")}</div>
                ) : fields.map((field) => (
                    <div key={`summary-${field.key}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>{field.label}</div>
                        <Select
                            size="small"
                            style={{ minWidth: 150 }}
                            value={resolveFunction(field)}
                            options={options}
                            onChange={(value) => onChange(field.key, value as TotalsSummaryFn)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

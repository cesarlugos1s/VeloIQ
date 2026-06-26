import React from "react";
import { Form, Input, Typography, theme } from "antd";
import dayjs from "dayjs";
import type { FieldDef, ModelDef, ViewConfigRow, VisibilityCondition } from "./types";
import { parseInlineStyle } from "./utils/formatting";
import { isDarkColor } from "./utils/colors";
import { getModelTone, type ModelTone } from "../../utils/modelTone";
import { findModelByName, resolveResourcePath, getRecordId } from "./utils/model";
import {
    normalizeSectionRows,
    resolveFieldFromConfig,
    resolveRelationFromConfig,
    isAttributeValueEditable,
    normalizeRelationViewType,
    applyRelationViewOverride,
} from "./utils/viewConfig";
import { getRelationViewType } from "./relations/helpers";
import { renderInput } from "./fields/renderInput";
import { renderFieldValue } from "./fields/renderFieldValue";
import { ReadAndEditReference } from "./fields/ReadAndEditReference";
import { renderRelationBlock } from "../DynamicResource";
import { NLSentenceBlock } from "./blocks/NLSentenceBlock";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const { Title } = Typography;
const requiredMark = (field: FieldDef) =>
    field.required ? <span style={{ color: "#ff4d4f", marginLeft: 3 }}>*</span> : null;

function coerce(v: any): any {
    if (v && typeof v === "object" && typeof v.valueOf === "function") return v.valueOf();
    return v;
}

function evaluateVisibilityCondition(cond: VisibilityCondition, value: any): boolean {
    const lhs = coerce(value);
    const rhs = cond.value;
    switch (cond.operator) {
        // eslint-disable-next-line eqeqeq
        case "eq": return lhs == rhs;
        // eslint-disable-next-line eqeqeq
        case "ne": return lhs != rhs;
        case "in": return Array.isArray(rhs) && rhs.includes(lhs);
        case "not_in": return Array.isArray(rhs) && !rhs.includes(lhs);
        case "truthy": return Boolean(lhs);
        case "falsy": return !lhs;
        case "gt": return lhs > rhs;
        case "lt": return lhs < rhs;
        case "gte": return lhs >= rhs;
        case "lte": return lhs <= rhs;
        case "ilike": return String(lhs ?? "").toLowerCase().includes(String(rhs ?? "").toLowerCase());
        default: return true;
    }
}

const VisibilityGate: React.FC<{ condition?: VisibilityCondition | null; children: React.ReactNode }> = ({ condition, children }) => {
    const watched = Form.useWatch(condition?.field ?? "");
    if (!condition) return <>{children}</>;
    return evaluateVisibilityCondition(condition, watched) ? <>{children}</> : null;
};

export interface SectionCellContentProps {
    sectionName: string;
    sectionRows: ViewConfigRow[];
    model: ModelDef;
    record: any;
    allModels: ModelDef[];
    mode: "show" | "edit";
    formProps?: any;
    showRelationActions?: boolean;
    showRelationCreate?: boolean;
    relationViewTypeDefaults?: { show: string; edit: string };
}

export const SectionCellContent: React.FC<SectionCellContentProps> = ({
    sectionName,
    sectionRows,
    model,
    record,
    allModels,
    mode,
    formProps,
    showRelationActions = true,
    showRelationCreate = true,
    relationViewTypeDefaults = { show: "totals-details", edit: "editable-table" },
}) => {
    const { token } = theme.useToken();
    const modelResource = resolveResourcePath(model.resource || model.name, allModels);
    const recordId = record ? getRecordId(record, model.fields) : undefined;

    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";

    const labelStyle: React.CSSProperties = {
        fontSize: token.fontSize,
        fontWeight: 400,
        color: token.colorTextSecondary,
        margin: 0,
        lineHeight: 1.0,
    };

    const normalized = normalizeSectionRows(sectionRows);
    const maxRow = Math.max(1, ...normalized.map((r) => r.row));
    const maxCol = Math.max(1, ...normalized.map((r) => r.column));

    const renderShowEditableInput = (field: FieldDef, forceReadOnly?: boolean) => {
        const refResource = field.reference ? resolveResourcePath(field.reference, allModels) : undefined;
        const isSelfRef = refResource && modelResource && refResource === modelResource;
        const scalarToken = field.showViewType ? normalizeRelationViewType(field.showViewType) : "";
        const isReadOnlyToken = scalarToken.startsWith("read-only-");
        const isEditableToken = scalarToken === "editable-field";

        if (field.formula || forceReadOnly || isReadOnlyToken) {
            return renderFieldValue(field, record, allModels);
        }
        if (field.reference && !isEditableToken) {
            const fkRelViewType = normalizeRelationViewType(field.showViewType || "") || "read-and-edit-list";
            if (fkRelViewType === "read-and-edit-list") {
                return (
                    <Form.Item name={field.key} style={{ margin: 0 }} noStyle={false}>
                        <ReadAndEditReference
                            field={field}
                            allModels={allModels}
                            model={model}
                            currentId={isSelfRef ? recordId : undefined}
                        />
                    </Form.Item>
                );
            }
        }
        return (
            <Form.Item
                name={field.key}
                rules={field.required && !field.formula ? [{ required: true }] : []}
                valuePropName={field.type === "boolean" ? "checked" : undefined}
                getValueProps={(val) =>
                    (field.type === "date" || field.type === "datetime") && val
                        ? { value: dayjs(val) }
                        : field.type === "time" && val
                        ? { value: dayjs("1970-01-01T" + val) }
                        : { value: val }
                }
                style={{ margin: 0 }}
                noStyle={false}
            >
                {renderInput(field, allModels, model, isSelfRef ? recordId : undefined)}
            </Form.Item>
        );
    };

    const renderItem = (item: ViewConfigRow, index: number) => {
        if (item.attribute_or_relation_type === "nlsentence") {
            if (!item.nl_sentence_eid) return null;
            return (
                <NLSentenceBlock
                    key={`nls-${item.nl_sentence_eid}`}
                    eid={item.nl_sentence_eid}
                    title={item.nl_sentence_title ?? undefined}
                    showLabel={item.show_label !== false}
                />
            );
        }

        if (item.attribute_or_relation_type === "relation") {
            if (!record || !allModels) return null;
            const relation = resolveRelationFromConfig(model.relations, item);
            if (!relation) return null;
            const relationModel = findModelByName(allModels, relation.resource);
            if (!relationModel) return null;
            const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : undefined;
            const relationTone = getModelTone(relatedModel || relationModel || relation.resource) as ModelTone;
            const relWithOverride = applyRelationViewOverride(relation, item, mode);
            const showLabel = item.show_label !== false;
            const resolvedRelViewType = getRelationViewType(relWithOverride, mode, relationViewTypeDefaults);
            const isListView = resolvedRelViewType === "list";
            void isListView;
            const relationValueStyle: React.CSSProperties = {
                padding: "2px 4px",
                lineHeight: 1.15,
                background: valueBackground,
                borderRadius: 6,
                overflowWrap: "anywhere",
                maxWidth: "100%",
                ...parseInlineStyle(item.html_format),
            };
            const relationLabelStyle: React.CSSProperties = {
                ...labelStyle,
                background: "transparent",
                color: relationTone.text,
                padding: "2px 8px",
                borderRadius: 6,
            };
            return (
                <div key={`${item.name}-${item.row}-${item.column}-${index}`} style={{ marginBottom: 4 }}>
                    {renderRelationBlock({
                        rel: relWithOverride,
                        relationModel,
                        relatedModel,
                        record,
                        mode,
                        parentResource: model.name,
                        allModels,
                        showActions: showRelationActions,
                        showCreate: showRelationCreate,
                        relationViewTypeDefaults,
                        showLabel,
                        labelStyle: relationLabelStyle,
                        valueStyle: relationValueStyle,
                        fieldLayoutStyle: { display: "flex", flexDirection: "column", gap: 2 },
                    })}
                </div>
            );
        }

        const field = resolveFieldFromConfig(model, item);
        if (field.isPk) return null;
        const showLabel = item.show_label !== false;
        const valueStyle: React.CSSProperties = {
            padding: "2px 4px",
            lineHeight: 1.15,
            background: valueBackground,
            borderRadius: 6,
            maxWidth: "100%",
            overflowWrap: "anywhere",
            textAlign: field.type === "number" && !field.reference ? "right" : "left",
            fontVariantNumeric: field.type === "number" && !field.reference ? "tabular-nums" : undefined,
            ...parseInlineStyle(item.html_format),
        };

        if (mode === "edit") {
            const editable = isAttributeValueEditable(item, "edit");
            return (
                <div key={`${field.key}-${index}`} style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {showLabel && (
                            <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                                {field.label}{requiredMark(field)}
                            </div>
                        )}
                        <div style={valueStyle}>
                            {editable ? (
                                <Form.Item
                                    name={field.key}
                                    rules={field.required && !field.formula ? [{ required: true }] : []}
                                    valuePropName={field.type === "boolean" ? "checked" : undefined}
                                    getValueProps={(val) =>
                                        (field.type === "date" || field.type === "datetime") && val
                                            ? { value: dayjs(val) }
                                            : field.type === "time" && val
                                            ? { value: dayjs("1970-01-01T" + val) }
                                            : { value: val }
                                    }
                                    style={{ margin: 0 }}
                                >
                                    {field.formula ? <Input disabled /> : renderInput(field, allModels, model, recordId)}
                                </Form.Item>
                            ) : (
                                renderFieldValue(field, record, allModels)
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // show mode
        const editable = Boolean(formProps) && isAttributeValueEditable(item, "show");
        const forceReadOnly = Boolean(formProps) && Boolean(item.read_only_in_edit);
        return (
            <VisibilityGate key={`${item.name}-${item.row}-${item.column}`} condition={item.visibility_condition}>
                <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {showLabel && (
                            <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                                {field.label}{requiredMark(field)}
                            </div>
                        )}
                        <div style={valueStyle}>
                            {(editable || forceReadOnly)
                                ? renderShowEditableInput(field, forceReadOnly)
                                : renderFieldValue(field, record, allModels)}
                        </div>
                    </div>
                </div>
            </VisibilityGate>
        );
    };

    return (
        <div style={{ padding: "4px 6px" }}>
            <Title level={5} style={{ margin: "0 0 4px 0", color: "#1677ff" }}>{_(sectionName)}</Title>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <tbody>
                    {Array.from({ length: maxRow }).map((_, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                            {Array.from({ length: maxCol }).map((_, colIndex) => {
                                const cellItems = normalized.filter(
                                    (item) => item.row === rowIndex + 1 && item.column === colIndex + 1
                                );
                                return (
                                    <td
                                        key={`cell-${rowIndex}-${colIndex}`}
                                        style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}
                                    >
                                        {cellItems.map((item, idx) => renderItem(item, idx))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

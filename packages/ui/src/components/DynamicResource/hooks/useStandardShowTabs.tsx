import React, { useMemo } from "react";
import { Form, Input, Skeleton, Typography, theme } from "antd";
import dayjs from "dayjs";
import { useModelTone, getModelTone, type ModelTone } from "../../../utils/modelTone";
import type { FieldDef, ModelDef, ViewConfigRow, VisibilityCondition } from "../types";
import { applyI18nLabelsToModel, applyI18nLabelsToModels } from "../utils/i18n";
import { parseInlineStyle } from "../utils/formatting";
import { isDarkColor, renderToneTabLabel } from "../utils/colors";
import { findModelByName, getRecordId, resolveResourcePath } from "../utils/model";
import {
    DETAILS_TAB_NAME,
    splitRelations,
    useViewConfigurations,
    useViewSettings,
    filterConfigRowsForMode,
    groupConfigRowsBySectionId,
    normalizeSectionRows,
    resolveFieldFromConfig,
    resolveRelationFromConfig,
    buildConfiguredRelationKeys,
    buildConfiguredResolvedRelationKeys,
    buildConfiguredRelationDisplayKeys,
    isRelationConfiguredForDetails,
    isAttributeValueEditable,
    normalizeRelationViewType,
    applyRelationViewOverride,
} from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import { renderFieldValue } from "../fields/renderFieldValue";
import {
    DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
    getRelationViewType,
    getRelationTabName,
    getTabDisplayLabel,
} from "../relations/helpers";
import { renderRelationBlock } from "../../DynamicResource";
import { NLSentenceBlock } from "../blocks/NLSentenceBlock";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const { Title } = Typography;

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

export const useStandardShowTabs = (
    model: ModelDef | undefined,
    record: any,
    allModels: ModelDef[],
    actionsState?: { showActions: boolean; showCreate: boolean },
    editForm?: {
        formProps?: any;
        effectiveFields?: FieldDef[];
    },
    overrideConfigRows?: ViewConfigRow[],
) => {
    if (!model) return [];
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const { token } = theme.useToken();
    const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
    const modelTone = useModelTone(model);
    const relationViewTypeDefaults = useMemo(
        () => ({
            show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
            edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table",
        }),
        [viewSettings?.showViewType, viewSettings?.editViewType],
    );
    const { rows: fetchedConfigRows, loading: showConfigLoading } = useViewConfigurations(
        overrideConfigRows ? undefined : model.name,
        "PrimaryView",
    );
    const showConfigRows = overrideConfigRows ?? fetchedConfigRows;
    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";

    const { embedded, tabbed } = splitRelations(model.relations);
    const labelStyle: React.CSSProperties = {
        fontSize: token.fontSize,
        fontWeight: 400,
        color: token.colorTextSecondary,
        margin: 0,
        lineHeight: 1.0,
    };
    const resolvedActionsState = actionsState ?? {
        showActions: DEFAULT_SHOW_RELATION_ROW_ACTIONS,
        showCreate: DEFAULT_RELATION_CREATE_ACTIONS,
    };

    const configRows = filterConfigRowsForMode(showConfigRows, "show");
    const hasConfig = configRows.length > 0;
    const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
    const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
    const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
    const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;

    // Split rows by tab_name: empty/null → Details tab; non-empty → custom tabs
    const detailsConfigRows = configRows.filter(r => !r.tab_name);
    const customTabNames = Array.from(new Set(
        configRows.filter(r => !!r.tab_name).map(r => r.tab_name as string)
    ));

    const configSections = groupConfigRowsBySectionId(detailsConfigRows);
    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";

    const showDetailsLoading = showConfigLoading || viewSettingsLoading;
    const showFormProps = editForm?.formProps;
    const showEffectiveFields = editForm?.effectiveFields || model.fields;
    const currentId = getRecordId(record, model.fields);
    const modelResource = resolveResourcePath(model.resource || model.name, allModels);
    const renderShowEditableInput = (field: FieldDef, forceReadOnly?: boolean) => {
        const refResource = field.reference ? resolveResourcePath(field.reference, allModels) : undefined;
        const isSelfRef = refResource && modelResource && refResource === modelResource;
        return (
            <Form.Item
                name={field.key}
                rules={field.required && !field.formula && !forceReadOnly ? [{ required: true }] : []}
                valuePropName={field.type === 'boolean' ? 'checked' : undefined}
                getValueProps={(val) => (field.type === 'date' || field.type === 'datetime') && val ? { value: dayjs(val) } : field.type === 'time' && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }}
                style={{ margin: 0 }}
                noStyle={false}
            >
                {(field.formula || forceReadOnly) ? <Input disabled /> : renderInput(field, allModels, model, isSelfRef ? currentId : undefined)}
            </Form.Item>
        );
    };

    const detailsTab = {
        key: "details",
        label: renderToneTabLabel(_("Details"), modelTone),
        children: (
            <Form
                initialValues={!showFormProps ? record : undefined}
                {...(showFormProps || {})}
                layout="horizontal"
                size="small"
                style={{ paddingBottom: 24 }}
            >
                {showDetailsLoading && (
                    <Skeleton active paragraph={{ rows: 6 }} />
                )}
                {!showDetailsLoading && !hasConfig && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 0 }}>
                        {showEffectiveFields.filter(f => f.key !== 'eid').map((field) => (
                            <div
                                key={field.key}
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "flex-start",
                                    gap: "4px 6px",
                                }}
                            >
                                <span style={{ ...labelStyle, flex: "0 0 200px" }}>{field.label}</span>
                                <div
                                    style={{
                                        flex: "1 0 200px",
                                        padding: "2px 4px",
                                        lineHeight: 1.15,
                                        textAlign: field.type === "number" ? "right" : "left",
                                        fontVariantNumeric: field.type === "number" ? "tabular-nums" : undefined,
                                        overflowWrap: "anywhere",
                                        background: valueBackground,
                                        borderRadius: 6,
                                    }}
                                >
                                    {showFormProps
                                        ? renderShowEditableInput(field)
                                        : renderFieldValue(field, record, allModels)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {!showDetailsLoading && hasConfig && (
                    <div style={{ marginTop: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {(() => {
                            // Group sections by page-level grid row; sort by grid col within each row
                            const gridRowMap = new Map<number, Array<{ name: string; rows: ViewConfigRow[]; gridCol: number }>>();
                            for (const [, { name: sectionName, rows }] of configSections.entries()) {
                                const gridRow = rows[0]?.section_grid_row ?? 1;
                                const gridCol = rows[0]?.section_grid_col ?? 1;
                                const arr = gridRowMap.get(gridRow) || [];
                                arr.push({ name: sectionName, rows, gridCol });
                                gridRowMap.set(gridRow, arr);
                            }
                            return Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
                                const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
                                return (
                                    <div key={`gr-${gridRow}`} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                        {rowSections.map(({ name: section, rows }) => {
                            const normalized = normalizeSectionRows(rows);
                            const maxRow = Math.max(1, ...normalized.map((row) => row.row));
                            const maxCol = Math.max(1, ...normalized.map((row) => row.column));
                            return (
                                <div
                                    key={section}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        border: `1px solid ${token.colorBorder}`,
                                        borderRadius: 8,
                                        padding: "6px 6px",
                                    }}
                                >
                                    <Title level={5} style={{ margin: 0, color: "#1677ff" }}>{_(section)}</Title>
                                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                        <tbody>
                                            {Array.from({ length: maxRow }).map((_, rowIndex) => (
                                                <tr key={`row-${section}-${rowIndex}`}>
                                                    {Array.from({ length: maxCol }).map((_, colIndex) => {
                                                        const cellItems = normalized.filter(
                                                            (item) => item.row === rowIndex + 1 && item.column === colIndex + 1
                                                        );
                                                        return (
                                                            <td key={`cell-${section}-${rowIndex}-${colIndex}`} style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}>
                                                                {cellItems.map((item) => {
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
                                                                        const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
                                                                        const relWithOverride = applyRelationViewOverride(relation, item, "show");
                                                                        const showLabel = item.show_label !== false;
                                                                        const resolvedRelViewType = getRelationViewType(relWithOverride, "show", relationViewTypeDefaults);
                                                                        const isListView = resolvedRelViewType === "list";
                                                                        const relationValueStyle: React.CSSProperties = {
                                                                            padding: "2px 4px",
                                                                            lineHeight: 1.15,
                                                                            background: valueBackground,
                                                                            borderRadius: 6,
                                                                            overflowWrap: "anywhere",
                                                                            maxWidth: "100%",
                                                                            ...parseInlineStyle(item.html_format)
                                                                        };
                                                                        const relationLabelStyle: React.CSSProperties = {
                                                                            ...labelStyle,
                                                                            background: "transparent",
                                                                            color: relationTone.text,
                                                                            padding: "2px 8px",
                                                                            borderRadius: 6,
                                                                        };
                                                                        const relationLayoutStyle: React.CSSProperties = {
                                                                            display: "flex",
                                                                            flexDirection: "column",
                                                                            gap: 2,
                                                                        };
                                                                        return (
                                                                            <div key={`${item.name}-${item.row}-${item.column}`} style={{ marginBottom: 4 }}>
                                                                                {renderRelationBlock({
                                                                                    rel: relWithOverride,
                                                                                    relationModel,
                                                                                    relatedModel,
                                                                                    record,
                                                                                    mode: "show",
                                                                                    parentResource: model.name,
                                                                                    allModels,
                                                                                    showActions: resolvedActionsState.showActions,
                                                                                    showCreate: resolvedActionsState.showCreate,
                                                                                    relationViewTypeDefaults,
                                                                                    showLabel,
                                                                                    labelStyle: relationLabelStyle,
                                                                                    valueStyle: { ...relationValueStyle, border: `1px solid ${token.colorBorder}` },
                                                                                    fieldLayoutStyle: relationLayoutStyle,
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    const field = resolveFieldFromConfig(model, item);
                                                                    const showLabel = item.show_label !== false;
                                                                    const editable = Boolean(showFormProps) && isAttributeValueEditable(item, "show");
                                                                    const forceReadOnly = Boolean(showFormProps) && Boolean(item.read_only_in_edit);
                                                                    const valueStyle: React.CSSProperties = {
                                                                        padding: "2px 4px",
                                                                        lineHeight: 1.15,
                                                                        background: valueBackground,
                                                                        borderRadius: 6,
                                                                        maxWidth: "100%",
                                                                        overflowWrap: "anywhere",
                                                                        textAlign: field.type === "number" ? "right" : "left",
                                                                        fontVariantNumeric: field.type === "number" ? "tabular-nums" : undefined,
                                                                        ...parseInlineStyle(item.html_format)
                                                                    };
                                                                    return (
                                                                        <VisibilityGate key={`${item.name}-${item.row}-${item.column}`} condition={item.visibility_condition}>
                                                                            <div style={{ marginBottom: 4 }}>
                                                                                <div
                                                                                    style={{
                                                                                        display: "flex",
                                                                                        flexDirection: "column",
                                                                                        gap: 2,
                                                                                    }}
                                                                                >
                                                                                    {showLabel && (
                                                                                        <div
                                                                                            style={{
                                                                                                ...labelStyle,
                                                                                                backgroundColor: labelBackground,
                                                                                                padding: "2px 4px",
                                                                                                borderRadius: 4,
                                                                                            }}
                                                                                        >
                                                                                            {field.label}
                                                                                        </div>
                                                                                    )}
                                                                                    <div style={{ ...valueStyle, border: `1px solid ${token.colorBorder}` }}>
                                                                                        {(editable || forceReadOnly)
                                                                                            ? renderShowEditableInput(field, forceReadOnly)
                                                                                            : renderFieldValue(field, record, allModels)}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </VisibilityGate>
                                                                    );
                                                                })}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                                        })}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}
                {!showDetailsLoading && record && allModels && !hasConfiguredDetailRelations && (
                    <div style={{ marginTop: 28 }}>
                        {[...embedded, ...tabbed]
                            .filter((rel) => {
                                const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
                                return getRelationTabName(rel, "show", fallbackTab) === DETAILS_TAB_NAME;
                            })
                            .map((rel) => {
                                const relationModel = findModelByName(allModels, rel.resource);
                                if (!relationModel) return null;
                                const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
                                return renderRelationBlock({
                                    rel,
                                    relationModel,
                                    relatedModel,
                                    record,
                                    mode: "show",
                                    parentResource: model.name,
                                    allModels,
                                    showActions: resolvedActionsState.showActions,
                                    showCreate: resolvedActionsState.showCreate,
                                    relationViewTypeDefaults,
                                });
                            })}
                    </div>
                )}
            </Form>
        )
    };

    const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
    const relationTabGroups = new Map<string, { nodes: React.ReactNode[]; tone: ModelTone }>();
    const allRelations = [...embedded, ...tabbed];
    allRelations.forEach((rel) => {
        if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
        if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
        const relationModel = findModelByName(allModels, rel.resource);
        if (!relationModel) return;
        const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
        const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
        const tabName = getRelationTabName(rel, "show", fallbackTab);
        const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel)
            ? (rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME)
            : tabName;
        if (resolvedTabName === DETAILS_TAB_NAME) return;
        const tone = getModelTone(relatedModel || relationModel || rel.resource);
        const existing = relationTabGroups.get(resolvedTabName);
        const nodes = existing?.nodes || [];
        nodes.push(renderRelationBlock({
            rel,
            relationModel,
            relatedModel,
            record,
            mode: "show",
            parentResource: model.name,
            allModels,
            showActions: resolvedActionsState.showActions,
            showCreate: resolvedActionsState.showCreate,
            relationViewTypeDefaults,
        }));
        relationTabGroups.set(resolvedTabName, { nodes, tone: existing?.tone || tone });
    });

    const relationTabs = Array.from(relationTabGroups.entries()).map(([tabName, group]) => ({
        key: tabName,
        label: renderToneTabLabel(getTabDisplayLabel(tabName), group.tone),
        children: <div>{group.nodes}</div>,
    }));

    // Build custom tab items from page config
    const customConfigTabs = customTabNames.map(tabName => {
        const tabRows = configRows.filter(r => r.tab_name === tabName);
        const tabSections = groupConfigRowsBySectionId(tabRows);
        const gridRowMap = new Map<number, Array<{ name: string; rows: ViewConfigRow[]; gridCol: number }>>();
        for (const [, { name: sectionName, rows }] of tabSections.entries()) {
            const gridRow = rows[0]?.section_grid_row ?? 1;
            const gridCol = rows[0]?.section_grid_col ?? 1;
            const arr = gridRowMap.get(gridRow) || [];
            arr.push({ name: sectionName, rows, gridCol });
            gridRowMap.set(gridRow, arr);
        }
        const tabChildren = (
            <Form initialValues={!showFormProps ? record : undefined} {...(showFormProps || {})} layout="horizontal" size="small" style={{ paddingBottom: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
                    const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
                    return (
                        <div key={`ct-gr-${gridRow}`} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            {rowSections.map(({ name: section, rows }) => {
                                const normalized = normalizeSectionRows(rows);
                                const maxRow = Math.max(1, ...normalized.map(r => r.row));
                                const maxCol = Math.max(1, ...normalized.map(r => r.column));
                                return (
                                    <div key={section} style={{ flex: 1, minWidth: 0, border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "6px 6px" }}>
                                        <Title level={5} style={{ margin: 0, color: "#1677ff" }}>{_(section)}</Title>
                                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                            <tbody>
                                                {Array.from({ length: maxRow }).map((_, ri) => (
                                                    <tr key={`ct-row-${section}-${ri}`}>
                                                        {Array.from({ length: maxCol }).map((_, ci) => {
                                                            const cellItems = normalized.filter(item => item.row === ri + 1 && item.column === ci + 1);
                                                            return (
                                                                <td key={`ct-cell-${section}-${ri}-${ci}`} style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}>
                                                                    {cellItems.map(item => {
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
                                                                            const relWithOverride = applyRelationViewOverride(relation, item, "show");
                                                                            const showLabel = item.show_label !== false;
                                                                            const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
                                                                            return (
                                                                                <div key={`${item.name}-${item.row}-${item.column}`} style={{ marginBottom: 4 }}>
                                                                                    {renderRelationBlock({
                                                                                        rel: relWithOverride,
                                                                                        relationModel,
                                                                                        relatedModel,
                                                                                        record,
                                                                                        mode: "show",
                                                                                        parentResource: model.name,
                                                                                        allModels,
                                                                                        showActions: resolvedActionsState.showActions,
                                                                                        showCreate: resolvedActionsState.showCreate,
                                                                                        relationViewTypeDefaults,
                                                                                        showLabel,
                                                                                        labelStyle: { ...labelStyle, color: relationTone.text, padding: "2px 8px", borderRadius: 6 },
                                                                                        valueStyle: { padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, overflowWrap: "anywhere", maxWidth: "100%", border: `1px solid ${token.colorBorder}` },
                                                                                        fieldLayoutStyle: { display: "flex", flexDirection: "column", gap: 2 },
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        const field = resolveFieldFromConfig(model, item);
                                                                        const showLabel = item.show_label !== false;
                                                                        const editable = Boolean(showFormProps) && isAttributeValueEditable(item, "show");
                                                                        const forceReadOnly = Boolean(showFormProps) && Boolean(item.read_only_in_edit);
                                                                        return (
                                                                            <VisibilityGate key={`${item.name}-${item.row}-${item.column}`} condition={item.visibility_condition}>
                                                                                <div style={{ marginBottom: 4 }}>
                                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                                                        {showLabel && (
                                                                                            <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                                                                                                {field.label}
                                                                                            </div>
                                                                                        )}
                                                                                        <div style={{ padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, maxWidth: "100%", overflowWrap: "anywhere", border: `1px solid ${token.colorBorder}`, ...parseInlineStyle(item.html_format) }}>
                                                                                            {(editable || forceReadOnly) ? renderShowEditableInput(field, forceReadOnly) : renderFieldValue(field, record, allModels)}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </VisibilityGate>
                                                                        );
                                                                    })}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                </div>
            </Form>
        );
        return {
            key: `custom-tab::${tabName}`,
            label: renderToneTabLabel(_(tabName), { bg: "transparent", text: token.colorText, border: token.colorBorder } as any),
            children: tabChildren,
        };
    });

    const items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> = [detailsTab];
    items.push(...customConfigTabs);
    items.push(...relationTabs);

    // ── Named-query relation tabs ─────────────────────────────────────────────
    // Two eligibility patterns:
    //   A) primaryResource === currentResource — the query's primary model IS the
    //      current show model.  Filter key = query pkField (e.g. ?id=1).
    //   B) A field in the query has reference === currentResource — a FK in the
    //      query points back to the current model.  Filter key = that field's key.
    const currentResource = model.resource || model.name.toLowerCase();
    const namedQueryTabs = (allModels || [])
        .filter((m) => m.isNamedQuery)
        .flatMap((queryModel) => {
            if (!record) return [];
            const currentId = getRecordId(record, model.fields);
            let filterKey: string | undefined;
            if (queryModel.primaryResource === currentResource) {
                // Pattern A
                filterKey = queryModel.pkField || "id";
            } else {
                // Pattern B
                const fkField = queryModel.fields.find((f) => f.reference === currentResource);
                filterKey = fkField?.key;
            }
            if (!filterKey) return [];
            const syntheticRel = {
                resource: queryModel.resource || queryModel.name,
                targetKey: filterKey,
                label: queryModel.label,
                showViewType: (queryModel.listViewType as any) || "table",
            };
            const relationModel = queryModel;
            const tone = getModelTone(queryModel.resource || queryModel.name);
            return [{
                key: `named-query::${queryModel.name || queryModel.resource}`,
                label: renderToneTabLabel(queryModel.label, tone),
                children: (
                    <div>
                        {renderRelationBlock({
                            rel: syntheticRel,
                            relationModel,
                            record,
                            mode: "show",
                            parentResource: model.name,
                            allModels,
                            showActions: false,
                            showCreate: false,
                            relationViewTypeDefaults,
                        })}
                    </div>
                ),
            }];
        });
    items.push(...namedQueryTabs);

    return items;
};

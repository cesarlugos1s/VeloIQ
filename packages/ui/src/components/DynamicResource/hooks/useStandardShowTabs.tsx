import React, { useMemo } from "react";
import { useCan } from "@refinedev/core";
import { Form, Skeleton, theme } from "antd";
import dayjs from "dayjs";
import { useModelTone, getModelTone, type ModelTone } from "../../../utils/modelTone";
import type { FieldDef, ModelDef, ViewConfigRow } from "../types";
import { applyI18nLabelsToModel, applyI18nLabelsToModels } from "../utils/i18n";
import { isDarkColor, renderToneTabLabel } from "../utils/colors";
import { findModelByName, getRecordId, resolveResourcePath } from "../utils/model";
import { SectionsGrid } from "../../../pages/dashboard/SectionsGrid";
import { SectionCellContent } from "../SectionCellContent";
import { usePageSectionsConfig } from "./usePageSectionsConfig";
import {
    DETAILS_TAB_NAME,
    splitRelations,
    useViewConfigurations,
    useViewSettings,
    filterConfigRowsForMode,
    synthesizeConfigRows,
    buildConfiguredRelationKeys,
    buildConfiguredResolvedRelationKeys,
    buildConfiguredRelationDisplayKeys,
    isRelationConfiguredForDetails,
    normalizeRelationViewType,
    normalizeFieldViewType,
} from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import { renderFieldValue } from "../fields/renderFieldValue";
import { ReadAndEditReference } from "../fields/ReadAndEditReference";
import {
    DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
    getRelationViewType,
    getRelationTabName,
    getTabDisplayLabel,
} from "../relations/helpers";
import { renderRelationBlock } from "../../DynamicResource";
import type { DataDetailLevelState } from "./useDataDetailLevel";
import { useDataDetailLevel } from "./useDataDetailLevel";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const requiredMark = (field: FieldDef) =>
    field.required ? <span style={{ color: "#ff4d4f", marginLeft: 3 }}>*</span> : null;

const emptyLayoutConfig = {
    isConfiguring: false,
    enterConfigMode: () => {},
    saveLayout: () => {},
    cancelLayout: () => {},
    hasConfig: false,
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
    dataDetailLevelState?: DataDetailLevelState,
) => {
    if (!model) return { tabs: [], layoutConfig: emptyLayoutConfig };
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

    const internalDetailLevelState = useDataDetailLevel(
        model.relations || [],
        "show",
        relationViewTypeDefaults,
    );
    const effectiveDetailState = dataDetailLevelState ?? internalDetailLevelState;
    const relations = effectiveDetailState.applyToRelations(model.relations || []);
    const derivedModel: ModelDef = useMemo(
        () => ({ ...model, relations }),
        [model, relations],
    );
    const { embedded, tabbed } = splitRelations(relations);
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

    const modelResource = resolveResourcePath(model.resource || model.name, allModels);
    const rawConfigRows = filterConfigRowsForMode(showConfigRows, "show");
    const configRows = rawConfigRows.length > 0 ? rawConfigRows : synthesizeConfigRows(model, "show");
    const hasConfig = configRows.length > 0;
    const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
    const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
    const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
    const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;

    // Custom tab names from page config
    const customTabNames = Array.from(new Set(
        configRows.filter(r => !!r.tab_name).map(r => r.tab_name as string)
    ));

    const { config: pageConfig, getSectionRows, isConfiguring, enterConfigMode, saveLayout, cancelLayout, onLayoutChange } = usePageSectionsConfig(
        configRows,
        modelResource,
        "show",
    );
    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;

    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";

    const showDetailsLoading = showConfigLoading || viewSettingsLoading;
    const showFormProps = editForm?.formProps;
    const showEffectiveFields = editForm?.effectiveFields || model.fields;
    const currentId = getRecordId(record, model.fields);
    const renderShowEditableInput = (field: FieldDef, forceReadOnly?: boolean) => {
        const refResource = field.reference ? resolveResourcePath(field.reference, allModels) : undefined;
        const isSelfRef = refResource && modelResource && refResource === modelResource;

        // Resolve scalar and relation view type tokens from showViewType
        const scalarToken = field.showViewType ? normalizeFieldViewType(field.showViewType) : "";
        const isReadOnlyToken = scalarToken.startsWith("read-only-");
        const isEditableToken = scalarToken === "editable-field";

        if (field.formula || forceReadOnly || isReadOnlyToken) {
            return renderFieldValue(field, record, allModels);
        }

        if (field.reference) {
            // "editable-field" on a FK → plain RelationSelect dropdown (falls through to renderInput below)
            if (!isEditableToken) {
                const fkRelViewType = normalizeRelationViewType(field.showViewType || "") || "read-and-edit-list";
                if (fkRelViewType === "read-and-edit-list") {
                    return (
                        <Form.Item name={field.key} style={{ margin: 0 }} noStyle={false}>
                            <ReadAndEditReference
                                field={field}
                                allModels={allModels}
                                model={model}
                                currentId={isSelfRef ? currentId : undefined}
                            />
                        </Form.Item>
                    );
                }
            }
        }

        return (
            <Form.Item
                name={field.key}
                rules={field.required && !field.formula ? [{ required: true }] : []}
                valuePropName={field.type === 'boolean' ? 'checked' : undefined}
                getValueProps={(val) => (field.type === 'date' || field.type === 'datetime') && val ? { value: dayjs(val) } : field.type === 'time' && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }}
                style={{ margin: 0 }}
                noStyle={false}
            >
                {renderInput(field, allModels, model, isSelfRef ? currentId : undefined)}
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
                                <span style={{ ...labelStyle, flex: "0 0 200px" }}>{field.label}{requiredMark(field)}</span>
                                <div
                                    style={{
                                        flex: "1 0 200px",
                                        padding: "2px 4px",
                                        lineHeight: 1.15,
                                        textAlign: field.type === "number" && !field.reference ? "right" : "left",
                                        fontVariantNumeric: field.type === "number" && !field.reference ? "tabular-nums" : undefined,
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
                {!showDetailsLoading && hasConfig && (() => {
                    const detailsTab = pageConfig.tabs.find((t) => t.id === "details");
                    if (!detailsTab) return null;
                    return (
                        <SectionsGrid
                            cells={detailsTab.cells}
                            config={pageConfig}
                            tabId="details"
                            renderContent={(cell) => (
                                <SectionCellContent
                                    sectionName={cell.section_name ?? ""}
                                    sectionRows={getSectionRows(cell.id)}
                                    model={derivedModel}
                                    record={record}
                                    allModels={allModels}
                                    mode="show"
                                    formProps={showFormProps}
                                    showRelationActions={resolvedActionsState.showActions}
                                    showRelationCreate={resolvedActionsState.showCreate}
                                    relationViewTypeDefaults={relationViewTypeDefaults}
                                />
                            )}
                            onConfigChange={onLayoutChange}
                            isConfiguring={isConfiguring && canConfigureLayout}
                        />
                    );
                })()}
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
        const tabId = `tab::${tabName}`;
        const tabCells = pageConfig.tabs.find((t) => t.id === tabId)?.cells ?? [];
        const tabChildren = (
            <Form initialValues={!showFormProps ? record : undefined} {...(showFormProps || {})} layout="horizontal" size="small" style={{ paddingBottom: 8 }}>
                <SectionsGrid
                    cells={tabCells}
                    config={pageConfig}
                    tabId={tabId}
                    renderContent={(cell) => (
                        <SectionCellContent
                            sectionName={cell.section_name ?? ""}
                            sectionRows={getSectionRows(cell.id)}
                            model={derivedModel}
                            record={record}
                            allModels={allModels}
                            mode="show"
                            formProps={showFormProps}
                            showRelationActions={resolvedActionsState.showActions}
                            showRelationCreate={resolvedActionsState.showCreate}
                            relationViewTypeDefaults={relationViewTypeDefaults}
                        />
                    )}
                    onConfigChange={onLayoutChange}
                    isConfiguring={isConfiguring}
                />
            </Form>
        );
        return {
            key: `custom-tab::${tabName}`,
            label: renderToneTabLabel(_(tabName), { bg: "transparent", text: token.colorText, border: token.colorBorder } as any),
            children: tabChildren,
        };
    });

    const layoutConfig = { isConfiguring, enterConfigMode, saveLayout, cancelLayout, hasConfig };

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

    return { tabs: items, layoutConfig, dataDetailLevelState: effectiveDetailState };
};

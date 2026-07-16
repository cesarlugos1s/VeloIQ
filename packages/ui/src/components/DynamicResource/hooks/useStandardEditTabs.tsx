import { setCurrentDataDetailLevelState } from "./DataDetailLevelStore";
import React, { useMemo } from "react";
import { useCan } from "@refinedev/core";
import { Form, Input, Skeleton, theme } from "antd";
import dayjs from "dayjs";
import { useModelTone, getModelTone, type ModelTone } from "../../../utils/modelTone";
import type { FieldDef, ModelDef, ViewConfigRow } from "../types";
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
    applyRelationFieldOverrides,
} from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import {
    DEFAULT_EDIT_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
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

/**
 * Builds the tab items (Details + custom config tabs + relation tabs) for
 * DynamicEdit. Mirrors useStandardShowTabs so page-config-template rows can
 * be injected into Edit pages via `overrideConfigRows`, the same way
 * DbConnectorShow/NLChatShow etc. already do for Show pages.
 */
export const useStandardEditTabs = (
    model: ModelDef | undefined,
    record: any,
    allModels: ModelDef[],
    actionsState?: { showActions: boolean; showCreate: boolean },
    editFormProps?: any,
    overrideConfigRows?: ViewConfigRow[],
    dataDetailLevelState?: DataDetailLevelState,
) => {
    if (!model) return { tabs: [], layoutConfig: emptyLayoutConfig };
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
    const { rows: fetchedEditConfigRows, loading: editConfigLoading } = useViewConfigurations(
        overrideConfigRows ? undefined : model.name,
        "AutomaticEntityForm",
    );
    const { rows: fetchedFallbackConfigRows, loading: fallbackConfigLoading } = useViewConfigurations(
        overrideConfigRows ? undefined : model.name,
        "PrimaryView",
    );
    const editConfigRows = overrideConfigRows ?? fetchedEditConfigRows;
    const fallbackConfigRows = overrideConfigRows ?? fetchedFallbackConfigRows;
    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";

    const internalDetailLevelState = useDataDetailLevel(
        model.relations || [],
        "edit",
        relationViewTypeDefaults,
    );
    const effectiveDetailState = dataDetailLevelState ?? internalDetailLevelState;
    setCurrentDataDetailLevelState(effectiveDetailState);
    const appliedRels = effectiveDetailState.applyToRelations(model.relations || []);
    const derivedModel: ModelDef = useMemo(
        () => ({ ...model, relations: appliedRels }),
        [model, appliedRels],
    );
    const { embedded, tabbed } = splitRelations(appliedRels);
    const labelStyle: React.CSSProperties = {
        fontSize: token.fontSize,
        fontWeight: 400,
        color: token.colorTextSecondary,
        margin: 0,
        lineHeight: 1.0,
    };
    const resolvedActionsState = actionsState ?? {
        showActions: DEFAULT_EDIT_RELATION_ROW_ACTIONS,
        showCreate: DEFAULT_RELATION_CREATE_ACTIONS,
    };

    const effectiveFields = useMemo(() => applyRelationFieldOverrides(model, allModels), [model, allModels]);
    const recordId = getRecordId(record, model.fields);
    const resourceKey = resolveResourcePath(model.resource || model.name, allModels);
    const rawConfigRows = filterConfigRowsForMode(
        editConfigRows.length > 0 ? editConfigRows : fallbackConfigRows,
        "edit",
    );
    const configRows = rawConfigRows.length > 0 ? rawConfigRows : synthesizeConfigRows(model, "edit");
    const hasConfig = configRows.length > 0;
    const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
    const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
    const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
    const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;
    const configLoading = editConfigLoading || fallbackConfigLoading || viewSettingsLoading;

    // Custom tab names from page config
    const customTabNames = Array.from(new Set(
        configRows.filter(r => !!r.tab_name).map(r => r.tab_name as string)
    ));

    const { config: pageConfig, getSectionRows, isConfiguring, enterConfigMode, saveLayout, cancelLayout, onLayoutChange } = usePageSectionsConfig(
        configRows,
        resourceKey,
        "edit",
    );
    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;

    const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
    const relationTabGroups = new Map<string, { nodes: React.ReactNode[]; tone: ModelTone }>();
    const allRelations = [...embedded, ...tabbed];
    if (record && allModels) {
        allRelations.forEach((rel) => {
            if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
            const relationModel = findModelByName(allModels, rel.resource);
            if (!relationModel) return;
            const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
            const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
            const tabName = getRelationTabName(rel, "edit", fallbackTab);
            const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel)
                ? (rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME)
                : tabName;
            if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
            if (resolvedTabName === DETAILS_TAB_NAME) return;
            const tone = getModelTone(relatedModel || relationModel || rel.resource);
            const existing = relationTabGroups.get(resolvedTabName);
            const nodes = existing?.nodes || [];
            nodes.push(renderRelationBlock({
                rel,
                relationModel,
                relatedModel,
                record,
                mode: "edit",
                parentResource: model.name,
                allModels,
                showActions: resolvedActionsState.showActions,
                showCreate: resolvedActionsState.showCreate,
                relationViewTypeDefaults,
            }));
            relationTabGroups.set(resolvedTabName, { nodes, tone: existing?.tone || tone });
        });
    }

    const relationTabs = Array.from(relationTabGroups.entries()).map(([tabName, group]) => ({
        key: tabName,
        label: renderToneTabLabel(getTabDisplayLabel(tabName), group.tone),
        children: <div>{group.nodes}</div>,
    }));

    const items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> = [
        {
            key: "main_data",
            label: renderToneTabLabel(_("Details"), modelTone),
            children: (
                <div style={{ paddingBottom: 2 }}>
                    {configLoading && (
                        <Skeleton active paragraph={{ rows: 6 }} />
                    )}
                    {!configLoading && !hasConfig && (
                    <Form {...editFormProps} size="small">
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 0 }}>
                            {effectiveFields.filter(f => !f.isPk).map((field) => (
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
                                    <div style={{ flex: "1 0 200px", padding: "2px 4px", lineHeight: 1.15, overflowWrap: "anywhere", background: valueBackground, borderRadius: 6 }}>
                                        <Form.Item
                                            name={field.key}
                                            rules={field.required && !field.formula ? [{ required: true }] : []}
                                            valuePropName={field.type === 'boolean' ? 'checked' : undefined}
                                            getValueProps={(val) => (field.type === 'date' || field.type === 'datetime') && val ? { value: dayjs(val) } : field.type === 'time' && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }}
                                            style={{ margin: 0 }}
                                        >
                                            {field.formula ? <Input disabled /> : renderInput(field, allModels, model, recordId)}
                                        </Form.Item>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Form>
                    )}
                    {!configLoading && hasConfig && (() => {
                        const detailsTab = pageConfig.tabs.find((t) => t.id === "details");
                        if (!detailsTab) return null;
                        return (
                        <Form {...editFormProps} size="small" style={{ position: "relative" }}>
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
                                        mode="edit"
                                        showRelationActions={resolvedActionsState.showActions}
                                        showRelationCreate={resolvedActionsState.showCreate}
                                        relationViewTypeDefaults={relationViewTypeDefaults}
                                    />
                                )}
                                onConfigChange={onLayoutChange}
                                isConfiguring={isConfiguring && canConfigureLayout}
                            />
                        </Form>
                        );
                    })()}
                    {!configLoading && record && allModels && !hasConfiguredDetailRelations && (
                        <div style={{ marginTop: 8 }}>
                            {[...embedded, ...tabbed]
                                .filter(rel => {
                                    const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
                                    return getRelationTabName(rel, "edit", fallbackTab) === DETAILS_TAB_NAME;
                                })
                                .map(rel => {
                                    const relationModel = findModelByName(allModels, rel.resource);
                                    if (!relationModel) return null;
                                    const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
                                    return renderRelationBlock({
                                        rel,
                                        relationModel,
                                        relatedModel,
                                        record,
                                        mode: "edit",
                                        parentResource: model.name,
                                        allModels,
                                        showActions: resolvedActionsState.showActions,
                                        showCreate: resolvedActionsState.showCreate,
                                        relationViewTypeDefaults,
                                    });
                                })}
                        </div>
                    )}
                </div>
            )
        },
    ];

    // Custom config tabs (from page config tab_name)
    const customConfigTabs = customTabNames.map(tabName => {
        const tabId = `tab::${tabName}`;
        const tabCells = pageConfig.tabs.find((t) => t.id === tabId)?.cells ?? [];
        const tabChildren = (
            <Form {...editFormProps} size="small" style={{ position: "relative" }}>
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
                            mode="edit"
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
            label: renderToneTabLabel(_(tabName), modelTone),
            children: tabChildren,
        };
    });

    items.push(...customConfigTabs);
    items.push(...relationTabs);

    const layoutConfig = { isConfiguring, enterConfigMode, saveLayout, cancelLayout, hasConfig };

    return { tabs: items, layoutConfig };
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApiUrl, useGo } from "@refinedev/core";
import { useForm, DeleteButton } from "@refinedev/antd";
import { StandardEdit } from "../../StandardCrud";
import { Button, Divider, Form, Input, Popover, Skeleton, Switch, Tabs, Tooltip, Typography, message, theme } from "antd";
import { CopyOutlined, EyeOutlined, SaveFilled, SaveOutlined, SettingOutlined, ApartmentOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";
import { useModelTone, getModelTone, type ModelTone } from "../../../utils/modelTone";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, ViewConfigRow } from "../types";
import { asDisplayText, applyI18nLabelsToModel, applyI18nLabelsToModels, getModuleLabel } from "../utils/i18n";
import { useRoleFilteredModel } from "../utils/roleAccess";
import { renderWrappedPageTitle, parseInlineStyle } from "../utils/formatting";
import { isDarkColor, toneScopeStyle, ToneSharedStyles, renderToneTabLabel } from "../utils/colors";
import { renderIconOnlyButtons } from "../utils/buttons";
import { resolveResourcePath, findModelByName, isFileModel, getRecordId } from "../utils/model";
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
    applyRelationFieldOverrides,
} from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import { renderFieldValue } from "../fields/renderFieldValue";
import {
    DEFAULT_EDIT_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
    getRelationViewType,
    getRelationTabName,
    getTabDisplayLabel,
} from "../relations/helpers";
import { useMetadataModal } from "../hooks/useMetadataModal";
import { renderModelHeading } from "../ModelHeading";
import { renderRelationBlock } from "../../DynamicResource";
import { NLSentenceBlock } from "../blocks/NLSentenceBlock";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const { Title } = Typography;

export interface JourneyCallbacks {
    onSave: (record: any) => void;
    onCancel: () => void;
}

export const DynamicEdit: React.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    topContent?: React.ReactNode;
    extraHeaderButtons?: React.ReactNode;
    journeyCallbacks?: JourneyCallbacks;
    idOverride?: string;
}> = ({ model: modelProp, allModels, topContent, extraHeaderButtons, journeyCallbacks, idOverride }) => {
    const model = useRoleFilteredModel(modelProp);
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const go = useGo();
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const effectiveId = idOverride ?? routeId;
    const [searchParams] = useSearchParams();
    const { token } = theme.useToken();
    const modelTone = useModelTone(model);
    const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
    const relationViewTypeDefaults = useMemo(
        () => ({
            show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
            edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table",
        }),
        [viewSettings?.showViewType, viewSettings?.editViewType],
    );
    const apiUrl = useApiUrl();
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const { rows: editConfigRows, loading: editConfigLoading } = useViewConfigurations(model.name, "AutomaticEntityForm");
    const { rows: fallbackConfigRows, loading: fallbackConfigLoading } = useViewConfigurations(model.name, "PrimaryView");
    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";
    const disableRedirect = searchParams.get("inline") === "1"
        || searchParams.get("redirect") === "false"
        || searchParams.get("redirect") === "0";
    const requestedReturnTo = searchParams.get("returnTo");
    const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") ? requestedReturnTo : null;
    const redirectTarget = disableRedirect ? false : "show";
    const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
    const { formProps, saveButtonProps, queryResult } = useForm({
        resource: model.resource || model.name,
        id: effectiveId,
        redirect: (returnTo || journeyCallbacks) ? false : redirectTarget,
        ...((returnTo || journeyCallbacks)
            ? {
                onMutationSuccess: (response: any) => {
                    if (journeyCallbacks?.onSave) {
                        const record = response?.data?.data || response?.data || response;
                        journeyCallbacks.onSave(record);
                    } else if (returnTo) {
                        navigate(returnTo);
                    }
                },
            }
            : {}),
        successNotification: () => ({
            message: _("Changes saved."),
            description: modelDisplayLabel,
            type: "success",
        }),
    });
    const record = queryResult?.data?.data;

    const editFormProps = useMemo(() => {
        if (!isFileModel(model)) return formProps;
        const originalOnFinish = formProps.onFinish;
        return {
            ...formProps,
            onFinish: (values: any) => {
                const { data: _binaryData, ...rest } = values || {};
                return originalOnFinish?.(rest);
            },
        };
    }, [formProps, model]);

    // Keyboard shortcuts: Ctrl+S to save, Escape to go back or cancel journey
    useKeyboardShortcuts(useMemo(() => [
        { key: "s", ctrl: true, handler: () => (formProps as any)?.form?.submit() },
        { key: "Escape", handler: () => journeyCallbacks?.onCancel ? journeyCallbacks.onCancel() : navigate(-1) },
    ], [(formProps as any)?.form, navigate, journeyCallbacks]));
    const pageTitle = record?._label
        ? asDisplayText(record._label, `${_("Edit")} ${modelDisplayLabel}`)
        : `${_("Edit")} ${modelDisplayLabel}`;
    const recordId = getRecordId(record, model.fields);
    const effectiveFields = useMemo(() => applyRelationFieldOverrides(model, allModelsList), [model, allModelsList]);
    const { metadataButton: editMetadataButton, metadataModal: editMetadataModal } = useMetadataModal(model, allModels);
    const [showRelationActions, setShowRelationActions] = useState(DEFAULT_EDIT_RELATION_ROW_ACTIONS);
    const [showRelationCreate, setShowRelationCreate] = useState(DEFAULT_RELATION_CREATE_ACTIONS);
    const [isSavingActionsPrefs, setIsSavingActionsPrefs] = useState(false);
    const actionsPrefsTouchedRef = useRef(false);
    const actionsPrefsLoadedRef = useRef(false);
    const actionsPrefsResourceRef = useRef<string | null>(null);

    const markActionsPrefsTouched = useCallback(() => {
        actionsPrefsTouchedRef.current = true;
    }, []);

    const saveActionsPreferences = useCallback(async () => {
        const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
        const preferences = {
            showActions: showRelationActions,
            showActionsConfigured: true,
            showCreate: showRelationCreate,
        };
        setIsSavingActionsPrefs(true);
        try {
            const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: resourceKey, preferenceType: "EditActions", preferences }),
            });
            if (!response.ok) {
                throw new Error(`Save failed (${response.status})`);
            }
            message.success("Edit actions preferences saved.");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Failed to save edit actions preferences.");
        } finally {
            setIsSavingActionsPrefs(false);
        }
    }, [apiUrl, allModelsList, model.name, model.resource, showRelationActions, showRelationCreate]);

    const [isDuplicating, setIsDuplicating] = useState(false);

    const duplicateRecord = useCallback(async (withRelations: boolean) => {
        if (!record) return;
        setIsDuplicating(true);
        try {
            // Build payload excluding the PK and metadata fields
            const pkField = model.fields.find((f) => f.isPk);
            const excludeKeys = new Set([pkField?.key, "eid", "id", "creation_date", "modification_date", "_label"].filter(Boolean) as string[]);
            const payload: Record<string, any> = {};
            for (const [key, value] of Object.entries(record)) {
                if (!excludeKeys.has(key) && value !== undefined) {
                    payload[key] = value;
                }
            }

            // Create the duplicate object
            const resourcePath = resolveResourcePath(model.resource || model.name, allModelsList);
            const createResponse = await authenticatedFetch(`${apiUrl}/${resourcePath}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!createResponse.ok) {
                const detail = await createResponse.text();
                throw new Error(detail || `Failed to duplicate (${createResponse.status})`);
            }
            const newRecord = await createResponse.json();
            const newId = getRecordId(newRecord, model.fields);

            // If withRelations, copy all relation links
            if (withRelations && model.relations && newId) {
                const sourceId = getRecordId(record, model.fields);
                for (const rel of model.relations) {
                    if (!rel.resource || !rel.targetKey) continue;
                    const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModelsList);
                    try {
                        // Fetch all relation rows for the source record
                        const params = new URLSearchParams();
                        params.set("_start", "0");
                        params.set("_end", "10000");
                        params.set(rel.targetKey, String(sourceId));
                        const relResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`);
                        if (!relResponse.ok) continue;
                        const relRows = await relResponse.json();
                        if (!Array.isArray(relRows)) continue;

                        // Create duplicate relation rows pointing to the new record
                        for (const row of relRows) {
                            const relPayload: Record<string, any> = {};
                            for (const [key, value] of Object.entries(row)) {
                                if (!excludeKeys.has(key) && value !== undefined) {
                                    relPayload[key] = value;
                                }
                            }
                            relPayload[rel.targetKey] = newId;
                            await authenticatedFetch(`${apiUrl}/${relationResource}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(relPayload),
                            });
                        }
                    } catch {
                        // Continue with other relations if one fails
                    }
                }
            }

            message.success(withRelations
                ? _("Object duplicated with relations.")
                : _("Object duplicated.")
            );
            // Navigate to the new record's edit page
            if (newId) {
                go({ to: { resource: model.resource || model.name, action: "edit", id: newId } });
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : _("Failed to duplicate object."));
        } finally {
            setIsDuplicating(false);
        }
    }, [record, model, allModelsList, apiUrl, go]);

    useEffect(() => {
        const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
        if (actionsPrefsResourceRef.current !== resourceKey) {
            actionsPrefsLoadedRef.current = false;
            actionsPrefsResourceRef.current = resourceKey;
        }
        if (actionsPrefsLoadedRef.current) return;
        let cancelled = false;
        const loadPreferences = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditActions`);
                if (!response.ok) {
                    throw new Error(`Load failed (${response.status})`);
                }
                const data = await response.json();
                if (cancelled || actionsPrefsTouchedRef.current) return;
                const prefs = data?.preferences;
                if (!prefs || typeof prefs !== "object") return;
                const hasExplicitEditShowActions = Object.prototype.hasOwnProperty.call(prefs, "showActionsConfigured");
                if (hasExplicitEditShowActions && "showActions" in prefs) {
                    setShowRelationActions(Boolean(prefs.showActions));
                }
                if ("showCreate" in prefs) setShowRelationCreate(Boolean(prefs.showCreate));
                actionsPrefsLoadedRef.current = true;
            } catch {
                // Silent failure on auto-load.
            }
        };
        loadPreferences();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, allModelsList, model.name, model.resource]);
    const { embedded, tabbed } = splitRelations(model.relations);
    const labelStyle: React.CSSProperties = {
        fontSize: token.fontSize,
        fontWeight: 400,
        color: token.colorTextSecondary,
        margin: 0,
        lineHeight: 1.0,
    };
    const configRows = filterConfigRowsForMode(
        editConfigRows.length > 0 ? editConfigRows : fallbackConfigRows,
        "edit"
    );
    const hasConfig = configRows.length > 0;
    const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
    const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
    const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
    const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;
    const configLoading = editConfigLoading || fallbackConfigLoading || viewSettingsLoading;

    // Split rows by tab_name: empty/null → Details tab; non-empty → custom tabs
    const detailsConfigRows = configRows.filter(r => !r.tab_name);
    const customTabNames = Array.from(new Set(
        configRows.filter(r => !!r.tab_name).map(r => r.tab_name as string)
    ));

    const configSections = groupConfigRowsBySectionId(detailsConfigRows);
    const actionsSettingsContent = (
        <div style={{ display: "grid", gap: 8, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>{_("Relation's row actions buttons")}</span>
                <Switch
                    checked={showRelationActions}
                    onChange={(checked) => {
                        markActionsPrefsTouched();
                        setShowRelationActions(checked);
                    }}
                    size="small"
                />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>{_("Relation's create action button")}</span>
                <Switch
                    checked={showRelationCreate}
                    onChange={(checked) => {
                        markActionsPrefsTouched();
                        setShowRelationCreate(checked);
                    }}
                    size="small"
                />
            </div>
            <Divider style={{ margin: "4px 0" }} />
            <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={saveActionsPreferences}
                loading={isSavingActionsPrefs}
                block
            >
                {_("Save")}
            </Button>
        </div>
    );

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
                showActions: showRelationActions,
                showCreate: showRelationCreate,
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
                                    <span style={{ ...labelStyle, flex: "0 0 200px" }}>{field.label}</span>
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
                    {!configLoading && hasConfig && (
                    <div style={{ marginTop: 0 }}>
                        <Form
                            {...editFormProps}
                            size="small"
                            style={{ position: "relative" }}
                        >
                                {(() => {
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
                                            <div key={`gr-${gridRow}`} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
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
                                                padding: "2px 6px",
                                            }}
                                        >
                                            <Title level={5} style={{ margin: 0, color: "#1677ff" }}>{_(section)}</Title>
                                            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                                <tbody>
                                                    {Array.from({ length: maxRow }).map((_, rowIndex) => (
                                                        <tr key={`edit-row-${section}-${rowIndex}`}>
                                                            {Array.from({ length: maxCol }).map((_, colIndex) => {
                                                                const cellItems = normalized.filter(
                                                                    (item) => item.row === rowIndex + 1 && item.column === colIndex + 1
                                                                );
                                                                return (
                                                                    <td
                                                                        key={`edit-cell-${section}-${rowIndex}-${colIndex}`}
                                                                        style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}
                                                                    >
                                                                        {cellItems.map((item, index) => {
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
                                                                                const relWithOverride = applyRelationViewOverride(relation, item, "edit");
                                                                                const showLabel = item.show_label !== false;
                                                                                const resolvedRelViewType = getRelationViewType(relWithOverride, "edit", relationViewTypeDefaults);
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
                                                                                            mode: "edit",
                                                                                            parentResource: model.name,
                                                                                            allModels,
                                                                                            showActions: showRelationActions,
                                                                                            showCreate: showRelationCreate,
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
                                                                            if (field.isPk) return null;
                                                                            const showLabel = item.show_label !== false;
                                                                            const editable = isAttributeValueEditable(item, "edit");
                                                                            if (!editable) {
                                                                                const readonlyValueStyle: React.CSSProperties = {
                                                                                    padding: "2px 4px",
                                                                                    lineHeight: 1.15,
                                                                                    background: valueBackground,
                                                                                    borderRadius: 6,
                                                                                    border: `1px solid ${token.colorBorder}`,
                                                                                    maxWidth: "100%",
                                                                                    overflowWrap: "anywhere",
                                                                                    textAlign: field.type === "number" ? "right" : "left",
                                                                                    fontVariantNumeric: field.type === "number" ? "tabular-nums" : undefined,
                                                                                    ...parseInlineStyle(item.html_format)
                                                                                };
                                                                                return (
                                                                                    <div key={`${field.key}-${index}`} style={{ marginBottom: 4 }}>
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
                                                                                            <div style={readonlyValueStyle}>
                                                                                                {renderFieldValue(field, record, allModels)}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div key={`${field.key}-${index}`} style={{ marginBottom: 4 }}>
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
                                                                                        <div style={{
                                                                                            padding: "2px 4px",
                                                                                            lineHeight: 1.15,
                                                                                            background: valueBackground,
                                                                                            borderRadius: 6,
                                                                                            border: `1px solid ${token.colorBorder}`,
                                                                                            maxWidth: "100%",
                                                                                            overflowWrap: "anywhere",
                                                                                            ...parseInlineStyle(item.html_format)
                                                                                        }}>
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
                                                                                </div>
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
                            </Form>
                        </div>
                    )}
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
                                        showActions: showRelationActions,
                                        showCreate: showRelationCreate,
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
            <Form {...editFormProps} size="small" style={{ position: "relative" }}>
                {Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
                    const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
                    return (
                        <div key={`ct-gr-${gridRow}`} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                            {rowSections.map(({ name: section, rows }) => {
                                const normalized = normalizeSectionRows(rows);
                                const maxRow = Math.max(1, ...normalized.map(r => r.row));
                                const maxCol = Math.max(1, ...normalized.map(r => r.column));
                                return (
                                    <div key={section} style={{ flex: 1, minWidth: 0, border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "2px 6px" }}>
                                        <Title level={5} style={{ margin: 0, color: "#1677ff" }}>{_(section)}</Title>
                                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                            <tbody>
                                                {Array.from({ length: maxRow }).map((_, ri) => (
                                                    <tr key={`ct-row-${section}-${ri}`}>
                                                        {Array.from({ length: maxCol }).map((_, ci) => {
                                                            const cellItems = normalized.filter(item => item.row === ri + 1 && item.column === ci + 1);
                                                            return (
                                                                <td key={`ct-cell-${section}-${ri}-${ci}`} style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}>
                                                                    {cellItems.map((item, idx) => {
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
                                                                            const relWithOverride = applyRelationViewOverride(relation, item, "edit");
                                                                            const showLabel = item.show_label !== false;
                                                                            return (
                                                                                <div key={`${item.name}-${item.row}-${item.column}`} style={{ marginBottom: 4 }}>
                                                                                    {renderRelationBlock({
                                                                                        rel: relWithOverride,
                                                                                        relationModel,
                                                                                        relatedModel,
                                                                                        record,
                                                                                        mode: "edit",
                                                                                        parentResource: model.name,
                                                                                        allModels,
                                                                                        showActions: showRelationActions,
                                                                                        showCreate: showRelationCreate,
                                                                                        relationViewTypeDefaults,
                                                                                        showLabel,
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        const field = resolveFieldFromConfig(model, item);
                                                                        if (field.isPk) return null;
                                                                        const showLabel = item.show_label !== false;
                                                                        const editable = isAttributeValueEditable(item, "edit");
                                                                        return (
                                                                            <div key={`${field.key}-${idx}`} style={{ marginBottom: 4 }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                                                    {showLabel && (
                                                                                        <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                                                                                            {field.label}
                                                                                        </div>
                                                                                    )}
                                                                                    <div style={{ padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, border: `1px solid ${token.colorBorder}`, maxWidth: "100%", overflowWrap: "anywhere", ...parseInlineStyle(item.html_format) }}>
                                                                                        {editable ? (
                                                                                            <Form.Item
                                                                                                name={field.key}
                                                                                                rules={field.required && !field.formula ? [{ required: true }] : []}
                                                                                                valuePropName={field.type === 'boolean' ? 'checked' : undefined}
                                                                                                getValueProps={(val) => (field.type === 'date' || field.type === 'datetime') && val ? { value: dayjs(val) } : field.type === 'time' && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }}
                                                                                                style={{ margin: 0 }}
                                                                                            >
                                                                                                {field.formula ? <Input disabled /> : renderInput(field, allModels, model, recordId)}
                                                                                            </Form.Item>
                                                                                        ) : renderFieldValue(field, record, allModels)}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
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

    const [activeTabKey, setActiveTabKey] = useState("main_data");
    useEffect(() => {
        if (!items.find((item) => item.key === activeTabKey)) {
            setActiveTabKey(items[0]?.key || "main_data");
        }
    }, [activeTabKey, items]);
    const lazyItems = useMemo(
        () => items.map((item) => ({
            ...item,
            children: item.key === activeTabKey ? item.children : null,
        })),
        [activeTabKey, items]
    );
    const renderHeaderButtons = ({ defaultButtons }: { defaultButtons: React.ReactNode }) => (
        <>
            {extraHeaderButtons}
            {editMetadataButton}
            {editMetadataModal}
            {recordId && (
                <Tooltip title={_("Show")}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => go({ to: { resource: model.resource || model.name, action: "show", id: recordId } })} />
                </Tooltip>
            )}
            {record && (
                <>
                    <Tooltip title={_("Duplicate")}>
                        <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => duplicateRecord(false)}
                            loading={isDuplicating}
                        />
                    </Tooltip>
                    <Tooltip title={_("Duplicate with relations")}>
                        <Button
                            size="small"
                            icon={<ApartmentOutlined />}
                            onClick={() => duplicateRecord(true)}
                            loading={isDuplicating}
                        />
                    </Tooltip>
                </>
            )}
            <Popover content={actionsSettingsContent} title={_("Actions")} trigger="hover">
                <Button size="small" icon={<SettingOutlined />} />
            </Popover>
            {renderIconOnlyButtons(defaultButtons)}
            {recordId != null && (
                <Tooltip title={_("Delete")}>
                    <span>
                        <DeleteButton
                            resource={model.resource || model.name}
                            recordItemId={recordId}
                            hideText
                            onSuccess={() => go({ to: { resource: model.resource || model.name, action: "list" } })}
                        />
                    </span>
                </Tooltip>
            )}
            <Tooltip title={_("Save")}>
                <Button {...(saveButtonProps as any)} type="primary" icon={<SaveFilled />} />
            </Tooltip>
        </>
    );
    return (
        <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
            <ToneSharedStyles />
            <StandardEdit
                saveButtonProps={{ ...saveButtonProps, hideText: true }}
                footerButtons={({ defaultButtons }) => renderIconOnlyButtons(defaultButtons)}
                title={renderWrappedPageTitle(renderModelHeading({
                    model,
                    title: pageTitle,
                    actionLabel: _("Edit"),
                    moduleLabel: model.module ? getModuleLabel(model.module) : undefined,
                }))}
                headerButtons={renderHeaderButtons}
            >
                {topContent}
                <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={lazyItems} destroyInactiveTabPane />
            </StandardEdit>
        </div>
    );
};

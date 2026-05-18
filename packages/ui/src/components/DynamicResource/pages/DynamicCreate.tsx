import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApiUrl, useGo } from "@refinedev/core";
import { useForm } from "@refinedev/antd";
import { StandardCreate } from "../../StandardCrud";
import { Alert, Button, Form, Skeleton, Tabs, Tooltip, Typography, message, theme } from "antd";
import { CheckCircleOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";
import { useModelTone, getModelTone, type ModelTone } from "../../../utils/modelTone";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { FieldDef, ModelDef, ViewConfigRow } from "../types";
import { asDisplayText, applyI18nLabelsToModel, applyI18nLabelsToModels } from "../utils/i18n";
import { renderWrappedPageTitle, parseInlineStyle } from "../utils/formatting";
import { isDarkColor, toneScopeStyle, ToneSharedStyles, renderToneTabLabel } from "../utils/colors";
import { renderIconOnlyButtons } from "../utils/buttons";
import { resolveResourcePath, hasReferenceModel, findModelByName, getRecordId } from "../utils/model";
import {
    DETAILS_TAB_NAME,
    splitRelations,
    useViewConfigurations,
    useViewSettings,
    filterConfigRowsForMode,
    groupConfigRowsBySection,
    normalizeSectionRows,
    resolveFieldFromConfig,
    resolveRelationFromConfig,
    applyRelationFieldOverrides,
    buildConfiguredRelationKeys,
    buildConfiguredResolvedRelationKeys,
    buildConfiguredRelationDisplayKeys,
    isRelationConfiguredForDetails,
    normalizeRelationViewType,
    applyRelationViewOverride,
} from "../utils/viewConfig";
import { renderInput } from "../fields/renderInput";
import { renderFieldValue } from "../fields/renderFieldValue";
import { RelationSelect } from "../fields/RelationSelect";
import {
    DEFAULT_EDIT_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    isReverseRelation,
    getRelationViewType,
    getRelationTabName,
    getTabDisplayLabel,
} from "../relations/helpers";
import { renderRelationBlock } from "../../DynamicResource";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const { Title } = Typography;

export interface JourneyCallbacks {
    onSave: (record: any) => void;
    onCancel: () => void;
}

export const DynamicCreate: React.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    journeyCallbacks?: JourneyCallbacks;
    injectedValues?: Record<string, any>;
}> = ({ model, allModels, journeyCallbacks, injectedValues }) => {
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const navigate = useNavigate();
    const go = useGo();
    const [searchParams] = useSearchParams();
    const apiUrl = useApiUrl();
    const { token } = theme.useToken();
    const modelTone = useModelTone(model);
    const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const { rows: editConfigRows, loading: editConfigLoading } = useViewConfigurations(model.name, "AutomaticEntityForm");
    const { rows: fallbackConfigRows, loading: fallbackConfigLoading } = useViewConfigurations(model.name, "PrimaryView");
    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const labelBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? "transparent"
        : "#ffffff";
    const formResource = resolveResourcePath(model.resource || model.name, allModelsList);
    const disableRedirect = searchParams.get("inline") === "1"
        || searchParams.get("redirect") === "false"
        || searchParams.get("redirect") === "0";
    const requestedReturnTo = searchParams.get("returnTo");
    const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") ? requestedReturnTo : null;
    const relateResource = searchParams.get("relate_resource");
    const relateTargetKey = searchParams.get("relate_target_key");
    const relateOtherKey = searchParams.get("relate_other_key");
    const relateTargetId = searchParams.get("relate_target_id");
    const canAutoRelate = Boolean(relateResource && relateTargetKey && relateOtherKey && relateTargetId);

    // Post-create mode state
    const [createdRecord, setCreatedRecord] = useState<any>(null);
    const [showRelationActions, setShowRelationActions] = useState(DEFAULT_EDIT_RELATION_ROW_ACTIONS);
    const [showRelationCreate, setShowRelationCreate] = useState(DEFAULT_RELATION_CREATE_ACTIONS);
    const [activeTabKey, setActiveTabKey] = useState("main_data");
    const isPostCreate = createdRecord !== null;

    const relationViewTypeDefaults = useMemo(
        () => ({
            show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
            edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table",
        }),
        [viewSettings?.showViewType, viewSettings?.editViewType],
    );

    const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));

    // Detect link/relation models: has eid_from + eid_to fields with eid_from pre-filled from URL
    const isLinkModel = useMemo(() => {
        const fieldKeys = model.fields.map((f) => f.key);
        return fieldKeys.includes("eid_from") && fieldKeys.includes("eid_to") && searchParams.has("eid_from");
    }, [model.fields, searchParams]);

    const [serverDefaults, setServerDefaults] = useState<Record<string, any>>({});
    const { formProps, saveButtonProps } = useForm({
        resource: formResource,
        redirect: false,
        onMutationSuccess: async (response: any) => {
            const freshRecord = response?.data?.data || response?.data || response;
            const createdId = getRecordId(freshRecord, model.fields);
            // Journey mode: hand off to the runner instead of navigating
            if (journeyCallbacks?.onSave) {
                journeyCallbacks.onSave(freshRecord);
                return;
            }
            if (canAutoRelate && relateResource && relateTargetKey && relateOtherKey && relateTargetId) {
                try {
                    if (createdId === undefined || createdId === null) {
                        throw new Error(_("Could not resolve the new record id to create the relation."));
                    }
                    const relationPayload = {
                        [relateTargetKey]: relateTargetId,
                        [relateOtherKey]: createdId,
                    };
                    const relationResponse = await authenticatedFetch(`${apiUrl}/${relateResource}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(relationPayload),
                    });
                    if (!relationResponse.ok) {
                        throw new Error(`Failed to create relation (${relationResponse.status})`);
                    }
                } catch (error) {
                    message.error(error instanceof Error ? error.message : _("Failed to create relation."));
                }
            }
            const hasModelRelations = (model.relations || []).length > 0;
            if (hasModelRelations && allModels) {
                setCreatedRecord(freshRecord);
            } else {
                if (returnTo) {
                    navigate(returnTo);
                } else if (!disableRedirect && createdId != null) {
                    navigate(`/${formResource}/show/${createdId}`);
                }
            }
        },
        successNotification: () => ({
            message: _("Changes saved."),
            description: modelDisplayLabel,
            type: "success",
        }),
    });

    // Keyboard shortcuts: Ctrl+S to save (pre-create only), Escape to go back or cancel journey
    useKeyboardShortcuts(useMemo(() => [
        { key: "s", ctrl: true, handler: () => { if (!isPostCreate) (formProps as any)?.form?.submit(); } },
        { key: "Escape", handler: () => journeyCallbacks?.onCancel ? journeyCallbacks.onCancel() : navigate(-1) },
    ], [(formProps as any)?.form, navigate, isPostCreate, journeyCallbacks]));

    const effectiveFields = useMemo(() => applyRelationFieldOverrides(model, allModelsList), [model, allModelsList]);
    const fieldByKey = useMemo(
        () => new Map(effectiveFields.map((field) => [field.key, field])),
        [effectiveFields]
    );
    const parseBooleanValue = (value: any) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        const normalized = String(value ?? "").trim().toLowerCase();
        if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
        return value;
    };
    const normalizeFieldValue = useCallback((field: FieldDef, rawValue: any) => {
        if (rawValue === undefined || rawValue === null || rawValue === "") return rawValue;
        if (field.type === "number") {
            const parsed = Number(rawValue);
            return Number.isNaN(parsed) ? rawValue : parsed;
        }
        if (field.type === "boolean") return parseBooleanValue(rawValue);
        return rawValue;
    }, []);
    useEffect(() => {
        let cancelled = false;
        const loadDefaults = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/_meta/defaults/${encodeURIComponent(formResource)}`);
                if (!response.ok) return;
                const payload = await response.json();
                if (cancelled) return;
                const rawDefaults = payload?.defaults && typeof payload.defaults === "object" ? payload.defaults : {};
                const normalizedDefaults: Record<string, any> = {};
                effectiveFields.forEach((field) => {
                    if (!Object.prototype.hasOwnProperty.call(rawDefaults, field.key)) return;
                    normalizedDefaults[field.key] = normalizeFieldValue(field, rawDefaults[field.key]);
                });
                setServerDefaults(normalizedDefaults);
            } catch {
                // Best effort: form can still work with local defaults/query params.
            }
        };
        loadDefaults();
        return () => { cancelled = true; };
    }, [apiUrl, effectiveFields, formResource, normalizeFieldValue]);

    const { initialValues, hiddenFields } = useMemo(() => {
        const defaults: Record<string, any> = {};
        const fromQuery: Record<string, any> = {};
        const hidden: string[] = [];
        effectiveFields.forEach((field) => {
            if (field.isPk) return;
            const defaultValue = field.defaultValue ?? field.default_value ?? field.default;
            if (defaultValue !== undefined) {
                defaults[field.key] = normalizeFieldValue(field, defaultValue);
            }
            const paramValue = searchParams.get(field.key);
            if (paramValue !== null) {
                fromQuery[field.key] = normalizeFieldValue(field, paramValue);
                hidden.push(field.key);
            }
        });
        return {
            hiddenFields: hidden,
            initialValues: {
                ...((formProps as any)?.initialValues || {}),
                ...defaults,
                ...serverDefaults,
                ...(injectedValues || {}),
                ...fromQuery,
            },
        };
    }, [effectiveFields, formProps, normalizeFieldValue, searchParams, serverDefaults, injectedValues]);

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
    const configLoading = editConfigLoading || fallbackConfigLoading || viewSettingsLoading;
    const hasConfig = configRows.length > 0;
    const configSections = groupConfigRowsBySection(configRows);

    // Relation data
    const { embedded, tabbed } = useMemo(() => splitRelations(model.relations), [model.relations]);
    const allRelations = useMemo(() => [...embedded, ...tabbed], [embedded, tabbed]);
    const configuredRelationKeys = useMemo(() => buildConfiguredRelationKeys(configRows), [configRows]);
    const configuredResolvedRelationKeys = useMemo(() => buildConfiguredResolvedRelationKeys(model.relations, configRows), [model.relations, configRows]);
    const configuredRelationDisplayKeys = useMemo(() => buildConfiguredRelationDisplayKeys(model.relations, configRows), [model.relations, configRows]);
    const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;

    useEffect(() => {
        const formInstance = (formProps as any)?.form;
        if (!formInstance) return;
        const untouchedDefaults = Object.fromEntries(
            Object.entries(initialValues).filter(([name]) => !formInstance.isFieldTouched(name))
        );
        if (Object.keys(untouchedDefaults).length === 0) return;
        formInstance.setFieldsValue(untouchedDefaults);
    }, [formProps, initialValues]);

    const handleDone = useCallback(() => {
        const createdId = getRecordId(createdRecord, model.fields);
        if (returnTo) {
            navigate(returnTo);
        } else if (createdId != null) {
            navigate(`/${formResource}/show/${createdId}`);
        } else {
            navigate(-1);
        }
    }, [createdRecord, returnTo, navigate, formResource]);

    const handleGoToEdit = useCallback(() => {
        const createdId = getRecordId(createdRecord, model.fields);
        if (createdId != null) {
            go({ to: { resource: model.resource || model.name, action: "edit", id: createdId } });
        }
    }, [createdRecord, model.name, model.resource, go]);

    const renderHeaderButtons = ({ defaultButtons }: { defaultButtons: React.ReactNode }) =>
        renderIconOnlyButtons(defaultButtons);

    const renderPostCreateHeaderButtons = (_unused: { defaultButtons: React.ReactNode }) => (
        <>
            <Tooltip title={_("Edit record")}>
                <Button size="small" icon={<EditOutlined />} onClick={handleGoToEdit} />
            </Tooltip>
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={handleDone}>
                {_("Done")}
            </Button>
        </>
    );

    // Build relation tab entries (tab names + tones) — same set for both pre/post create
    const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
    const relationTabEntries = useMemo(() => {
        if (!allModels) return [] as Array<{ tabName: string; tone: ModelTone }>;
        const groups = new Map<string, { tone: ModelTone }>();
        allRelations.forEach((rel) => {
            if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
            const relationModel = findModelByName(allModels, rel.resource);
            if (!relationModel) return;
            const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
            const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
            const tabName = getRelationTabName(rel, "edit", fallbackTab ?? "");
            const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel)
                ? (rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME)
                : tabName;
            if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
            if (resolvedTabName === DETAILS_TAB_NAME) return;
            if (!groups.has(resolvedTabName)) {
                const tone = getModelTone(relatedModel || relationModel || (rel.resource as any));
                groups.set(resolvedTabName, { tone });
            }
        });
        return Array.from(groups.entries()).map(([tabName, { tone }]) => ({ tabName, tone }));
    }, [allModels, allRelations, addTabsForNonConfiguredRelations, hasConfiguredDetailRelations, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys]);

    const hasRelationTabs = relationTabEntries.length > 0;

    // ─── Cell renderers ───

    const renderFormCell = (item: ViewConfigRow, index: number): React.ReactNode => {
        if (item.attribute_or_relation_type === "relation") {
            return (
                <div key={`${item.name}-rel-ph-${index}`} style={{ marginBottom: 4, padding: "4px 8px", color: token.colorTextTertiary, fontStyle: "italic", fontSize: token.fontSizeSM }}>
                    {_("Available after saving")}
                </div>
            );
        }
        const key = item.object_name || item.name;
        const field = fieldByKey.get(key) || resolveFieldFromConfig(model, item);
        if (field.isPk) return null;
        if (field.formula) return null;
        const isHidden = hiddenFields.includes(field.key);
        const showLabel = item.show_label !== false;
        if (isHidden) {
            return (
                <Form.Item key={`${field.key}-${index}`} name={field.key} hidden rules={field.required ? [{ required: true }] : []}>
                    {renderInput(field, allModels, model)}
                </Form.Item>
            );
        }
        return (
            <div key={`${field.key}-${index}`} style={{ marginBottom: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: showLabel ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 }}>
                    {showLabel && (
                        <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                            {field.label}
                        </div>
                    )}
                    <div style={{ padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, border: `1px solid ${token.colorBorder}`, maxWidth: "100%", overflowWrap: "anywhere", ...parseInlineStyle(item.html_format) }}>
                        <Form.Item
                            name={field.key}
                            rules={field.required ? [{ required: true }] : []}
                            valuePropName={field.type === "boolean" ? "checked" : undefined}
                            getValueProps={(val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs(val) } : field.type === "time" && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }}
                            style={{ margin: 0 }}
                        >
                            {renderInput(field, allModels, model)}
                        </Form.Item>
                    </div>
                </div>
            </div>
        );
    };

    const renderReadonlyCell = (item: ViewConfigRow, index: number): React.ReactNode => {
        if (item.attribute_or_relation_type === "relation") {
            if (!allModels) return null;
            const relation = resolveRelationFromConfig(model.relations, item);
            if (!relation) return null;
            const relationModel = findModelByName(allModels, relation.resource);
            if (!relationModel) return null;
            const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : undefined;
            const relationTone = getModelTone(relatedModel || relationModel || (relation.resource as any));
            const relWithOverride = applyRelationViewOverride(relation, item, "edit");
            const showLabel = item.show_label !== false;
            const resolvedRelViewType = getRelationViewType(relWithOverride, "edit", relationViewTypeDefaults as any);
            const isListView = resolvedRelViewType === "list";
            const relationValueStyle: React.CSSProperties = {
                padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, overflowWrap: "anywhere",
                ...(isListView ? { width: "100%" } : { maxWidth: "100%" }),
                ...parseInlineStyle(item.html_format),
            };
            const relationLabelStyle: React.CSSProperties = { ...labelStyle, background: "transparent", color: relationTone.text, padding: "2px 8px", borderRadius: 6 };
            const relationLayoutStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: showLabel ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 };
            return (
                <div key={`${item.name}-${item.row}-${item.column}`} style={{ marginBottom: 4 }}>
                    {renderRelationBlock({
                        rel: relWithOverride,
                        relationModel,
                        relatedModel,
                        record: createdRecord,
                        mode: "edit",
                        parentResource: model.name,
                        allModels,
                        showActions: showRelationActions,
                        showCreate: showRelationCreate,
                        relationViewTypeDefaults: relationViewTypeDefaults as any,
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
        const readonlyValueStyle: React.CSSProperties = {
            padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6,
            border: `1px solid ${token.colorBorder}`, maxWidth: "100%", overflowWrap: "anywhere",
            ...parseInlineStyle(item.html_format),
        };
        return (
            <div key={`${field.key}-${index}`} style={{ marginBottom: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: showLabel ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 }}>
                    {showLabel && (
                        <div style={{ ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }}>
                            {field.label}
                        </div>
                    )}
                    <div style={readonlyValueStyle}>
                        {renderFieldValue(field, createdRecord, allModels)}
                    </div>
                </div>
            </div>
        );
    };

    const renderSectionGrid = (section: string, rows: ViewConfigRow[], useReadonly: boolean) => {
        const normalized = normalizeSectionRows(rows);
        const maxRow = Math.max(1, ...normalized.map((r) => r.row));
        const maxCol = Math.max(1, ...normalized.map((r) => r.column));
        const prefix = useReadonly ? "pc" : "cr";
        return (
            <div key={section} style={{ border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "6px 6px", marginBottom: 6 }}>
                <Title level={5} style={{ margin: 0, marginBottom: 6, color: "#1677ff" }}>{_(section)}</Title>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                        {Array.from({ length: maxRow }).map((_, rowIdx) => (
                            <tr key={`${prefix}-row-${section}-${rowIdx}`}>
                                {Array.from({ length: maxCol }).map((_, colIdx) => {
                                    const cellItems = normalized.filter((r) => r.row === rowIdx + 1 && r.column === colIdx + 1);
                                    return (
                                        <td key={`${prefix}-cell-${section}-${rowIdx}-${colIdx}`} style={{ padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }}>
                                            {cellItems.map((item, idx) =>
                                                useReadonly ? renderReadonlyCell(item, idx) : renderFormCell(item, idx)
                                            )}
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

    // ─── Details tab content ───
    const detailsContent = (
        <div style={{ paddingBottom: 24 }}>
            {configLoading && <Skeleton active paragraph={{ rows: 6 }} />}

            {/* Pre-create, no CSV config */}
            {!configLoading && !hasConfig && !isPostCreate && (
                <div style={{ position: "relative", marginTop: 0 }}>
                    <div style={{ position: "absolute", left: "212px", right: 0, top: 0, bottom: 0, background: valueBackground, borderRadius: 6 }} />
                    <Form {...formProps} size="small" initialValues={initialValues} style={{ position: "relative" }}>
                        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, padding: 0 }}>
                            {effectiveFields.filter(f => !f.isPk && !f.formula).map((field) => {
                                const isHidden = hiddenFields.includes(field.key);
                                if (isHidden) {
                                    return (
                                        <Form.Item key={field.key} name={field.key} hidden rules={field.required ? [{ required: true }] : []}>
                                            {renderInput(field, allModels, model)}
                                        </Form.Item>
                                    );
                                }
                                return (
                                    <div key={field.key} style={{ display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }}>
                                        <span style={labelStyle}>{field.label}</span>
                                        <div style={{ padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }}>
                                            <Form.Item name={field.key} rules={field.required ? [{ required: true }] : []} valuePropName={field.type === "boolean" ? "checked" : undefined} getValueProps={(val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs(val) } : field.type === "time" && val ? { value: dayjs('1970-01-01T' + val) } : { value: val }} style={{ margin: 0 }}>
                                                {renderInput(field, allModels, model)}
                                            </Form.Item>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Form>
                </div>
            )}

            {/* Post-create, no CSV config */}
            {!configLoading && !hasConfig && isPostCreate && (
                <div style={{ position: "relative", marginTop: 0 }}>
                    <div style={{ position: "absolute", left: "212px", right: 0, top: 0, bottom: 0, background: valueBackground, borderRadius: 6 }} />
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, padding: 0 }}>
                        {effectiveFields.filter(f => !f.isPk).map((field) => (
                            <div key={field.key} style={{ display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }}>
                                <span style={labelStyle}>{field.label}</span>
                                <div style={{ padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }}>
                                    {renderFieldValue(field, createdRecord, allModels)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pre-create, CSV config */}
            {!configLoading && hasConfig && !isPostCreate && (
                <div style={{ marginTop: 0 }}>
                    <Form {...formProps} size="small" style={{ position: "relative" }} initialValues={initialValues}>
                        {Array.from(configSections.entries()).map(([section, rows]) =>
                            renderSectionGrid(section, rows, false)
                        )}
                    </Form>
                </div>
            )}

            {/* Post-create, CSV config */}
            {!configLoading && hasConfig && isPostCreate && (
                <div style={{ marginTop: 0 }}>
                    {Array.from(configSections.entries()).map(([section, rows]) =>
                        renderSectionGrid(section, rows, true)
                    )}
                </div>
            )}

            {/* Embedded (Details-tab) relations in post-create, non-configured case */}
            {!configLoading && isPostCreate && !hasConfiguredDetailRelations && allModels && (
                <div style={{ marginTop: 8 }}>
                    {allRelations
                        .filter((rel) => {
                            const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
                            return getRelationTabName(rel, "edit", fallbackTab ?? "") === DETAILS_TAB_NAME;
                        })
                        .map((rel) => {
                            const relationModel = findModelByName(allModels, rel.resource);
                            if (!relationModel) return null;
                            const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
                            return renderRelationBlock({
                                rel,
                                relationModel,
                                relatedModel,
                                record: createdRecord,
                                mode: "edit",
                                parentResource: model.name,
                                allModels,
                                showActions: showRelationActions,
                                showCreate: showRelationCreate,
                                relationViewTypeDefaults: relationViewTypeDefaults as any,
                            });
                        })}
                </div>
            )}
        </div>
    );

    // ─── Relation tab content builder ───
    const buildRelationTabContent = (tabName: string): React.ReactNode => {
        if (!isPostCreate || !allModels) {
            return (
                <Alert
                    type="info"
                    showIcon
                    message={_("Save the record first to add relations.")}
                    style={{ marginTop: 8 }}
                />
            );
        }
        const nodes: React.ReactNode[] = [];
        allRelations.forEach((rel) => {
            if (!allModels) return;
            const relationModel = findModelByName(allModels, rel.resource);
            if (!relationModel) return;
            const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
            const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : (rel.relationName || rel.label);
            const rt = getRelationTabName(rel, "edit", fallbackTab ?? "");
            const resolvedTab = rt === DETAILS_TAB_NAME && !isReverseRelation(rel)
                ? (rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME)
                : rt;
            if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
            if (resolvedTab !== tabName) return;
            nodes.push(renderRelationBlock({
                rel,
                relationModel,
                relatedModel,
                record: createdRecord,
                mode: "edit",
                parentResource: model.name,
                allModels,
                showActions: showRelationActions,
                showCreate: showRelationCreate,
                relationViewTypeDefaults: relationViewTypeDefaults as any,
            }));
        });
        return <div>{nodes}</div>;
    };

    // ─── Tab items ───
    const tabItems = [
        {
            key: "main_data",
            label: renderToneTabLabel(_("Details"), modelTone),
            children: detailsContent,
        },
        ...relationTabEntries.map(({ tabName, tone }) => ({
            key: tabName,
            label: renderToneTabLabel(getTabDisplayLabel(tabName), tone),
            children: buildRelationTabContent(tabName),
        })),
    ];

    const lazyTabItems = tabItems.map((item) => ({
        ...item,
        children: item.key === activeTabKey ? item.children : null,
    }));

    // ─── Link model special case (unchanged) ───
    if (isLinkModel && !hasConfig) {
        return (
            <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
                <ToneSharedStyles />
                <StandardCreate
                    redirect={false}
                    saveButtonProps={{ ...saveButtonProps, hideText: true, htmlType: "submit", form: "link-model-create-form" }}
                    headerButtons={renderHeaderButtons}
                    title={renderWrappedPageTitle(`${_("Create")} ${modelDisplayLabel}`)}
                >
                    <Form
                        id="link-model-create-form"
                        size="small"
                        initialValues={initialValues}
                        onFinish={async (values: any) => {
                            const eidFrom = values.eid_from ?? initialValues.eid_from;
                            const selectedIds: number[] = Array.isArray(values.eid_to) ? values.eid_to : [values.eid_to];
                            let successCount = 0;
                            for (const eidTo of selectedIds) {
                                try {
                                    const res = await authenticatedFetch(`${apiUrl}/${formResource}`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ eid_from: eidFrom, eid_to: eidTo }),
                                    });
                                    if (res.ok) successCount++;
                                    else message.error(`${_("Failed to create relation for")} eid_to=${eidTo} (${res.status})`);
                                } catch {
                                    message.error(`${_("Failed to create relation for")} eid_to=${eidTo}`);
                                }
                            }
                            if (successCount > 0) message.success(`${successCount} ${_("relation(s) created.")}`);
                            if (returnTo) navigate(returnTo);
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {effectiveFields.filter(f => !f.isPk && !f.formula).map((field) => {
                                const isHidden = hiddenFields.includes(field.key);
                                const isOtherKey = field.key === "eid_to";
                                if (isHidden) {
                                    return (
                                        <Form.Item key={field.key} name={field.key} hidden rules={field.required ? [{ required: true }] : []}>
                                            {isOtherKey && field.reference && hasReferenceModel(field.reference, allModels)
                                                ? <RelationSelect field={field} allModels={allModels} multiple />
                                                : renderInput(field, allModels, model)}
                                        </Form.Item>
                                    );
                                }
                                return (
                                    <div key={field.key} style={{ display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }}>
                                        <span style={labelStyle}>{field.label}</span>
                                        <div style={{ padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }}>
                                            <Form.Item name={field.key} rules={field.required ? [{ required: true }] : []} style={{ margin: 0 }}>
                                                {isOtherKey && field.reference && hasReferenceModel(field.reference, allModels)
                                                    ? <RelationSelect field={field} allModels={allModels} multiple />
                                                    : renderInput(field, allModels, model)}
                                            </Form.Item>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Form>
                </StandardCreate>
            </div>
        );
    }

    // ─── Main render ───
    return (
        <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
            <ToneSharedStyles />
            <StandardCreate
                redirect={false}
                saveButtonProps={isPostCreate
                    ? { ...saveButtonProps, style: { display: "none" }, hideText: true }
                    : { ...saveButtonProps, hideText: true }
                }
                headerButtons={isPostCreate ? renderPostCreateHeaderButtons : renderHeaderButtons}
                title={renderWrappedPageTitle(
                    isPostCreate
                        ? (createdRecord?._label || modelDisplayLabel)
                        : `${_("Create")} ${modelDisplayLabel}`
                )}
            >
                {isPostCreate && (
                    <Alert
                        type="success"
                        message={_("Record created. You can now manage relations below.")}
                        showIcon
                        style={{ marginBottom: 12 }}
                    />
                )}
                {hasRelationTabs ? (
                    <Tabs
                        activeKey={activeTabKey}
                        onChange={setActiveTabKey}
                        items={lazyTabItems}
                        destroyInactiveTabPane
                    />
                ) : (
                    detailsContent
                )}
            </StandardCreate>
        </div>
    );
};

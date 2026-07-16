import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApiUrl, useCan, useGo } from "@refinedev/core";
import { useForm, DeleteButton } from "@refinedev/antd";
import { StandardEdit } from "../../StandardCrud";
import { Button, Divider, Popover, Switch, Tabs, Tooltip, message } from "antd";
import { AppstoreOutlined, CopyOutlined, EyeOutlined, SaveFilled, SaveOutlined, SettingOutlined, ApartmentOutlined } from "@ant-design/icons";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";
import { useModelTone } from "../../../utils/modelTone";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef } from "../types";
import { asDisplayText, applyI18nLabelsToModel, applyI18nLabelsToModels, getModuleLabel } from "../utils/i18n";
import { useRoleFilteredModel } from "../utils/roleAccess";
import { renderWrappedPageTitle } from "../utils/formatting";
import { toneScopeStyle, ToneSharedStyles } from "../utils/colors";
import { renderIconOnlyButtons } from "../utils/buttons";
import { resolveResourcePath, isFileModel, getRecordId } from "../utils/model";
import { DEFAULT_EDIT_RELATION_ROW_ACTIONS, DEFAULT_RELATION_CREATE_ACTIONS } from "../relations/helpers";
import { useMetadataModal } from "../hooks/useMetadataModal";
import { renderModelHeading } from "../ModelHeading";
import { useStandardEditTabs } from "../hooks/useStandardEditTabs";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

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
    const modelTone = useModelTone(model);
    const apiUrl = useApiUrl();
    const allModelsList = useMemo(() => allModels || [], [allModels]);
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
    const { tabs: items, layoutConfig } = useStandardEditTabs(
        model,
        record,
        allModelsList,
        { showActions: showRelationActions, showCreate: showRelationCreate },
        editFormProps,
    );
    const { isConfiguring, enterConfigMode, saveLayout, cancelLayout, hasConfig } = layoutConfig;
    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;
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
            {hasConfig && canConfigureLayout && (
                <>
                    <Divider style={{ margin: "4px 0" }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span>{_("Configure page layout")}</span>
                        <Button
                            size="small"
                            icon={<AppstoreOutlined />}
                            type={isConfiguring ? "primary" : "default"}
                            onClick={isConfiguring ? cancelLayout : enterConfigMode}
                        />
                    </div>
                </>
            )}
            <Divider style={{ margin: "4px 0" }} />
            <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={() => {
                    saveLayout();
                    saveActionsPreferences();
                }}
                loading={isSavingActionsPrefs}
                block
            >
                {_("Save")}
            </Button>
        </div>
    );

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
                <Button
                    {...(saveButtonProps as any)}
                    type="primary"
                    icon={<SaveFilled />}
                    onClick={(e: React.MouseEvent) => {
                        saveLayout();
                        (saveButtonProps as any)?.onClick?.(e);
                    }}
                />
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Divider, Modal, Popover, Switch, Tooltip, message } from "antd";
import { ApartmentOutlined, PushpinFilled, PushpinOutlined, SaveFilled, SaveOutlined, SettingOutlined } from "@ant-design/icons";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef } from "../types";
import { resolveResourcePath } from "../utils/model";
import { renderIconOnlyButtons } from "../utils/buttons";
import { DEFAULT_SHOW_RELATION_ROW_ACTIONS, DEFAULT_RELATION_CREATE_ACTIONS } from "../relations/helpers";
import { useMetadataModal } from "./useMetadataModal";
import { RelationsExplorer } from "../relations/RelationsExplorer";
import { usePinRecord } from "../../../pages/dashboard/hooks/usePinRecord";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const useShowActionsPreferences = (
    model: ModelDef,
    allModels?: ModelDef[],
    record?: any,
    saveButtonProps?: any,
    configureLayoutButtonRef?: { current: React.ReactNode },
) => {
    const apiUrl = useApiUrl();
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const [showRelationActions, setShowRelationActions] = useState(DEFAULT_SHOW_RELATION_ROW_ACTIONS);
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
                showCreate: showRelationCreate,
            };
        setIsSavingActionsPrefs(true);
        try {
            const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: resourceKey, preferenceType: "ShowActions", preferences }),
            });
            if (!response.ok) {
                throw new Error(`Save failed (${response.status})`);
            }
            message.success("Show actions preferences saved.");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Failed to save show actions preferences.");
        } finally {
            setIsSavingActionsPrefs(false);
        }
    }, [apiUrl, allModelsList, model.name, model.resource, showRelationActions, showRelationCreate]);

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
                const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowActions`);
                if (!response.ok) {
                    throw new Error(`Load failed (${response.status})`);
                }
                const data = await response.json();
                if (cancelled || actionsPrefsTouchedRef.current) return;
                const prefs = data?.preferences;
                if (!prefs || typeof prefs !== "object") return;
                if ("showActions" in prefs) setShowRelationActions(Boolean(prefs.showActions));
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

    const { id: urlId } = useParams();
    const effectiveRecord = record ?? (urlId ? { eid: Number(urlId) } : undefined);
    const recordId = effectiveRecord?.eid ?? effectiveRecord?.id ?? urlId;
    const resource = model.resource || model.name;

    const { pinned, loading: pinLoading, toggle: togglePin } = usePinRecord(resource, recordId);

    const { metadataButton, metadataModal } = useMetadataModal(model, allModels);
    const [exploreOpen, setExploreOpen] = useState(false);

    const headerButtons = ({ defaultButtons }: { defaultButtons: React.ReactNode }) => (
        <>
            {metadataButton}
            {metadataModal}
            <Popover content={actionsSettingsContent} title={_("Actions")} trigger="hover">
                <Button size="small" icon={<SettingOutlined />} />
            </Popover>
            <span style={{ marginInlineStart: 10 }} />
            {pinned !== null && (
                <Tooltip title={pinned ? _("Unpin") : _("Pin to dashboard")}>
                    <Button
                        size="small"
                        icon={pinned ? <PushpinFilled style={{ color: "#faad14" }} /> : <PushpinOutlined />}
                        onClick={togglePin}
                        loading={pinLoading}
                    />
                </Tooltip>
            )}
            <Tooltip title={_("Explore")}>
                <Button size="small" icon={<ApartmentOutlined />} onClick={() => setExploreOpen(true)} />
            </Tooltip>
            <Modal
                open={exploreOpen}
                onCancel={() => setExploreOpen(false)}
                footer={null}
                title={_("Explore")}
                width="90vw"
                styles={{ body: { height: "80vh", overflowY: "auto" } }}
                destroyOnClose
            >
                {exploreOpen && effectiveRecord && (
                    <RelationsExplorer model={model} record={effectiveRecord} allModels={allModels || []} isActive={true} />
                )}
            </Modal>
            {renderIconOnlyButtons(defaultButtons)}
            {configureLayoutButtonRef?.current}
            {saveButtonProps && (
                <Tooltip title={_("Save")}>
                    <Button {...saveButtonProps} type="primary" icon={<SaveFilled />} hideText />
                </Tooltip>
            )}
        </>
    );

    return {
        actionsState: { showActions: showRelationActions, showCreate: showRelationCreate },
        headerButtons,
    };
};

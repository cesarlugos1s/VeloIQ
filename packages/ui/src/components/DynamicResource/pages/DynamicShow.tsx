import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useCan } from "@refinedev/core";
import { Button, Spin, Tabs } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import { StandardShow, renderStandardShowHeaderButtons } from "../../StandardCrud";
import { useModelTone } from "../../../utils/modelTone";
import type { ModelDef } from "../types";
import { asDisplayText, applyI18nLabelsToModel, applyI18nLabelsToModels, getModuleLabel } from "../utils/i18n";
import { renderWrappedPageTitle } from "../utils/formatting";
import { toneScopeStyle, ToneSharedStyles } from "../utils/colors";
import { renderModelHeading } from "../ModelHeading";
import { useShowEditableForm } from "../hooks/useShowEditableForm";
import { buildShowTabFormOptions } from "../hooks/buildShowTabFormOptions";
import { useShowActionsPreferences } from "../hooks/useShowActionsPreferences";
import { ShowFooterButtons } from "../ShowFooterButtons";
import { useStandardShowTabs } from "../../DynamicResource";
import { useRoleFilteredModel } from "../utils/roleAccess";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const DynamicShow: React.FC<{ model: ModelDef; allModels?: ModelDef[]; idOverride?: string; embedded?: boolean; beforeTabs?: React.ReactNode; extraHeaderButtons?: (record: any) => React.ReactNode }> = ({ model: modelProp, allModels, idOverride, embedded, beforeTabs, extraHeaderButtons }) => {
    const model = useRoleFilteredModel(modelProp);
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const modelTone = useModelTone(model);
    const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
    const { id: routeId } = useParams();
    const id = idOverride ?? routeId;
    const { formProps, saveButtonProps, record, recordId } = useShowEditableForm(model.resource || model.name, id);
    const { formProps: showFormProps, effectiveFields } = buildShowTabFormOptions(formProps, model, allModels);

    const pageTitle = record?._label
        ? asDisplayText(record._label, `${_("Show")} ${modelDisplayLabel}`)
        : `${_("Show")} ${modelDisplayLabel}`;

    // Refs allow layout controls (from useStandardShowTabs) to be injected into
    // the header buttons (from useShowActionsPreferences) without circular deps.
    const saveLayoutRef = useRef<() => void>(() => {});
    const configureLayoutButtonRef = useRef<React.ReactNode>(null);

    const wrappedSaveButtonProps = saveButtonProps ? {
        ...saveButtonProps,
        onClick: (e: React.MouseEvent) => {
            saveLayoutRef.current();
            (saveButtonProps as any)?.onClick?.(e);
        },
    } : saveButtonProps;

    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;

    const { actionsState, headerButtons } = useShowActionsPreferences(model, allModels, record, wrappedSaveButtonProps, configureLayoutButtonRef, saveLayoutRef);
    // extraHeaderButtons is a render-prop (not a plain value) because, unlike
    // DynamicList's extraHeaderButtons, it needs `record` -- which isn't
    // resolved until useShowEditableForm() above returns. Guarded on `record`
    // so callers never receive a call with an undefined/loading record.
    // Renders first, mirroring DynamicList's extraHeaderButtons placement
    // ahead of its own default buttons (renderListHeaderButtons).
    //
    // IMPORTANT: StandardShow's `headerButtons` prop is a render-prop FUNCTION
    // (StandardCrud.tsx's StandardShow calls `effectiveHeaderButtons(args)`,
    // defaulting to `renderStandardShowHeaderButtons` when unset) -- not a
    // plain ReactNode value like DynamicList's `extraHeaderButtons`. Passing a
    // plain JSX value here breaks that contract (StandardShow tries to CALL
    // it and throws "... is not a function"). So `combinedHeaderButtons` must
    // stay a function with the same signature, only wrapping when
    // `extraHeaderButtons` is actually provided -- otherwise passing
    // `headerButtons` straight through, unchanged, preserves the exact
    // pre-existing behavior (including the framework's own default when
    // `headerButtons` is undefined).
    const combinedHeaderButtons = extraHeaderButtons
        ? (args: any) => (
            <>
                {record ? extraHeaderButtons(record) : null}
                {(headerButtons ?? renderStandardShowHeaderButtons)(args)}
            </>
          )
        : headerButtons;
    const [activeTabKey, setActiveTabKey] = useState("details");

    const { tabs: items, layoutConfig, dataDetailLevelState } = useStandardShowTabs(
        model,
        record,
        allModelsList,
        actionsState,
        { formProps: showFormProps, effectiveFields },
    );

    // Update refs during render so the Actions popover always reads the latest values.
    saveLayoutRef.current = layoutConfig.saveLayout;
    configureLayoutButtonRef.current = layoutConfig.hasConfig && canConfigureLayout ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{_("Configure page layout")}</span>
            <Button
                size="small"
                icon={<AppstoreOutlined />}
                type={layoutConfig.isConfiguring ? "primary" : "default"}
                onClick={layoutConfig.isConfiguring ? layoutConfig.cancelLayout : layoutConfig.enterConfigMode}
            />
        </div>
    ) : null;

    useEffect(() => {
        if (!items.find((item) => item.key === activeTabKey)) {
            setActiveTabKey(items[0]?.key || "details");
        }
    }, [activeTabKey, items]);
    const lazyItems = useMemo(
        () => items.map((item) => ({
            ...item,
            children: item.key === activeTabKey ? item.children : null,
        })),
        [activeTabKey, items]
    );
    if (embedded) {
        return (
            <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
                <ToneSharedStyles />
                {!record ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                        <Spin />
                    </div>
                ) : (
                    <>
                        {beforeTabs}
                        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={lazyItems} destroyInactiveTabPane />
                        <ShowFooterButtons
                            model={model}
                            allModels={allModels}
                            recordId={recordId}
                            saveButtonProps={saveButtonProps}
                        />
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
            <ToneSharedStyles />
            <StandardShow
                isLoading={!record}
                title={renderWrappedPageTitle(renderModelHeading({
                    model,
                    title: pageTitle,
                    actionLabel: _("Show"),
                    moduleLabel: model.module ? getModuleLabel(model.module) : undefined,
                }))}
                headerButtons={combinedHeaderButtons}
            >
                {beforeTabs}
                <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={lazyItems} destroyInactiveTabPane />
                <ShowFooterButtons
                    model={model}
                    allModels={allModels}
                    recordId={recordId}
                    saveButtonProps={saveButtonProps}
                />
            </StandardShow>
        </div>
    );
};

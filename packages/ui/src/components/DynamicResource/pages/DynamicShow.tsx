import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAllModelsIncludingNonModelData } from "../../../contexts/AllModelsContext";
import { useParams, useSearchParams } from "react-router-dom";
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
import { useSetHelpPageKey } from "../../../contexts/HelpContext";
import { ResourceAccessGate } from "../../AccessGate";
import { BeforeEditSaveContext, type BeforeEditSave } from "../hooks/useBeforeEditSave";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const DynamicShowPage: React.FC<{ model: ModelDef; allModels?: ModelDef[]; idOverride?: string; embedded?: boolean; beforeTabs?: React.ReactNode;
    /** Header buttons, given the record and the page's form (to read or fill unsaved values). */
    extraHeaderButtons?: (record: any, form?: any) => React.ReactNode }> = ({ model: modelProp, allModels: allModelsProp, idOverride, embedded, beforeTabs, extraHeaderButtons }) => {
    const allModels = useAllModelsIncludingNonModelData(allModelsProp);
    const model = useRoleFilteredModel(modelProp);
    applyI18nLabelsToModel(model);
    applyI18nLabelsToModels(allModels);
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const modelTone = useModelTone(model);
    const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
    const { id: routeId } = useParams();
    const id = idOverride ?? routeId;
    const [searchParams] = useSearchParams();
    // MultiPane detail panes render via PrimaryShowRenderer without `embedded`
    // set, so each still counts as "the show page" for help purposes; only the
    // Miller-column browser's nested preview (embedded=true) is excluded.
    useSetHelpPageKey(embedded ? null : `${model.resource || model.name}:show`, embedded ? null : (id ?? null));
    const { formProps, saveButtonProps, record, recordId } = useShowEditableForm(model.resource || model.name, id);
    const { formProps: builtShowFormProps, effectiveFields } = buildShowTabFormOptions(formProps, model, allModels);

    // Components inside the page registered through useBeforeEditSave (e.g. a
    // custom header button staging related rows) save their data first; if
    // one throws, the record is not saved — as on the Edit page.
    const beforeSaveHandlers = useRef(new Set<BeforeEditSave>());
    const registerBeforeSave = useCallback((handler: BeforeEditSave) => {
        beforeSaveHandlers.current.add(handler);
        return () => { beforeSaveHandlers.current.delete(handler); };
    }, []);
    const showFormProps = useMemo(() => {
        if (!builtShowFormProps) return builtShowFormProps;
        const originalOnFinish = (builtShowFormProps as any).onFinish;
        return {
            ...builtShowFormProps,
            onFinish: async (values: any) => {
                for (const handler of beforeSaveHandlers.current) {
                    try {
                        await handler();
                    } catch {
                        return;
                    }
                }
                return originalOnFinish?.(values);
            },
        };
    }, [builtShowFormProps]);

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

    const { actionsState, headerButtons } = useShowActionsPreferences(model, allModels, record, wrappedSaveButtonProps, configureLayoutButtonRef, saveLayoutRef, searchParams.get("explore") === "1");
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
                {record ? extraHeaderButtons(record, (formProps as any)?.form) : null}
                {(headerButtons ?? renderStandardShowHeaderButtons)(args)}
            </>
          )
        : headerButtons;
    const [activeTabKey, setActiveTabKey] = useState("details");

    const { tabs: standardItems, layoutConfig, dataDetailLevelState, cellSizeControl } = useStandardShowTabs(
        model,
        record,
        allModelsList,
        actionsState,
        { formProps: showFormProps, effectiveFields },
    );
    const items = useMemo(() => {
        const extraTabs = (model.extraTabs ?? []).filter((tab) => tab.show);
        if (!record || extraTabs.length === 0) return standardItems;
        return [
            ...standardItems,
            ...extraTabs.map((tab) => {
                const TabContent = tab.show!;
                return { key: tab.key, label: _(tab.label), children: <TabContent record={record} /> };
            }),
        ];
    }, [standardItems, model.extraTabs, record]);

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
            <BeforeEditSaveContext.Provider value={registerBeforeSave}>
            <div className="jm-tone-scope" style={toneScopeStyle(modelTone)}>
                <ToneSharedStyles />
                {!record ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                        <Spin />
                    </div>
                ) : (
                    <>
                        {beforeTabs}
                        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={lazyItems} destroyInactiveTabPane tabBarExtraContent={{ right: cellSizeControl }} />
                        <ShowFooterButtons
                            model={model}
                            allModels={allModels}
                            recordId={recordId}
                            saveButtonProps={saveButtonProps}
                        />
                    </>
                )}
            </div>
            </BeforeEditSaveContext.Provider>
        );
    }

    return (
        <BeforeEditSaveContext.Provider value={registerBeforeSave}>
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
                <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={lazyItems} destroyInactiveTabPane tabBarExtraContent={{ right: cellSizeControl }} />
                <ShowFooterButtons
                    model={model}
                    allModels={allModels}
                    recordId={recordId}
                    saveButtonProps={saveButtonProps}
                />
            </StandardShow>
        </div>
        </BeforeEditSaveContext.Provider>
    );
};

/**
 * DynamicShow behind the shared access check: a user who may not Read this
 * model gets the "no access" page instead of a broken page (AC-E3).
 */
export const DynamicShow: React.FC<React.ComponentProps<typeof DynamicShowPage>> = (props) => (
    <ResourceAccessGate resource={props.model.resource || props.model.name} action="read" embedded={Boolean(props.embedded)}>
        <DynamicShowPage {...props} />
    </ResourceAccessGate>
);

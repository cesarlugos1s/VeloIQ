import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Spin, Tabs } from "antd";
import { StandardShow } from "../../StandardCrud";
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

export const DynamicShow: React.FC<{ model: ModelDef; allModels?: ModelDef[]; idOverride?: string; embedded?: boolean }> = ({ model: modelProp, allModels, idOverride, embedded }) => {
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
    const { actionsState, headerButtons } = useShowActionsPreferences(model, allModels, record, saveButtonProps);
    const [activeTabKey, setActiveTabKey] = useState("details");
    const items = useStandardShowTabs(
        model,
        record,
        allModelsList,
        actionsState,
        { formProps: showFormProps, effectiveFields },
    );
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
                headerButtons={headerButtons}
            >
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

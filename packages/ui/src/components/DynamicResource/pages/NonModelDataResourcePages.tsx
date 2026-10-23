/**
 * The standard pages of the non-model data resources: list, create, show and
 * edit, at the same paths as a model's (`/<resource>`, `/<resource>/create`,
 * `/<resource>/show/:id`, `/<resource>/edit/:id`).
 *
 * A host app's routes are generated for its models only, while non-model data
 * resources are known at runtime (GET /api/veloiq/non-model-data-resources).
 * The app mounts this component once, at `/:nonModelDataResource/*`; it renders
 * the page of the non-model data resource named in the path, so the standard
 * Create button (also inside relation lists, with the relation's key filled
 * in), row links and Refine navigation work for non-model data as for models.
 * For any other path it renders nothing, like an unknown path did before.
 *
 * `pageOverrides` are the extensions' per-resource pages (the manifests'
 * list/show/edit/create overrides, from extensions.gen); a resource that has
 * one gets it here too, as model pages do in App.tsx. `showHeaderButtons` are
 * the app's global Show header buttons (the manifests'
 * `show_header_button_components`), added to the standard Show page of every
 * non-model data resource as App.tsx adds them to model Show pages.
 */
import React from "react";
import { Route, Routes, useParams } from "react-router-dom";
import type { ModelDef } from "../types";
import { useAllModels } from "../../../contexts/AllModelsContext";
import { MultiPaneLayout } from "../../MultiPane";
import { DynamicList } from "../index";
import { DynamicCreate } from "./DynamicCreate";
import { DynamicEdit } from "./DynamicEdit";
import { DynamicShow } from "./DynamicShow";

/** Route parameter holding the resource name (the app's route is `/:nonModelDataResource/*`). */
export const NON_MODEL_DATA_RESOURCE_ROUTE_PARAMETER = "nonModelDataResource";

/** Extension pages replacing a resource's standard list/show/edit/create page, keyed by resource name. */
export interface NonModelDataResourcePageOverrides {
    list?: Record<string, React.ComponentType<any>>;
    show?: Record<string, React.ComponentType<any>>;
    edit?: Record<string, React.ComponentType<any>>;
    create?: Record<string, React.ComponentType<any>>;
}

/** The app's global Show header buttons for a resource: a render prop of the shown record. */
export type ShowHeaderButtonsForResource = (
    resource: string, model: ModelDef, allModels: ModelDef[],
) => (record: any) => React.ReactNode;

export const NonModelDataResourcePages: React.FC<{
    pageOverrides?: NonModelDataResourcePageOverrides;
    showHeaderButtons?: ShowHeaderButtonsForResource;
}> = ({ pageOverrides, showHeaderButtons }) => {
    const resourceName = useParams()[NON_MODEL_DATA_RESOURCE_ROUTE_PARAMETER];
    const allModels = useAllModels();
    const model: ModelDef | undefined = allModels.find(
        (candidate) => candidate.isNonModelData && (candidate.resource || candidate.name) === resourceName,
    );
    if (!model) return null;
    const resource = model.resource || model.name;
    const ListOverride = pageOverrides?.list?.[resource];
    const ShowOverride = pageOverrides?.show?.[resource];
    const EditOverride = pageOverrides?.edit?.[resource];
    const CreateOverride = pageOverrides?.create?.[resource];
    return (
        <Routes>
            <Route index element={
                <MultiPaneLayout>
                    {ListOverride
                        ? <ListOverride model={model} allModels={allModels} />
                        : <DynamicList key={resource} model={model} allModels={allModels} />}
                </MultiPaneLayout>
            } />
            <Route path="create" element={CreateOverride
                ? <CreateOverride model={model} allModels={allModels} />
                : <DynamicCreate model={model} allModels={allModels} />} />
            <Route path="edit/:id" element={EditOverride
                ? <EditOverride model={model} allModels={allModels} />
                : <DynamicEdit model={model} allModels={allModels} />} />
            <Route path="show/:id" element={
                <MultiPaneLayout>
                    {ShowOverride ? <ShowOverride /> : (
                        <DynamicShow model={model} allModels={allModels}
                            extraHeaderButtons={showHeaderButtons?.(resource, model, allModels)} />
                    )}
                </MultiPaneLayout>
            } />
        </Routes>
    );
};

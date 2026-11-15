/**
 * Applies a ready-made temporary setup to a page, exactly as if the user had
 * set it with the temporary page layout controls. An extension that runs pages
 * inside its own flow (for example Advanced Development's journeys) uses it to
 * start a page with the template, view type, filters, sorting and field
 * sequence an administrator configured. Nothing is saved or sent to the server.
 */
import type { ModelDef } from "../types";
import { resolveResourcePath } from "../utils/model";
import type { TemporaryLayoutPageType } from "./pageTemplateProviderRegistry";
import {
    LIST_BLOCK_ID, buildViewStateBlockKey,
} from "../viewState/viewStateLayers";
import type { ViewStateLayer } from "../viewState/viewStateTypes";
import {
    buildTemporaryPageKey, resetTemporaryPageLayout, updateTemporaryPageLayout, updateTemporaryViewState,
} from "./temporaryPageLayoutStore";

/** What can be set for a page; the page type decides which parts apply (view state and view type: list pages only). */
export interface TemporaryPageSetup {
    templateName?: string;
    /** List pages only. */
    listViewType?: string;
    /** List pages only: filters, sorting and field sequence. */
    viewState?: Pick<ViewStateLayer, "columnFilters" | "advancedFilterRules" | "sortList" | "fieldSequence">;
}

/** The store key of the page the framework renders for `model`; list pages resolve the resource path first. */
export function getTemporaryPageKeyForModel(model: ModelDef, pageType: TemporaryLayoutPageType, allModels?: ModelDef[]): string {
    const resource = model.resource || model.name;
    return buildTemporaryPageKey(pageType === "list" ? resolveResourcePath(resource, allModels) : resource, pageType);
}

/** Replaces the temporary changes of the page with `setup`. */
export function applyTemporaryPageSetup(
    model: ModelDef, pageType: TemporaryLayoutPageType, setup: TemporaryPageSetup, allModels?: ModelDef[],
): void {
    const pageKey = getTemporaryPageKeyForModel(model, pageType, allModels);
    resetTemporaryPageLayout(pageKey);
    const changes: { templateName?: string; listViewType?: string } = {};
    if (setup.templateName) changes.templateName = setup.templateName;
    if (pageType === "list" && setup.listViewType) changes.listViewType = setup.listViewType;
    if (Object.keys(changes).length > 0) updateTemporaryPageLayout(pageKey, changes);
    if (pageType === "list" && setup.viewState && Object.keys(setup.viewState).length > 0) {
        updateTemporaryViewState(buildViewStateBlockKey(pageKey, LIST_BLOCK_ID), setup.viewState);
    }
}

/** Removes every temporary change of the page (the "back to the configured layout" action). */
export function clearTemporaryPageSetup(model: ModelDef, pageType: TemporaryLayoutPageType, allModels?: ModelDef[]): void {
    resetTemporaryPageLayout(getTemporaryPageKeyForModel(model, pageType, allModels));
}

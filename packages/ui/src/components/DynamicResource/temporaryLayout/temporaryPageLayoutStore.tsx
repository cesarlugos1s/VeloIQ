/**
 * Temporary page layout: changes a user makes to the page they are using (view
 * type, template, Analyze area, cell size, side-panel layout, actions button
 * position) WITHOUT touching the page configuration.
 *
 * The overrides live in a module-level store, so they last until the browser
 * page is reloaded and are never sent to the server. They are keyed per page
 * (`<resource>:<pageType>`); the side-panel layout mode is the exception
 * because the panels belong to the whole application, not to one page.
 */
import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { GridDensity } from "../../../pages/dashboard/hooks/gridDensity";
import type { PanesLayoutMode } from "../utils/viewConfig";
import type { ModelDef } from "../types";
import type { TemporaryLayoutPageType } from "./pageTemplateProviderRegistry";

/** Where the general action buttons of a page are drawn. */
export type TemporaryActionsPosition = "top-right" | "left" | "right";

/** The overrides a user may set on one page. An absent key means "not overridden". */
export interface TemporaryPageLayout {
    listViewType?: string;
    templateName?: string;
    analyzeOpen?: boolean;
    analyzeFirst?: boolean;
    analyzeVertical?: boolean;
    cellSize?: GridDensity;
    actionsPosition?: TemporaryActionsPosition;
}

/** Analyze state a list page publishes so the controls can show what is really on screen. */
export interface PublishedListAnalyzeState {
    analyzeOpen: boolean;
    analyzeFirst: boolean;
    analyzeVertical: boolean;
}

interface TemporaryLayoutSnapshot {
    layoutsByPageKey: Record<string, TemporaryPageLayout>;
    publishedAnalyzeByPageKey: Record<string, PublishedListAnalyzeState>;
    panesLayoutMode: PanesLayoutMode | undefined;
}

let snapshot: TemporaryLayoutSnapshot = {
    layoutsByPageKey: {},
    publishedAnalyzeByPageKey: {},
    panesLayoutMode: undefined,
};
const snapshotListeners = new Set<() => void>();

function replaceSnapshot(next: TemporaryLayoutSnapshot): void {
    snapshot = next;
    snapshotListeners.forEach((listener) => listener());
}

function subscribeToSnapshot(listener: () => void): () => void {
    snapshotListeners.add(listener);
    return () => { snapshotListeners.delete(listener); };
}

/** Builds the store key of a page. */
export function buildTemporaryPageKey(resourceName: string, pageType: TemporaryLayoutPageType): string {
    return `${resourceName}:${pageType}`;
}

/** Merges `changes` into a page's overrides; a key set to undefined is removed. */
export function updateTemporaryPageLayout(pageKey: string, changes: Partial<TemporaryPageLayout>): void {
    const merged: Record<string, unknown> = { ...snapshot.layoutsByPageKey[pageKey], ...changes };
    Object.keys(merged).forEach((key) => { if (merged[key] === undefined) delete merged[key]; });
    replaceSnapshot({
        ...snapshot,
        layoutsByPageKey: { ...snapshot.layoutsByPageKey, [pageKey]: merged as TemporaryPageLayout },
    });
}

/** Removes every override of one page (the "back to configured layout" action). */
export function resetTemporaryPageLayout(pageKey: string): void {
    const { [pageKey]: _removed, ...remaining } = snapshot.layoutsByPageKey;
    replaceSnapshot({ ...snapshot, layoutsByPageKey: remaining });
}

/** Sets or clears the application-wide side-panel layout override. */
export function updateTemporaryPanesLayoutMode(mode: PanesLayoutMode | undefined): void {
    replaceSnapshot({ ...snapshot, panesLayoutMode: mode });
}

/** Records the Analyze state a list page currently shows (called by the list page). */
export function publishListAnalyzeState(pageKey: string, state: PublishedListAnalyzeState): void {
    const previous = snapshot.publishedAnalyzeByPageKey[pageKey];
    if (previous && previous.analyzeOpen === state.analyzeOpen
        && previous.analyzeFirst === state.analyzeFirst && previous.analyzeVertical === state.analyzeVertical) return;
    replaceSnapshot({
        ...snapshot,
        publishedAnalyzeByPageKey: { ...snapshot.publishedAnalyzeByPageKey, [pageKey]: state },
    });
}

/** Clears every override (used by tests; a browser reload does the same). */
export function resetAllTemporaryLayouts(): void {
    replaceSnapshot({ layoutsByPageKey: {}, publishedAnalyzeByPageKey: {}, panesLayoutMode: undefined });
}

/** The overrides of one page, read outside React (a null key never has any). */
export function getTemporaryPageLayout(pageKey: string | null): TemporaryPageLayout {
    return (pageKey ? snapshot.layoutsByPageKey[pageKey] : undefined) ?? NO_OVERRIDES;
}

const NO_OVERRIDES: TemporaryPageLayout = Object.freeze({});

/** The overrides of one page; a null key (embedded page) never has any. */
export function useTemporaryPageLayoutFor(pageKey: string | null): TemporaryPageLayout {
    return useSyncExternalStore(
        subscribeToSnapshot,
        () => getTemporaryPageLayout(pageKey),
        () => getTemporaryPageLayout(pageKey),
    );
}

/** The Analyze state the list page of `pageKey` published, if any. */
export function usePublishedListAnalyzeState(pageKey: string | null): PublishedListAnalyzeState | undefined {
    return useSyncExternalStore(
        subscribeToSnapshot,
        () => (pageKey ? snapshot.publishedAnalyzeByPageKey[pageKey] : undefined),
        () => (pageKey ? snapshot.publishedAnalyzeByPageKey[pageKey] : undefined),
    );
}

/** The application-wide side-panel layout override, if the user set one. */
export function useTemporaryPanesLayoutMode(): PanesLayoutMode | undefined {
    return useSyncExternalStore(subscribeToSnapshot, () => snapshot.panesLayoutMode, () => snapshot.panesLayoutMode);
}

/** What the controls need to know about the page that renders them. */
export interface TemporaryPageLayoutScope {
    pageKey: string;
    pageType: TemporaryLayoutPageType;
    model: ModelDef;
    /** List pages: the view types the user may switch to. */
    listViewTypes?: string[];
    /** List pages: the view type the page shows right now (configured or chosen). */
    currentListViewType?: string;
    /** List pages: whether the Analyze area exists for this resource. */
    analyzeAvailable?: boolean;
    /** Show and edit pages: whether the page has a cell size. */
    cellSizeAvailable?: boolean;
}

const TemporaryPageLayoutScopeContext = createContext<TemporaryPageLayoutScope | null>(null);

/** Marks the subtree as one page whose layout may be changed temporarily (null scope = embedded, inert). */
export const TemporaryPageLayoutScopeProvider: React.FC<{
    scope: TemporaryPageLayoutScope | null;
    children: React.ReactNode;
}> = ({ scope, children }) => {
    // A new scope object on every render would re-render all consumers; keep the
    // previous one while none of its parts changed.
    const stableScope = useMemo(
        () => scope,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [scope?.pageKey, scope?.pageType, scope?.model, scope?.listViewTypes?.join("|"), scope?.currentListViewType, scope?.analyzeAvailable, scope?.cellSizeAvailable],
    );
    return <TemporaryPageLayoutScopeContext.Provider value={stableScope}>{children}</TemporaryPageLayoutScopeContext.Provider>;
};

/** The scope of the enclosing page, or null outside any (or inside an embedded) page. */
export function useTemporaryPageLayoutScope(): TemporaryPageLayoutScope | null {
    return useContext(TemporaryPageLayoutScopeContext);
}

/** Overrides and setters for the enclosing page. */
export function useTemporaryPageLayoutOfEnclosingPage() {
    const scope = useTemporaryPageLayoutScope();
    const layout = useTemporaryPageLayoutFor(scope?.pageKey ?? null);
    const change = useCallback((changes: Partial<TemporaryPageLayout>) => {
        if (scope) updateTemporaryPageLayout(scope.pageKey, changes);
    }, [scope]);
    const reset = useCallback(() => {
        if (scope) {
            resetTemporaryPageLayout(scope.pageKey);
            updateTemporaryPanesLayoutMode(undefined);
        }
    }, [scope]);
    return { scope, layout, change, reset };
}

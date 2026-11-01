/**
 * Temporary page layout: the override store, the template provider registry
 * and the header controls (rendered with react-dom/server, no DOM).
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    TemporaryPageLayoutScopeProvider,
    buildTemporaryPageKey,
    getTemporaryPageLayout,
    resetAllTemporaryLayouts,
    resetTemporaryPageLayout,
    updateTemporaryPageLayout,
} from "./temporaryPageLayoutStore";
import { getRegisteredPageTemplateProvider, registerPageTemplateProvider } from "./pageTemplateProviderRegistry";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

afterEach(() => {
    resetAllTemporaryLayouts();
    registerPageTemplateProvider(null);
});

const taskListKey = buildTemporaryPageKey("task", "list");

describe("temporary page layout store", () => {
    it("keeps overrides per page and drops keys set to undefined", () => {
        updateTemporaryPageLayout(taskListKey, { listViewType: "kanban", analyzeOpen: true });
        expect(getTemporaryPageLayout(taskListKey)).toEqual({ listViewType: "kanban", analyzeOpen: true });
        updateTemporaryPageLayout(taskListKey, { analyzeOpen: undefined });
        expect(getTemporaryPageLayout(taskListKey)).toEqual({ listViewType: "kanban" });
    });

    it("does not leak an override to another page", () => {
        updateTemporaryPageLayout(taskListKey, { listViewType: "gallery" });
        expect(getTemporaryPageLayout(buildTemporaryPageKey("task", "show"))).toEqual({});
    });

    it("gives an embedded page (null key) no overrides", () => {
        expect(getTemporaryPageLayout(null)).toEqual({});
    });

    it("resets one page", () => {
        updateTemporaryPageLayout(taskListKey, { listViewType: "gallery" });
        resetTemporaryPageLayout(taskListKey);
        expect(getTemporaryPageLayout(taskListKey)).toEqual({});
    });
});

describe("page template provider registry", () => {
    it("holds the registered provider until it is removed", () => {
        const provider = { listTemplatesForPage: async () => [], resolveTemplateRows: async () => [] };
        registerPageTemplateProvider(provider);
        expect(getRegisteredPageTemplateProvider()).toBe(provider);
        registerPageTemplateProvider(null);
        expect(getRegisteredPageTemplateProvider()).toBeNull();
    });
});

describe("TemporaryPageLayoutControls", () => {
    const renderControls = async (scope: any) => {
        const { TemporaryPageLayoutControls } = await import("./TemporaryPageLayoutControls");
        return renderToString(
            <TemporaryPageLayoutScopeProvider scope={scope}>
                <TemporaryPageLayoutControls />
            </TemporaryPageLayoutScopeProvider>,
        );
    };

    it("renders nothing outside a page scope (embedded pages)", async () => {
        expect(await renderControls(null)).toBe("");
    });

    it("offers the view type and Analyze buttons on a list page", async () => {
        const html = await renderControls({
            pageKey: taskListKey, pageType: "list", model: { name: "Task", fields: [] } as any, listViewTypes: ["table", "kanban"], analyzeAvailable: true,
        });
        // The Analyze switch lives in the Design options popover, so only that button is in the header.
        expect(html).toContain('aria-label="Design options"');
        expect(html).not.toContain('aria-label="Analyze"');
        expect(html).not.toContain('aria-label="View type"');
    });

    it("leaves out the view type and Analyze buttons on a create page", async () => {
        const html = await renderControls({ pageKey: buildTemporaryPageKey("task", "create"), pageType: "create", model: { name: "Task", fields: [] } as any });
        expect(html).not.toContain('aria-label="Analyze"');
        expect(html).toContain('aria-label="Design options"');
    });
});

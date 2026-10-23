import { describe, expect, it } from "vitest";
import type { NavConfig } from "../utils/navConfig";
import { sortItemsByNavConfig } from "../utils/navConfig";
import { listNavigationPagesInRefineResources } from "./useRefineResourcesIncludingNavigationPages";

const resources = [
    { name: "module:nlp", meta: { label: "NLP" } },
    { name: "jm_nlchat", list: "/jm_nlchat", meta: { label: "Chats", parent: "module:nlp" } },
    { name: "iqvigilant_api_tools", list: "/iqvigilant_api_tools", meta: { label: "API Tools", hide: true } },
];

const navConfig: NavConfig = [
    { key: "iqvigilant_api_tools", label: "API Tools", icon: "ApiOutlined", sequence: 5, type: "page", parent: "module:nlp" },
    { key: "deterministic-plans", label: "Deterministic Plans", icon: "NodeIndexOutlined", sequence: 7, type: "page",
      route: "/deterministic-plans", parent: "module:nlp" },
    { key: "jm_nlchat", label: "Chats", icon: "MessageOutlined", sequence: 9, type: "model" },
];

describe("listNavigationPagesInRefineResources", () => {
    it("leaves resources unchanged without page entries", () => {
        expect(listNavigationPagesInRefineResources(resources, [])).toBe(resources);
    });

    it("shows a hidden non-model resource under its parent module", () => {
        const tools = listNavigationPagesInRefineResources(resources, navConfig).find((r) => r.name === "iqvigilant_api_tools")!;
        expect(tools.meta).toMatchObject({ hide: false, parent: "module:nlp", label: "API Tools" });
        expect(tools.list).toBe("/iqvigilant_api_tools");
    });

    it("adds a menu-only resource for a custom page on its route", () => {
        const plans = listNavigationPagesInRefineResources(resources, navConfig).find((r) => r.name === "deterministic-plans")!;
        expect(plans).toMatchObject({ list: "/deterministic-plans", meta: { label: "Deterministic Plans", parent: "module:nlp" } });
    });
});

describe("sortItemsByNavConfig", () => {
    it("orders entries inside a module by sequence too", () => {
        const items = [{ name: "module:nlp", children: [{ name: "jm_nlchat" }, { name: "deterministic-plans" }, { name: "iqvigilant_api_tools" }] }];
        const [module] = sortItemsByNavConfig(items, navConfig);
        expect(module.children!.map((c) => c.name)).toEqual(["iqvigilant_api_tools", "deterministic-plans", "jm_nlchat"]);
    });
});

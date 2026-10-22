import { describe, expect, it } from "vitest";
import { anchorGroupStyle, bannerMoves, clipToViewport, groupBannersByAnchor, isCurrentPosition, percentSize } from "./layout";
import { bannersUrl } from "./BannerHost";
import { pageContextFromPath } from "../components/AppBannerHost";
import type { BannerPayload } from "./types";

const banner = (key: string, priority: number, horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom"): BannerPayload => ({
    key, title: key, icon: "WarningOutlined", tone: "warning", position: { horizontal, vertical },
    collapsed: { max_width: 20, max_height: 10 }, expanded: { max_width: 50, max_height: 50 },
    collapsed_content: "count", movable: true, priority, row_resource: null, view_all_resource: null,
    hide_when_empty: true, count: 1, columns: [], rows: [],
});

const rect = { left: 200, top: 64, width: 1000, height: 800 };

describe("banner layout", () => {
    it("stacks banners sharing an anchor by priority, and follows moved positions", () => {
        const groups = groupBannersByAnchor(
            [banner("a", 0, "left", "bottom"), banner("b", 5, "left", "bottom"), banner("c", 0, "right", "top")],
            { c: { horizontal: "left", vertical: "bottom" } },
        );
        expect(Array.from(groups.keys())).toEqual(["bottom-left"]);
        expect(groups.get("bottom-left")!.banners.map((b) => b.key)).toEqual(["b", "a", "c"]);
    });

    it("anchors groups at the edges of the content area", () => {
        const bottomLeft = anchorGroupStyle({ horizontal: "left", vertical: "bottom" }, rect);
        expect(bottomLeft.left).toBe(216);
        expect(bottomLeft.top).toBe(64 + 800 - 16);
        expect(bottomLeft.transform).toBe("translate(0, -100%)");
        expect(bottomLeft.flexDirection).toBe("column-reverse");
        const middleCenter = anchorGroupStyle({ horizontal: "center", vertical: "middle" }, rect);
        expect(middleCenter.left).toBe(700);
        expect(middleCenter.top).toBe(464);
        expect(middleCenter.transform).toBe("translate(-50%, -50%)");
        expect(middleCenter.maxHeight).toBe(768);
    });

    it("converts percentage sizes to px of the content area", () => {
        expect(percentSize({ max_width: 50, max_height: 25 }, rect)).toEqual({ maxWidth: 500, maxHeight: 200 });
    });

    it("moves change one axis and the current one is disabled", () => {
        const moves = bannerMoves((t) => t);
        const at = { horizontal: "left" as const, vertical: "bottom" as const };
        expect(moves.find((m) => m.id === "top")!.to(at)).toEqual({ horizontal: "left", vertical: "top" });
        expect(moves.filter((m) => isCurrentPosition(m, at)).map((m) => m.id)).toEqual(["left", "bottom"]);
    });

    it("clips the content element to the viewport", () => {
        expect(clipToViewport({ left: 200, top: -300, width: 1000, height: 2000 }, 1100, 900))
            .toEqual({ left: 200, top: 0, width: 900, height: 900 });
    });
});

describe("banner page context", () => {
    it("builds the endpoint URL from the page context", () => {
        expect(bannersUrl("/api/", { resource: "task" })).toBe("/api/veloiq/banners?resource=task");
        expect(bannersUrl("/api", { site: "candidate-portal" })).toBe("/api/veloiq/banners?site=candidate-portal");
        expect(bannersUrl("/api", {})).toBe("/api/veloiq/banners");
    });

    it("reads the resource and module of a host app route", () => {
        const models = [{ name: "Task", resource: "task", module: "tasks", label: "Task", fields: [] }];
        expect(pageContextFromPath("/task/show/3", models)).toEqual({ resource: "task", module: "tasks" });
        expect(pageContextFromPath("/dashboard", models)).toEqual({ resource: "dashboard" });
        expect(pageContextFromPath("/", models)).toEqual({});
    });
});

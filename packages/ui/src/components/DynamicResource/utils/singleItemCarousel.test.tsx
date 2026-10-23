/**
 * SingleItemCarousel renders every item on one track, shows the active one,
 * its "N / M" badge, and arrows that stop at the ends without wrapAround.
 * Rendered with react-dom/server (no DOM).
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

const renderCarousel = async (props: Record<string, unknown>) => {
    const { SingleItemCarousel } = await import("./singleItemCarousel");
    return renderToString(
        <SingleItemCarousel
            items={["first", "second", "third"]}
            getItemKey={(item) => item}
            renderItem={(item, _index, isActive) => <span>{`${item}${isActive ? " (shown)" : ""}`}</span>}
            {...props}
        />,
    );
};

describe("SingleItemCarousel", () => {
    it("shows the active item and its position", async () => {
        const html = await renderCarousel({ activeIndex: 1 });
        expect(html).toContain("second (shown)");
        expect(html).not.toContain("first (shown)");
        expect(html).toContain("2<!-- --> / <!-- -->3");
        expect(html).toContain("translateX(-100%)");
    });

    it("stops at the ends without wrapAround", async () => {
        const html = await renderCarousel({ activeIndex: 0, wrapAround: false });
        const previousArrow = html.match(/<button[^>]*aria-label="Previous"[^>]*>/)?.[0] ?? "";
        const nextArrow = html.match(/<button[^>]*aria-label="Next"[^>]*>/)?.[0] ?? "";
        expect(previousArrow).toContain("disabled");
        expect(nextArrow).not.toContain("disabled");
    });

    it("has no arrows or badge for a single item", async () => {
        const { SingleItemCarousel } = await import("./singleItemCarousel");
        const html = renderToString(
            <SingleItemCarousel items={["only"]} getItemKey={(item) => item} renderItem={(item) => <span>{item}</span>} />,
        );
        expect(html).not.toContain('aria-label="Next"');
        expect(html).not.toContain(" / ");
    });
});

/**
 * The primary view's carousel layout shows one record's card at a time, the
 * "N / M" position, a footer registered for the resource, and no card for the
 * records not shown. Rendered with react-dom/server (no DOM).
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

const model: any = { name: "job", resource: "job", fields: [] };
const records = [
    { id: 1, _label: "First position" },
    { id: 2, _label: "Second position" },
    { id: 3, _label: "Third position" },
];

describe("PrimaryCarouselLayout", () => {
    it("shows the first record's card and the position in the list", async () => {
        const { PrimaryCarouselLayout } = await import("./PrimaryCarouselLayout");
        const html = renderToString(<MemoryRouter><PrimaryCarouselLayout records={records} model={model} /></MemoryRouter>);
        expect(html.replace(/<!-- -->/g, "")).toContain("1 / 3");
        expect(html).toContain("First position");
        expect(html).toContain('target="_blank"');
    });

    it("opens the full page under the app's base path, as a portal needs", async () => {
        const { PrimaryCarouselLayout } = await import("./PrimaryCarouselLayout");
        const html = renderToString(
            <MemoryRouter basename="/portals/employer-portal" initialEntries={["/portals/employer-portal/job"]}><PrimaryCarouselLayout records={records} model={model} /></MemoryRouter>,
        );
        expect(html).toContain('href="/portals/employer-portal/job/show/1"');
    });

    it("shows the footer registered for the resource under the card", async () => {
        const { PrimaryCarouselLayout } = await import("./PrimaryCarouselLayout");
        const { registerPrimaryCarouselFooter } = await import("./primaryCarouselFooters");
        registerPrimaryCarouselFooter("job", ({ record }) => <span>{`decide on ${record.id}`}</span>);
        const html = renderToString(<PrimaryCarouselLayout records={records} model={model} />);
        expect(html).toContain("decide on 1");
    });

    it("tells when there are no records", async () => {
        const { PrimaryCarouselLayout } = await import("./PrimaryCarouselLayout");
        const html = renderToString(<PrimaryCarouselLayout records={[]} model={model} />);
        expect(html).toContain("No records available");
    });
});

describe("normalizeRelationViewType", () => {
    it("reads the carousel layout of the primary view", async () => {
        const { normalizeRelationViewType } = await import("./utils/viewConfig");
        expect(normalizeRelationViewType("primary-carousel")).toBe("primary-carousel");
        expect(normalizeRelationViewType("Primary Carousel")).toBe("primary-carousel");
        expect(normalizeRelationViewType("primary")).toBe("primary");
    });
});

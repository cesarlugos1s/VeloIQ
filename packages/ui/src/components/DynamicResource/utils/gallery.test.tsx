/**
 * renderSharedGalleryCard shows the card's label and, when given, its action
 * buttons (a list's row actions) under it. Rendered with react-dom/server (no DOM).
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

const renderCard = async (actions?: React.ReactNode[]) => {
    const { renderSharedGalleryCard } = await import("./gallery");
    return renderToString(renderSharedGalleryCard({
        item: { id: 7, title: "Data Scientist" },
        itemId: 7,
        label: "Data Scientist",
        apiUrl: "/api",
        imageWidth: 180,
        imageHeight: 140,
        borderColor: "#ddd",
        textColor: "#000",
        actions,
    }));
};

describe("renderSharedGalleryCard", () => {
    it("shows the action buttons under the label", async () => {
        const html = await renderCard([<button key="view">View position</button>, <button key="chat">Open chat</button>]);
        expect(html).toContain("Data Scientist");
        expect(html).toContain("View position");
        expect(html).toContain("Open chat");
        expect(html.indexOf("Data Scientist")).toBeLessThan(html.indexOf("View position"));
    });

    it("shows no action area without actions", async () => {
        const withoutActions = await renderCard();
        const withNoActions = await renderCard([]);
        expect(withoutActions).not.toContain("<button");
        expect(withNoActions).toBe(withoutActions);
    });
});

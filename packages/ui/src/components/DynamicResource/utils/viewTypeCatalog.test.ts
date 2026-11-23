import { beforeAll, describe, expect, it } from "vitest";

// The catalog reads a translation function from `window` when it runs (no DOM here).
let catalog: typeof import("./viewTypeCatalog");
let capabilities: typeof import("../viewState/viewTypeCapabilities");
beforeAll(async () => {
    (globalThis as any).window = globalThis;
    catalog = await import("./viewTypeCatalog");
    capabilities = await import("../viewState/viewTypeCapabilities");
});

describe("view type catalog", () => {
    it("lists each token once and gives every one a label", () => {
        const tokens = catalog.getAllViewTypes();
        expect(new Set(tokens).size).toBe(tokens.length);
        tokens.forEach((token) => expect(catalog.getViewTypeLabel(token)).not.toBe(""));
    });
    it("declares the capabilities of every view type except the tree ones (the page treats them like a table)", () => {
        const unknown = capabilities.getViewTypeCapabilities("no-such-view-type");
        catalog.getAllViewTypes().filter((token) => !token.startsWith("tree")).forEach((token) => {
            expect(capabilities.getViewTypeCapabilities(token)).not.toBe(unknown);
        });
    });
    it("lets configuration tools choose from every view type", () => {
        expect(catalog.getViewTypesForContext("configuration")).toEqual(catalog.getAllViewTypes().filter((token) => token !== "analyze"));
        expect(catalog.getViewTypesForContext("configuration")).not.toContain("analyze");
        expect(catalog.getViewTypesForContext("kanban-column")).toContain("analyze");
        expect(catalog.getViewTypesForContext("list-page")).not.toContain("csv");
        expect(catalog.getViewTypesForContext("relation-edit")).toContain("editable-csv");
        expect(catalog.getViewTypesForContext("relation-show")).not.toContain("editable-csv");
    });
    it("resolves the spellings configurations use", () => {
        expect(catalog.resolveViewTypeToken("Editable Table")).toBe("editable-table");
        expect(catalog.resolveViewTypeToken("editable")).toBe("editable-table");
        expect(catalog.resolveViewTypeToken("totalsdetails")).toBe("totals-details");
        expect(catalog.resolveViewTypeToken("PrimaryCarousel")).toBe("primary-carousel");
        expect(catalog.resolveViewTypeToken("images")).toBe("image");
        expect(catalog.resolveViewTypeToken("month")).toBe("calendar");
        expect(catalog.resolveViewTypeToken("nonsense")).toBe("");
    });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ModelDef, RelationDef } from "../types";

const authenticatedFetchMock = vi.fn();
vi.mock("../../../utils/authenticatedFetch", () => ({
    authenticatedFetch: (...args: unknown[]) => authenticatedFetchMock(...args),
}));

import { fetchPolymorphicGroups } from "./polymorphic";

const inventoryModel = { name: "Inventory", label: "Inventory", resource: "cw_inventory", fields: [] } as unknown as ModelDef;

const resolverRelation = {
    resource: "alert_applies_to_object",
    targetKey: "eid_from",
    otherKey: "eid_to",
    label: "Applies To",
    resolverPath: "exceptionalert/{id}/alerted-objects",
} as RelationDef;

describe("fetchPolymorphicGroups with a resolver path", () => {
    beforeEach(() => authenticatedFetchMock.mockReset());

    it("groups the resolved objects by the model of their resource", async () => {
        authenticatedFetchMock.mockResolvedValue({
            ok: true,
            json: async () => [
                { eid: 7, type: "Inventory", resource: "cw_inventory", title: "Inventory 7" },
                { eid: 9, type: "Unknown", resource: null, title: "9" },
            ],
        });
        const result = await fetchPolymorphicGroups({
            apiUrl: "/api", rel: resolverRelation, recordId: 42, referenceResource: "entities", allModels: [inventoryModel],
        });
        expect(authenticatedFetchMock).toHaveBeenCalledWith("/api/exceptionalert/42/alerted-objects");
        expect(Array.from(result.groups.get("Inventory") ?? [])).toEqual([7]);
        expect(result.unresolved).toEqual([9]);
        expect(result.labelsById?.get(7)).toBe("Inventory 7");
    });
});

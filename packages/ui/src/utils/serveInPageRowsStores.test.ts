import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelDef } from "../components/DynamicResource/types";
import { answerInPageRowsRequest, createInPageRowsStore, removeInPageRowsStore } from "./serveInPageRowsStores";

const lineModel: Omit<ModelDef, "resource"> = {
    name: "OrderLine",
    label: "Order lines",
    fields: [
        { key: "product", label: "Product", type: "string", required: true },
        { key: "quantity", label: "Quantity", type: "number" },
        { key: "gift", label: "Gift", type: "boolean" },
    ],
};

describe("in-page rows stores", () => {
    let resource = "";
    beforeEach(() => {
        resource = createInPageRowsStore("lines", lineModel, [
            { product: "Pear", quantity: 3, gift: false },
            { product: "Apple", quantity: 10, gift: true },
            { product: "Banana", quantity: 7, gift: false },
        ]).resource;
    });

    it("leaves other URLs to the network", () => {
        expect(answerInPageRowsRequest("/api/task?_start=0", "GET")).toBeNull();
    });

    it("lists with filters, search, sort, paging and the total count", () => {
        const page = answerInPageRowsRequest(`/api/${resource}?_start=0&_end=2&_sort=quantity&_order=desc`, "GET")!;
        expect(page.headers["x-total-count"]).toBe("3");
        expect(page.body.map((row: any) => row.product)).toEqual(["Apple", "Banana"]);
        expect(answerInPageRowsRequest(`/api/${resource}?quantity_gte=7`, "GET")!.body).toHaveLength(2);
        expect(answerInPageRowsRequest(`/api/${resource}?gift=true`, "GET")!.body[0].product).toBe("Apple");
        expect(answerInPageRowsRequest(`/api/${resource}?q=ban`, "GET")!.body[0].product).toBe("Banana");
    });

    it("adds, changes and deletes rows, validating them", () => {
        expect(answerInPageRowsRequest(`/api/${resource}`, "POST", JSON.stringify({ quantity: "x" }))!.status).toBe(422);
        const created = answerInPageRowsRequest(`/api/${resource}`, "POST", JSON.stringify({ product: "Kiwi", quantity: "2" }))!;
        expect(created.status).toBe(201);
        expect(created.body.quantity).toBe(2);
        const eid = created.body.eid;
        expect(answerInPageRowsRequest(`/api/${resource}/${eid}`, "PATCH", { quantity: 5 })!.body.quantity).toBe(5);
        expect(answerInPageRowsRequest(`/api/${resource}/${eid}`, "DELETE")!.status).toBe(204);
        expect(answerInPageRowsRequest(`/api/${resource}/${eid}`, "GET")!.status).toBe(404);
    });

    it("exports the matching rows as CSV", () => {
        const csv = answerInPageRowsRequest(`/api/${resource}/export-csv?gift=false`, "GET")!;
        expect(String(csv.body).trim().split("\n")).toEqual(["product,quantity,gift", "Pear,3,false", "Banana,7,false"]);
    });

    it("is answered by authenticatedFetch without reaching the network", async () => {
        const networkFetch = vi.fn(() => { throw new Error("network used"); });
        vi.stubGlobal("fetch", networkFetch);
        vi.stubGlobal("localStorage", { getItem: () => null });
        const { authenticatedFetch } = await import("./authenticatedFetch");
        const response = await authenticatedFetch(`/api/${resource}?_start=0&_end=10`);
        expect(response.headers.get("x-total-count")).toBe("3");
        expect((await response.json())).toHaveLength(3);
        expect(networkFetch).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("is answered by Refine's httpClient (axios) without reaching the network", async () => {
        vi.stubGlobal("localStorage", { getItem: () => null });
        const { httpClient } = await import("../providers/httpClient");
        const listResponse = await httpClient.get(`/api/${resource}`, { params: { _start: 0, _end: 1, _sort: "product" } });
        expect(listResponse.headers["x-total-count"]).toBe("3");
        expect(listResponse.data.map((row: any) => row.product)).toEqual(["Apple"]);
        await expect(httpClient.post(`/api/${resource}`, { quantity: 1 })).rejects.toThrow();
        vi.unstubAllGlobals();
    });

    it("answers 404 once the store is removed", () => {
        removeInPageRowsStore(resource);
        expect(answerInPageRowsRequest(`/api/${resource}`, "GET")!.status).toBe(404);
    });
});

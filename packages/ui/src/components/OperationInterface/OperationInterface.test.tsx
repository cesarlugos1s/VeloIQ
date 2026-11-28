/**
 * The shared operation interface: what a discovered operation fills in, the call a test sends, the registry client, and the
 * test button. Runs in Node (no DOM): fetch is stubbed and components are rendered with react-dom/server.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callFromFormValues, jsonTextValue, operationParameters, registryOperationFromDiscovered, valuesFromOperation } from "./operationFormFilling";
import { createRegistryOperationInterfaceClient, discoveredFromRegistryOperation } from "./registryOperationInterfaceClient";
import { OperationTestButton } from "./OperationTestButton";

class MemoryStorage {
    private data = new Map<string, string>();
    getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
    setItem(key: string, value: string) { this.data.set(key, String(value)); }
    removeItem(key: string) { this.data.delete(key); }
}

function answer(status: number, body: unknown) {
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

describe("what a discovered operation fills in", () => {
    it("fills path, base address, method, description, summary, response type, output fields and the request body as formatted JSON", () => {
        const values = valuesFromOperation({
            path: "/orders/{id}", base_url: "https://api.example.com", http_method: "POST", description: "Create an order",
            response_type: "object", output_fields: [{ name: "id" }], request_body: { schema: { type: "object" } },
        });
        expect(values).toMatchObject({ path: "/orders/{id}", base_url: "https://api.example.com", http_method: "POST", description: "Create an order",
            summary: "Create an order", response_type: "object", output_fields: [{ name: "id" }] });
        expect(values.request_body).toBe(JSON.stringify({ schema: { type: "object" } }, null, 2));
    });

    it("takes the first 120 characters of the description as the summary when there is none, and leaves out what is missing", () => {
        const long = "x".repeat(200);
        expect(valuesFromOperation({ description: long }).summary).toBe("x".repeat(120));
        expect(valuesFromOperation({ summary: "Short", description: long }).summary).toBe("Short");
        expect(Object.keys(valuesFromOperation({ path: "/a" }))).toEqual(["path"]);
    });

    it("gives path and query parameters a name, a type (string by default), required, description and default", () => {
        const parameters = operationParameters({ parameters: {
            path: [{ name: "id", schema: { type: "integer" }, required: true }],
            query: { name: "q", description: "Search", default: "abc" },
        } });
        expect(parameters.path).toEqual([{ name: "id", type: "integer", required: true, description: "", default: "" }]);
        expect(parameters.query).toEqual([{ name: "q", type: "string", required: false, description: "Search", default: "abc" }]);
        expect(operationParameters({})).toEqual({ path: [], query: [] });
    });

    it("reads JSON text as its value: null when empty, undefined when invalid", () => {
        expect(jsonTextValue("")).toBeNull();
        expect(jsonTextValue('{"a":1}')).toEqual({ a: 1 });
        expect(jsonTextValue("{nope")).toBeUndefined();
    });

    it("builds the call a test sends from the form values, then the record, with the method GET by default", () => {
        const parameters = { path: [], query: [] };
        expect(callFromFormValues({ path: "/x" }, { base_url: "https://h" }, parameters)).toEqual({
            path: "/x", base_url: "https://h", http_method: "GET", parameters, request_body: null });
        expect(callFromFormValues({ path: "/x", http_method: "PUT", request_body: '{"a":1}' }, undefined, parameters).request_body).toEqual({ a: 1 });
    });
});

describe("the registry client", () => {
    beforeEach(() => { vi.stubGlobal("localStorage", new MemoryStorage()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it("converts the registry's operation to the shape the screens read", () => {
        const operation = discoveredFromRegistryOperation({
            name: "getOrder", method: "GET", path: "/orders/{id}", description: "Read one order",
            parameters_schema: JSON.stringify({ path: [{ name: "id" }], query: [{ name: "expand" }], body: { type: "object" } }),
            response_schema: JSON.stringify({ type: "array" }),
        });
        expect(operation).toMatchObject({ http_method: "GET", summary: "Read one order", response_type: "array", request_body: { type: "object" } });
        expect(operation.parameters).toEqual({ path: [{ name: "id" }], query: [{ name: "expand" }] });
    });

    it("lists the operations of a description from an address, and from an uploaded file's content", async () => {
        const calls: any[] = [];
        vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
            calls.push([url, JSON.parse(init.body)]);
            return answer(200, { operations: [{ name: "a", method: "GET", path: "/a" }, { name: "b", method: "POST", path: "/b" }] });
        }));
        const client = createRegistryOperationInterfaceClient();
        const fromAddress = await client.discoverOperations({ address: "https://api.example.com/openapi.json" });
        expect(fromAddress.operations.map((operation) => operation.http_method)).toEqual(["GET", "POST"]);
        const file = { text: async () => '{"openapi":"3.0.0"}' } as unknown as File;
        await client.discoverOperations({ file });
        expect(calls[0][1]).toEqual({ address: "https://api.example.com/openapi.json" });
        expect(calls[1][1]).toEqual({ content: '{"openapi":"3.0.0"}' });
        expect(calls[0][0]).toContain("/registry/openapi-previews");
    });

    it("falls back to discovering one endpoint when the address is not a description, and carries the notice as a warning", async () => {
        vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("openapi-previews")
            ? answer(422, { detail: "The content is not an OpenAPI description." })
            : answer(200, { method: "GET", path: "/items/{id}", description: "GET /items/{id}", notice: "The URL could not be reached." })));
        const result = await createRegistryOperationInterfaceClient().discoverOperations({ address: "https://x/items/7" });
        expect(result.operations).toHaveLength(1);
        expect(result.operations[0]).toMatchObject({ http_method: "GET", path: "/items/{id}" });
        expect(result.warnings).toEqual(["The URL could not be reached."]);
    });

    it("reports the registry's message when a file is not a description, without trying to discover", async () => {
        const fetchMock = vi.fn(async () => answer(422, { detail: "The content is not an OpenAPI description." }));
        vi.stubGlobal("fetch", fetchMock);
        const file = { text: async () => "nope" } as unknown as File;
        await expect(createRegistryOperationInterfaceClient().discoverOperations({ file })).rejects.toThrow("not an OpenAPI description");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("tests the recorded operation and passes the confirmation of a write call", async () => {
        const fetchMock = vi.fn(async (_url: string, init: any) => answer(200, { status: JSON.parse(init.body).confirm_mutation ? "success" : "warning" }));
        vi.stubGlobal("fetch", fetchMock);
        const client = createRegistryOperationInterfaceClient({ operationId: () => 7 });
        const call = { path: "/x", http_method: "POST", parameters: { path: [], query: [] } };
        expect((await client.testOperation(call, false)).status).toBe("warning");
        expect((await client.testOperation(call, true)).status).toBe("success");
        expect(fetchMock.mock.calls[0][0]).toContain("/registry/operations/7/tests");
        await expect(createRegistryOperationInterfaceClient().testOperation(call, false)).rejects.toThrow("Record the operation");
    });

    it("builds the body that records a discovered operation under a connection", () => {
        const body = registryOperationFromDiscovered({ http_method: "POST", path: "/orders", description: "Create",
            parameters: { query: [{ name: "dry_run" }] }, request_body: { type: "object" }, response_schema: '{"type":"object"}' });
        expect(body).toMatchObject({ name: "POST /orders", method: "POST", path: "/orders", description: "Create", source: "openapi_import", response_schema: '{"type":"object"}' });
        expect(JSON.parse(body.parameters_schema!)).toEqual({ query: [{ name: "dry_run", type: "string", required: false, description: "", default: "" }], body: { type: "object" } });
    });
});

describe("the test button", () => {
    it("shows the Test API button, and the result window stays closed until a test has run", () => {
        vi.stubGlobal("window", { _: undefined });
        const html = renderToString(<OperationTestButton readCall={async () => undefined} client={createRegistryOperationInterfaceClient()} />);
        expect(html).toContain("Test API");
        expect(html).not.toContain("API Test Result");
        vi.unstubAllGlobals();
    });
});

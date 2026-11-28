/** The operation interface's client for the shared connection registry of the VeloIQ framework (`/api/registry`). */
import { API_URL } from "../../providers/constants";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import type { DiscoveredOperation, OperationCall, OperationDiscoveryResult, OperationInterfaceClient, OperationTestResult } from "./operationInterfaceTypes";

/** Read the message of a failed answer. */
async function failureMessage(response: Response, fallback: string): Promise<string> {
    const body = await response.json().catch(() => ({}));
    return typeof body?.detail === "string" ? body.detail : fallback;
}

/** Convert an operation the registry answers (its own field names) to the shape the screens read. */
export function discoveredFromRegistryOperation(operation: any): DiscoveredOperation {
    let schema: any = {};
    try { schema = operation.parameters_schema ? JSON.parse(operation.parameters_schema) : {}; } catch { schema = {}; }
    let output: any = {};
    try { output = operation.response_schema ? JSON.parse(operation.response_schema) : {}; } catch { output = {}; }
    return {
        ...operation,
        http_method: operation.http_method || operation.method,
        summary: operation.summary || operation.description || "",
        description: operation.description || "",
        parameters: operation.parameters || { path: schema.path || [], query: schema.query || [] },
        request_body: operation.request_body ?? schema.body ?? null,
        response_type: operation.response_type || output.type || undefined,
    };
}

/**
 * Discovery and test through `/api/registry`. A description is previewed first; when the content is not a description the
 * address is treated as one endpoint and discovered. A test needs a recorded operation, so `testOperation` takes the id of
 * the operation from `operationId`.
 */
export function createRegistryOperationInterfaceClient(options: { operationId?: () => number | undefined } = {}): OperationInterfaceClient {
    return {
        async discoverOperations({ address, file }): Promise<OperationDiscoveryResult> {
            const previewBody = file ? { content: await file.text() } : { address };
            const preview = await authenticatedFetch(`${API_URL}/registry/openapi-previews`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(previewBody),
            });
            if (preview.ok) return { operations: ((await preview.json()).operations || []).map(discoveredFromRegistryOperation) };
            if (file || !address) throw new Error(await failureMessage(preview, "Import failed"));
            const discovery = await authenticatedFetch(`${API_URL}/registry/operation-discoveries`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: address }),
            });
            if (!discovery.ok) throw new Error(await failureMessage(discovery, "Import failed"));
            const found = discoveredFromRegistryOperation(await discovery.json());
            return { operations: [found], warnings: found.notice ? [found.notice] : [] };
        },
        async testOperation(_call: OperationCall, confirmMutation: boolean): Promise<OperationTestResult> {
            const operationId = options.operationId?.();
            if (operationId === undefined) throw new Error("Record the operation before testing it.");
            const response = await authenticatedFetch(`${API_URL}/registry/operations/${operationId}/tests`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm_mutation: confirmMutation }),
            });
            if (!response.ok) throw new Error(await failureMessage(response, "Test request failed"));
            return response.json();
        },
    };
}

/** Test a connection of the shared registry (`POST /api/registry/connections/{id}/test`) and give the result its layout. */
import { API_URL } from "../../providers/constants";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import type { ConnectionTestResult } from "./connectionTestTypes";

/** Convert the registry's answer to the result the test window shows. */
export function connectionTestResultFromRegistry(answer: Record<string, any>): ConnectionTestResult {
    return {
        status: answer.status === "success" ? "success" : "error",
        error_type: answer.error_type,
        error_message: answer.error_message,
        duration_ms: answer.duration_ms,
        note: answer.note,
        details: [
            { label: "Endpoint Type", value: String(answer.endpoint_type ?? "—") },
            { label: "HTTP Status", value: answer.http_status != null ? String(answer.http_status) : "—" },
            { label: "Server", value: String(answer.server ?? "—") },
            { label: "Address", value: String(answer.url ?? "—") },
        ],
    };
}

/** Send the test for a connection; a refusal of the registry (no secret, not a REST connection) is thrown with its message. */
export async function testRegistryConnection(connectionId: number): Promise<ConnectionTestResult> {
    const response = await authenticatedFetch(`${API_URL}/registry/connections/${connectionId}/test`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Test request failed");
    return connectionTestResultFromRegistry(body);
}

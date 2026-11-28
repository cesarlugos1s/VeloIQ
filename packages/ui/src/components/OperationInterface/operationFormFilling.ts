/** Pure helpers of the operation interface: what a discovered operation fills in, and the call a test sends. */
import type { DiscoveredOperation, OperationCall, OperationParameters } from "./operationInterfaceTypes";

/** Return JSON text as its value: null when empty, undefined when it is not valid JSON. */
export function jsonTextValue(text: any): any {
    if (text === null || text === undefined || (typeof text === "string" && !text.trim())) return null;
    if (typeof text !== "string") return text;
    try { return JSON.parse(text); } catch { return undefined; }
}

/** Return a discovered operation's parameters in the registry's shape (path and query, each with name, type, required, description, default). */
export function operationParameters(operation: DiscoveredOperation): OperationParameters {
    const asList = (value: any) => (Array.isArray(value) ? value : value ? [value] : []);
    const toParameter = (parameter: any) => ({
        name: parameter.name || "",
        type: parameter.type || parameter.schema?.type || "string",
        required: parameter.required ?? false,
        description: parameter.description || "",
        default: parameter.default ?? "",
    });
    return {
        path: asList(operation.parameters?.path).map(toParameter),
        query: asList(operation.parameters?.query).map(toParameter),
    };
}

/**
 * The values a discovered operation puts into the form: path, base address, method, description, summary (the first
 * 120 characters of the description when there is none), response type, output fields and the request body as formatted JSON.
 */
export function valuesFromOperation(operation: DiscoveredOperation): Record<string, any> {
    const values: Record<string, any> = {};
    if (operation.path) values.path = operation.path;
    if (operation.base_url) values.base_url = operation.base_url;
    if (operation.http_method) values.http_method = operation.http_method;
    if (operation.description) values.description = operation.description;
    if (operation.summary) values.summary = operation.summary;
    else if (operation.description) values.summary = String(operation.description).substring(0, 120);
    if (operation.response_type) values.response_type = operation.response_type;
    if (Array.isArray(operation.output_fields) && operation.output_fields.length) values.output_fields = operation.output_fields;
    if (operation.request_body) values.request_body = JSON.stringify(operation.request_body, null, 2);
    return values;
}

/** Put a discovered operation's values into an Ant Design form. */
export function fillFormFromOperation(form: any, operation: DiscoveredOperation): void {
    if (form) form.setFieldsValue(valuesFromOperation(operation));
}

/** The call "Test API" sends: the form's current values (or the record's, for a field the form does not hold) and the given parameters. */
export function callFromFormValues(values: Record<string, any>, fallback: Record<string, any> | undefined, parameters: OperationParameters): OperationCall {
    const read = (key: string) => values[key] ?? fallback?.[key];
    return {
        path: read("path"),
        base_url: read("base_url") || undefined,
        http_method: read("http_method") || "GET",
        parameters,
        request_body: jsonTextValue(values.request_body) ?? null,
    };
}

/** The body `POST /registry/connections/{id}/operations` takes for a discovered operation (the registry's own shape). */
export function registryOperationFromDiscovered(operation: DiscoveredOperation, name?: string) {
    const parameters = operationParameters(operation);
    return {
        name: name || operation.name || `${operation.http_method || "GET"} ${operation.path}`,
        method: operation.http_method || "GET",
        path: operation.path,
        description: operation.description || operation.summary || "",
        parameters_schema: parameters.path.length || parameters.query.length || operation.request_body
            ? JSON.stringify({ ...(parameters.path.length ? { path: parameters.path } : {}), ...(parameters.query.length ? { query: parameters.query } : {}),
                               ...(operation.request_body ? { body: operation.request_body } : {}) })
            : null,
        response_schema: operation.response_schema ?? null,
        source: operation.source || "openapi_import",
    };
}

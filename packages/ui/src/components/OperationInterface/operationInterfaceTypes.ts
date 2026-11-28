/**
 * Types of the shared operation interface: the screens that discover, import, review and test API operations.
 *
 * The screens are taken from IQVigilant's API tool pages and keep their behaviour. They read and send everything
 * through an `OperationInterfaceClient`, so the same screens work against the shared registry (see
 * `registryOperationInterfaceClient`) and against IQVigilant's own endpoints.
 */

/** Path and query parameters of an operation, as the registry stores them. */
export interface OperationParameters {
    path: any[];
    query: any[];
}

/** An operation as the screens read it: the shape IQVigilant returns today (the registry's answers are converted to it). */
export interface DiscoveredOperation {
    http_method?: string;
    path?: string;
    base_url?: string;
    summary?: string;
    description?: string;
    response_type?: string;
    output_fields?: any[];
    request_body?: any;
    parameters?: { path?: any; query?: any };
    [key: string]: any;
}

/** What "Test API" sends: the form's values and the parameters (saved or not). */
export interface OperationCall {
    path: string;
    base_url?: string;
    http_method: string;
    parameters: OperationParameters;
    request_body?: any;
}

/** What a test came back with, or why it was not sent (a write call that is waiting for confirmation). */
export interface OperationTestResult {
    status: "success" | "error" | "warning";
    http_status?: number | null;
    headers?: Record<string, string>;
    body?: string;
    body_parsed?: any;
    duration_ms?: number;
    warning?: string | null;
    error?: string;
    url?: string;
}

export interface OperationDiscoveryResult {
    operations: DiscoveredOperation[];
    warnings?: string[];
}

/** How the screens reach the system that discovers and tests operations. */
export interface OperationInterfaceClient {
    /** Send the call; a write method must come back with status "warning" until `confirmMutation` is true. */
    testOperation(call: OperationCall, confirmMutation: boolean): Promise<OperationTestResult>;
    /** List the operations of an OpenAPI description (an address or a file), or discover the one endpoint of a URL. */
    discoverOperations(input: { address?: string; file?: File | null }): Promise<OperationDiscoveryResult>;
}

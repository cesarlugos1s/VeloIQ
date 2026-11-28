/** The result of a connection test, in the layout of IQVigilant's database connection test: a success or failure alert and a few facts. */
export interface ConnectionTestResult {
    status: "success" | "error";
    error_type?: string | null;
    error_message?: string | null;
    duration_ms?: number | null;
    /** A remark on a success (for example that nothing is served at the base address). */
    note?: string | null;
    /** The facts shown under the alert, each with its label and value. */
    details: { label: string; value: string }[];
}

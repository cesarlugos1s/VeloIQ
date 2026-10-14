import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { FieldDef } from "../types";
import { buildListFilterParams, type ListFilter } from "../utils/listFilters";
import type { SummaryFn } from "./aggregation";
import type { RankingMode } from "./useAnalyze";

const _ = (text: string): string => {
    const translate = typeof window !== "undefined" ? ((window as any)._ as ((t: string) => string) | undefined) : undefined;
    return translate ? translate(text) : text;
};

/** The server's aggregation of a list for the Analyze section (POST /api/<resource>/analyze). */
export interface ServerAnalyzeResult {
    /** Rows matching every filter. */
    total_rows: number;
    /** One group per combination of raw Category 1-3 values, after the ranking filter. */
    groups: Array<{ key: any[]; values: Record<string, number> }>;
    /** An evenly spaced sample of the matching rows, for charts that plot individual rows. */
    sample_rows: any[];
    /** Statistics of the back of the card: summaries of numeric fields, raw value counts of the others. */
    stats: {
        numeric: Record<string, { sum: number | null; avg: number | null; min: number | null; max: number | null; stddev: number | null }>;
        categorical: Record<string, Array<[any, number]>>;
    };
    /** Titles of referenced records, by field key then id. */
    reference_titles: Record<string, Record<string, string>>;
}

/** Inputs of {@link useServerAnalyze}. */
export interface UseServerAnalyzeOptions {
    /** False until the list has more rows than the server-aggregation threshold. */
    enabled: boolean;
    apiUrl: string;
    /** The list's resource path (``/api/<resourcePath>``). */
    resourcePath: string;
    /** Every field of the model (their key, type and whether they reference a record). */
    fields: FieldDef[];
    /** The list's server-side filters (refine-style), sent as the list endpoint's query params. */
    filters: ReadonlyArray<ListFilter | any>;
    /** The list's search text. */
    search: string;
    /** The list's column filters (selected values by field key). */
    columnFilters: Record<string, string[]>;
    categoryKeys: Array<string | null | undefined>;
    seriesKeys: string[];
    summaryFn: SummaryFn;
    rankingMode: RankingMode;
    rankingFieldKey: string | null;
    rankingN: number;
    /** Fields summarised on the statistics side of the card. */
    statsKeys: string[];
}

/**
 * Asks the server to aggregate a list for the Analyze section, instead of
 * downloading every row into the browser, once the list has more rows than the
 * ``analyzeServerAggregationThreshold`` view setting (System Configuration).
 *
 * The server applies the list's filters, search and column filters the way the
 * browser does and summarises with the same rules, so the chart shows the same
 * numbers either way. Requests are debounced and a stale response is ignored.
 */
export const useServerAnalyze = (options: UseServerAnalyzeOptions) => {
    const { enabled, apiUrl, resourcePath } = options;
    const [result, setResult] = useState<ServerAnalyzeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // One request per distinct configuration.
    const request = useMemo(() => {
        if (!enabled) return null;
        const params = buildListFilterParams(options.filters);
        const body = {
            fields: options.fields.map((field) => ({ key: field.key, type: field.type, reference: Boolean(field.reference) })),
            search: options.search,
            column_filters: options.columnFilters,
            category_keys: options.categoryKeys.filter(Boolean),
            series_keys: options.seriesKeys,
            summary_function: options.summaryFn,
            ranking: { mode: options.rankingMode, key: options.rankingFieldKey, n: options.rankingN },
            stats_keys: options.statsKeys,
        };
        return { url: `${apiUrl}/${resourcePath}/analyze?${params.toString()}`, body: JSON.stringify(body) };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- serialised below; the object identities change every render
    }, [enabled, apiUrl, resourcePath, JSON.stringify([
        options.fields.map((field) => [field.key, field.type, Boolean(field.reference)]), options.filters, options.search,
        options.columnFilters, options.categoryKeys, options.seriesKeys, options.summaryFn, options.rankingMode,
        options.rankingFieldKey, options.rankingN, options.statsKeys,
    ])]);

    useEffect(() => {
        if (!request) {
            setResult(null);
            setError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const timer = window.setTimeout(async () => {
            try {
                const response = await authenticatedFetch(request.url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: request.body,
                });
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body?.detail ?? `HTTP ${response.status}`);
                }
                const data = (await response.json()) as ServerAnalyzeResult;
                if (cancelled) return;
                setResult(data);
                setError(null);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : _("Failed to aggregate on the server."));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [request]);

    return { result, loading, error };
};

/** State returned by {@link useServerAnalyze}. */
export type ServerAnalyzeState = ReturnType<typeof useServerAnalyze>;

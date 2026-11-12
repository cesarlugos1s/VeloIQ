export interface CategoricalBreakdownEntry {
    value: string;
    count: number;
    /** True for the final row that aggregates every value outside the top ones. */
    isOthers?: boolean;
}

/** A summary card lists every distinct value while there are fewer than this many. */
export const CATEGORICAL_BREAKDOWN_DISTINCT_THRESHOLD = 5;

/**
 * Builds the rows of a categorical summary card: the distinct values with the highest
 * counts (descending, at most threshold - 1 of them), followed by one row with the
 * combined count of all remaining values when there are more distinct values than fit.
 */
export const buildCategoricalBreakdown = (
    counts: Map<string, number>,
    othersLabel: string,
    threshold: number = CATEGORICAL_BREAKDOWN_DISTINCT_THRESHOLD,
): CategoricalBreakdownEntry[] => {
    const sorted = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    if (sorted.length < threshold) return sorted;
    const shown = sorted.slice(0, threshold - 1);
    const othersCount = sorted.slice(threshold - 1).reduce((sum, entry) => sum + entry.count, 0);
    return [...shown, { value: othersLabel, count: othersCount, isOthers: true }];
};

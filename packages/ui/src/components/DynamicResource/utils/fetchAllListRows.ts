/**
 * Fetches the rows of a list resource page by page, with the list's filters, for the
 * list page (all rows, for client-side filtering) and for tools that need the rows
 * of a list without rendering it.
 */
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { buildListFilterParams } from "./listFilters";
import type { ListFilter } from "./listFilters";

export interface FetchAllListRowsOptions {
    apiUrl: string;
    resourcePath: string;
    filters?: ReadonlyArray<ListFilter | any>;
    /** Rows requested per call. */
    pageSize?: number;
    /** Stops after this many rows; absent fetches every row. */
    maxRows?: number;
}

/** The rows of the resource (at most `maxRows`); stops at the first response that is not a list. */
export async function fetchAllListRows({ apiUrl, resourcePath, filters = [], pageSize = 500, maxRows }: FetchAllListRowsOptions): Promise<any[]> {
    let start = 0;
    let rows: any[] = [];
    while (maxRows === undefined || rows.length < maxRows) {
        const params = buildListFilterParams(filters);
        params.set("_start", String(start));
        params.set("_end", String(start + pageSize));
        const response = await authenticatedFetch(`${apiUrl}/${resourcePath}?${params.toString()}`);
        const data = await response.json();
        if (!Array.isArray(data)) break;
        rows = rows.concat(data);
        if (data.length < pageSize) break;
        start += pageSize;
    }
    return maxRows === undefined ? rows : rows.slice(0, maxRows);
}

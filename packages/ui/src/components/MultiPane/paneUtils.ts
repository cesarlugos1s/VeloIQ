export interface PaneEntry {
    resource: string;
    id: string;
}

/** Parse repeated `?pane=resource:id` search params into an ordered array. */
export function parsePanes(searchParams: URLSearchParams): PaneEntry[] {
    return searchParams
        .getAll("pane")
        .map((param) => {
            const colonIdx = param.indexOf(":");
            if (colonIdx < 1) return null;
            const resource = param.slice(0, colonIdx);
            const id = param.slice(colonIdx + 1);
            if (!resource || !id) return null;
            return { resource, id };
        })
        .filter((p): p is PaneEntry => p !== null);
}

/** Return a new URLSearchParams with the pane entries replaced. Preserves all other params. */
export function applyPanesToSearchParams(
    existing: URLSearchParams,
    panes: PaneEntry[],
): URLSearchParams {
    const next = new URLSearchParams(existing);
    next.delete("pane");
    panes.forEach((p) => next.append("pane", `${p.resource}:${p.id}`));
    return next;
}

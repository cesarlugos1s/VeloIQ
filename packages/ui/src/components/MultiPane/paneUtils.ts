export interface PaneEntry {
    resource: string;
    id: string;
}

/** Parse repeated `?pane=resource:id` (or `?pane[]=resource:id`) search params into an ordered array. */
export function parsePanes(searchParams: URLSearchParams): PaneEntry[] {
    // Try the standard repeated-key format first.
    const standard = searchParams.getAll("pane");
    if (standard.length > 0) {
        return standard
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

    // Fallback: `pane[0]=...&pane[1]=...` or `pane[]=...&pane[]=...` format.
    const legacy: PaneEntry[] = [];
    for (const [key, value] of searchParams.entries()) {
        if (/^pane(?:\[\d*\])?$/.test(key)) {
            const colonIdx = value.indexOf(":");
            if (colonIdx < 1) continue;
            const resource = value.slice(0, colonIdx);
            const id = value.slice(colonIdx + 1);
            if (resource && id) {
                legacy.push({ resource, id });
            }
        }
    }
    return legacy;
}

/** Return a new URLSearchParams with the pane entries replaced. Preserves all other params.
 *  Handles both `pane=...` and `pane[0]=...` formats in the existing params.
 */
export function applyPanesToSearchParams(
    existing: URLSearchParams,
    panes: PaneEntry[],
): URLSearchParams {
    const next = new URLSearchParams(existing);
    // Remove all pane-related keys (both `pane` and `pane[0]`, `pane[1]`, ...)
    for (const [key] of existing.entries()) {
        if (key === "pane" || /^pane\[\d+\]$/.test(key)) {
            next.delete(key);
        }
    }
    panes.forEach((p) => next.append("pane", `${p.resource}:${p.id}`));
    return next;
}

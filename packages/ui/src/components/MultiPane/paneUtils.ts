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

// ---------------------------------------------------------------------------
// Layout constants and pure layout math shared by the pane layout modes
// ---------------------------------------------------------------------------

/** Width in px of a collapsed pane ("spine") showing only a rotated title. */
export const SPINE_WIDTH_PX = 40;

/** Horizontal offset in px between stacked overlay drawers, so the edge of the earlier one stays visible. */
export const OVERLAY_OFFSET_PX = 24;

/** Panel id of the master list / main page pane in the "stack" split group. */
export const LIST_PANEL_ID = "list-panel";

/** Panel id of the detail pane at the given index in the URL pane array. */
export const detailPanelId = (idx: number): string => `detail-panel-${idx}`;

/** Percentage layout of a resizable group: panel id → percent of the group width. */
export type StackLayout = { [panelId: string]: number };

/**
 * Splits an ordered list of pane ids into the ones shown as full panes and the
 * ones collapsed into spines: the last `cap` ids are visible, the older ones
 * become spines.
 */
export function splitVisibleAndSpines(ids: string[], cap: number): { visible: string[]; spines: string[] } {
    const keep = Math.max(1, Math.min(cap, ids.length));
    return { visible: ids.slice(ids.length - keep), spines: ids.slice(0, ids.length - keep) };
}

/**
 * Computes the percentage layout of the "stack" split group after its set of
 * panes changed.
 *
 * Spines take a fixed `spinePct` each; the fully visible panes share what is
 * left. Panes that were already visible keep their relative sizes. When
 * `splitDonor` is true and a single new pane entered at the right end, it takes
 * 80% of the rightmost surviving pane's share (that pane keeps 20%) — the
 * cascading split the right-side panels have always used. Otherwise panes that
 * entered (e.g. a spine restored by a click) get an equal share.
 *
 * @param prevLayout   Layout snapshot taken before the change.
 * @param prevVisible  Ids that were fully visible (not spines) before the change.
 * @param nextIds      Ordered ids of every pane after the change.
 * @param cap          Maximum number of fully visible panes.
 * @param spinePct     Percentage of the group a spine occupies.
 * @param splitDonor   Apply the 80/20 donor split for a single newly added pane.
 */
export function computeStackLayout(
    prevLayout: StackLayout,
    prevVisible: string[],
    nextIds: string[],
    cap: number,
    spinePct: number,
    splitDonor: boolean,
): StackLayout {
    const { visible, spines } = splitVisibleAndSpines(nextIds, cap);
    const available = Math.max(0, 100 - spines.length * spinePct);
    const layout: StackLayout = {};
    spines.forEach((id) => { layout[id] = spinePct; });

    const known = visible.filter((id) => prevVisible.includes(id) && (prevLayout[id] ?? 0) > 0);
    const entering = visible.filter((id) => !known.includes(id));

    if (known.length === 0) {
        visible.forEach((id) => { layout[id] = available / visible.length; });
        return layout;
    }

    // Single new pane at the right end: donor split (80/20) of the last known pane.
    if (splitDonor && entering.length === 1 && entering[0] === visible[visible.length - 1]) {
        const knownTotal = known.reduce((sum, id) => sum + prevLayout[id], 0);
        known.forEach((id) => { layout[id] = (prevLayout[id] / knownTotal) * available; });
        const donor = known[known.length - 1];
        const donorSize = layout[donor];
        layout[donor] = donorSize * 0.2;
        layout[entering[0]] = donorSize * 0.8;
        return layout;
    }

    // General case: entering panes get an equal share, survivors keep their proportions.
    const enteringShare = available / visible.length;
    const knownBudget = Math.max(0, available - enteringShare * entering.length);
    const knownTotal = known.reduce((sum, id) => sum + prevLayout[id], 0);
    known.forEach((id) => { layout[id] = (prevLayout[id] / knownTotal) * knownBudget; });
    entering.forEach((id) => { layout[id] = enteringShare; });
    return layout;
}

/**
 * Builds the initial "stack" layout for a page load with the given detail pane
 * ids in the URL by replaying the same sequential opens interactive navigation
 * would produce, so a refreshed page looks like a navigated one.
 */
export function computeInitialStackLayout(detailIds: string[], cap: number, spinePct: number): StackLayout {
    let ids = [LIST_PANEL_ID];
    let layout: StackLayout = { [LIST_PANEL_ID]: 100 };
    let visible = [LIST_PANEL_ID];
    for (const detailId of detailIds) {
        ids = [...ids, detailId];
        layout = computeStackLayout(layout, visible, ids, cap, spinePct, true);
        visible = splitVisibleAndSpines(ids, cap).visible;
    }
    return layout;
}

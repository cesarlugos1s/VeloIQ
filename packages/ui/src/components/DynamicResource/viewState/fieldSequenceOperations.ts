/**
 * Pure operations on the field sequence (the ordered list of visible fields),
 * shared by every view type that edits it.
 */

/** The order after the visible set changes: kept fields keep their place, new ones go last. */
export function orderAfterSelection(previousOrder: string[] | null, selectedKeys: string[]): string[] {
    const keptOrder = previousOrder && previousOrder.length > 0 ? previousOrder.filter((key) => selectedKeys.includes(key)) : [];
    const added = selectedKeys.filter((key) => !keptOrder.includes(key));
    return [...keptOrder, ...added];
}

/** The order after moving one field a position left or right; an impossible move changes nothing. */
export function orderAfterMove(
    previousOrder: string[] | null,
    selectedKeys: string[] | null,
    key: string,
    direction: "left" | "right",
): string[] {
    const base = previousOrder && previousOrder.length > 0 ? [...previousOrder] : selectedKeys ? [...selectedKeys] : [];
    const index = base.indexOf(key);
    if (index === -1) return base;
    const swapIndex = direction === "left" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= base.length) return base;
    [base[index], base[swapIndex]] = [base[swapIndex], base[index]];
    return base;
}

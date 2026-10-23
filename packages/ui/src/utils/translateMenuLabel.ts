/**
 * The translated name of a menu entry, shared by the vertical and horizontal menus.
 *
 * Translated at call time. If no exact translation exists and the label looks
 * like a raw slug (contains _ or -), retry with a humanized version so
 * "exception_alert" → "Exception Alert" can match the PO catalog.
 * Already-translated labels (no _/-) are never re-humanized, so accented
 * output like "Alerta de Excepción" is preserved verbatim.
 */
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

export function translateMenuLabel(item: { label?: unknown; name?: string; key?: string } | null | undefined): string {
    const rawLabel = String(item?.label || item?.name || item?.key || "");
    let label = _(rawLabel);
    if (label === rawLabel && (rawLabel.includes("_") || rawLabel.includes("-"))) {
        const humanized = rawLabel.replace(/[_-]+/g, " ").trim()
            .split(/\s+/).filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        if (humanized && humanized !== rawLabel) {
            const humanizedLabel = _(humanized);
            if (humanizedLabel !== humanized) label = humanizedLabel;
        }
    }
    return label;
}

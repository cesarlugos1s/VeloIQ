/**
 * One summary card of the totals-details view type. It is drawn like a kanban column: a rounded,
 * softly shadowed panel with a tinted title bar, so the cards read as part of the same
 * family. The tone (numeric or categorical) sets the colours of the bar and of the body.
 */
import React, { useContext } from "react";
import { Typography, theme } from "antd";
import { formatNumberValue } from "./utils/formatting";
import { getContrastingTextColor, getModelTone } from "../../utils/modelTone";
import { ColorModeContext } from "../../contexts/ColorModeContext";
import type { CategoricalBreakdownEntry } from "./utils/categoricalBreakdown";

const { Text } = Typography;

export interface TotalsDetailsCardTone {
    soft: string;
    softer: string;
    /** Title text colour, and body text colour when `bodyText` is not given. */
    text: string;
    bodyText?: string;
    border: string;
    shadow: string;
}

const toHexChannel = (value: number) => Math.round(value).toString(16).padStart(2, "0");

/** The opaque hex colour a "#rrggbb" or "rgba(r, g, b, a)" colour shows when drawn over `surfaceHex`. */
const flattenColorOverSurface = (color: string, surfaceHex: string): string => {
    const surface = [1, 3, 5].map((index) => parseInt(surfaceHex.slice(index, index + 2), 16));
    const rgbaMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (rgbaMatch) {
        const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);
        const channels = [rgbaMatch[1], rgbaMatch[2], rgbaMatch[3]].map((channel, index) => Number(channel) * alpha + surface[index] * (1 - alpha));
        return `#${channels.map(toHexChannel).join("")}`;
    }
    return color;
};

/** Surface a translucent title tone is blended over when the app's container colour is not used. */
const LIGHT_SURFACE_HEX = "#ffffff";

/**
 * Reactive tone of the categorical-field cards. The title bar uses the model's tone of the
 * opposite colour mode (dark-mode tone in light mode and vice versa), which tells the cards apart
 * from the numeric ones; the body has the background and font colour of the numeric cards' body.
 * Without a model, the default tone is used. A translucent title background is made opaque over
 * the app's container colour and its text colour is chosen for contrast against it.
 */
export const useCategoricalCardTone = (
    modelLike?: Parameters<typeof getModelTone>[0],
): TotalsDetailsCardTone => {
    const { mode, schemaVersion } = useContext(ColorModeContext);
    void schemaVersion; // read so the tone follows setColorSchemas()
    const currentTone = getModelTone(modelLike, mode === "dark");
    const { token } = theme.useToken();
    const titleTone = getModelTone(modelLike, mode !== "dark");
    // In light mode a translucent title tone is blended over the app's own container colour, so the
    // title follows it. In dark mode it is blended over white, keeping the title a light bar that
    // stands out from the dark body (over the dark container it would look like the body).
    const appSurface = mode === "dark"
        ? LIGHT_SURFACE_HEX
        : (/^#[0-9a-fA-F]{6}$/.test(token.colorBgContainer) ? token.colorBgContainer : LIGHT_SURFACE_HEX);
    const titleBackground = flattenColorOverSurface(titleTone.soft, appSurface);
    return {
        soft: titleBackground,
        softer: currentTone.softer,
        text: getContrastingTextColor(titleBackground),
        bodyText: currentTone.solid,
        border: currentTone.border,
        shadow: currentTone.shadow,
    };
};

export const TotalsDetailsCard: React.FC<{
    title: React.ReactNode;
    tone: TotalsDetailsCardTone;
    children: React.ReactNode;
}> = ({ title, tone, children }) => (
    <div
        style={{
            minWidth: 170,
            display: "flex",
            flexDirection: "column",
            borderRadius: 8,
            background: tone.softer,
            boxShadow: `0 8px 20px -16px ${tone.shadow}`,
            overflow: "hidden",
        }}
    >
        <div style={{ padding: "8px 12px", background: tone.soft }}>
            <Text strong style={{ overflowWrap: "anywhere", color: tone.text }}>{title}</Text>
        </div>
        <div style={{ padding: 12, flex: 1 }}>{children}</div>
    </div>
);

/**
 * Body of a categorical card: the breakdown rows ("value: count", most frequent first, the
 * remaining values grouped in an "Others" row) or, when there is no breakdown, the one `value`
 * in large type. Shared by the totals-details cards and by any list of categorical summaries.
 */
export const CategoricalCardBody: React.FC<{
    tone: TotalsDetailsCardTone;
    breakdown?: CategoricalBreakdownEntry[];
    value?: number;
}> = ({ tone, breakdown, value }) => (
    breakdown && breakdown.length > 0 ? (
        <div style={{ display: "grid", gap: 4 }}>
            {breakdown.map((entry) => (
                <div key={entry.value} style={{ fontSize: 12, color: tone.bodyText ?? tone.text, fontWeight: 400, textAlign: "center" }}>
                    {`${entry.value}: ${formatNumberValue(entry.count)}`}
                </div>
            ))}
        </div>
    ) : (
        <div style={{ fontSize: 24, fontWeight: 400, color: tone.bodyText ?? tone.text, textAlign: "center" }}>{formatNumberValue(value ?? 0)}</div>
    )
);

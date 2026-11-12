/**
 * One summary card of the totals-details view type. It is drawn like a kanban column: a rounded,
 * softly shadowed panel with a tinted title bar, so the cards read as part of the same
 * family. The tone (numeric or categorical) sets the colours of the bar and of the body.
 */
import React from "react";
import { Typography } from "antd";

const { Text } = Typography;

export interface TotalsDetailsCardTone {
    soft: string;
    softer: string;
    text: string;
    border: string;
    shadow: string;
}

/** Tone of the categorical-field cards (amber); the numeric cards use the model's own tone. */
export const CATEGORICAL_CARD_TONE: TotalsDetailsCardTone = {
    soft: "#fde68a",
    softer: "#fffbeb",
    text: "#92400e",
    border: "#fcd34d",
    shadow: "#d97706",
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

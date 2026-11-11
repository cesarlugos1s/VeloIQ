/**
 * The Analyze section's open and close button, the same in every view type
 * and every place a page offers it (list header, configuration card, embedded
 * list, kanban toolbar, related-model block): the chart icon, a tooltip that
 * says what a click does, and the primary style while the section is open.
 */
import React from "react";
import { Button, Tooltip } from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface AnalyzeToggleButtonProps {
    open: boolean;
    onToggle: () => void;
    /** Show the word "Analyze" beside the icon (used among labelled buttons). */
    showLabel?: boolean;
}

export const AnalyzeToggleButton: React.FC<AnalyzeToggleButtonProps> = ({ open, onToggle, showLabel = false }) => (
    <Tooltip title={open ? _("Hide Analyze") : _("Analyze")}>
        <Button
            size="small"
            type={open ? "primary" : "default"}
            icon={<BarChartOutlined />}
            aria-label={_("Analyze")}
            aria-pressed={open}
            onClick={onToggle}
        >
            {showLabel ? _("Analyze") : null}
        </Button>
    </Tooltip>
);

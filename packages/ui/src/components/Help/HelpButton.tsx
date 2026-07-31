import React, { useContext } from "react";
import { Button, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { HelpContext } from "../../contexts/HelpContext";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export interface HelpButtonProps {
    onClick: () => void;
}

// Sentinel page_key for the Dashboard page itself (not a specific resource).
export const DASHBOARD_MAIN_PAGE_KEY = "_dashboard:main";

const TOOLTIP_BY_SUFFIX: Record<string, string> = {
    list: "List page help",
    show: "Show page help",
    edit: "Edit page help",
    create: "Create page help",
};

function tooltipForPageKey(pageKey: string | null): string {
    if (pageKey === DASHBOARD_MAIN_PAGE_KEY) return _("Dashboard help");
    if (pageKey) {
        const suffix = pageKey.split(":").pop() || "";
        const label = TOOLTIP_BY_SUFFIX[suffix];
        if (label) return _(label);
    }
    return _("Help");
}

/** App-shell header button that toggles the Help drawer — same show/hide pattern as other header icon buttons (e.g. Command Center). Tooltip text reflects the current page type. */
export const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
    const { pageKey } = useContext(HelpContext);
    return (
        <Tooltip title={tooltipForPageKey(pageKey)}>
            <Button icon={<QuestionCircleOutlined />} onClick={onClick} type="text" />
        </Tooltip>
    );
};

/**
 * The gear button that shows or hides the view configuration (filters, sorting,
 * fields) of a list. Shared by the list page and by tools that edit the same
 * configuration, so both look and read the same.
 */
import React from "react";
import { Button, Tooltip } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface ViewConfigurationToggleButtonProps {
    open: boolean;
    onToggle: () => void;
}

export const ViewConfigurationToggleButton: React.FC<ViewConfigurationToggleButtonProps> = ({ open, onToggle }) => {
    const label = open ? _("Hide view configuration") : _("Show view configuration");
    return (
        <Tooltip title={label}>
            <Button size="small" icon={<SettingOutlined />} onClick={onToggle} aria-label={label} />
        </Tooltip>
    );
};

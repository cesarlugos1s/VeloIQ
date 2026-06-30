import React, { useState } from "react";
import { Button, Popover, Slider, Typography, Tooltip } from "antd";
import { SlidersOutlined } from "@ant-design/icons";
import type { DataDetailLevelState } from "./hooks/useDataDetailLevel";

const { Text } = Typography;

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const DataDetailSlider: React.FC<{
    detailState: DataDetailLevelState | undefined;
}> = ({ detailState }) => {
    if (!detailState) return null;
    const [open, setOpen] = useState(false);
    const { dataDetailLevel, setDataDetailLevel, levelLabels, levelTooltips, isActive } = detailState;

    if (!isActive) return null;

    const currentLabel = levelLabels[dataDetailLevel] ?? "";

    const marks: Record<number, React.ReactNode> = {};
    for (let i = 0; i <= 6; i++) {
        marks[i] = (
            <Tooltip title={levelTooltips[i]}>
                <span>{levelLabels[i]}</span>
            </Tooltip>
        );
    }

    const popoverContent = (
        <div style={{ width: 580, padding: "8px 4px" }}>
            <div style={{ marginBottom: 8 }}>
                <Text strong>{_("Data Detail Level")}</Text>
            </div>
            <Slider
                min={0}
                max={6}
                step={1}
                value={dataDetailLevel}
                onChange={(val) => setDataDetailLevel(val)}
                marks={marks}
                tooltip={{ formatter: (val) => levelTooltips[val ?? 0] }}
            />
            <div style={{ marginTop: 8, textAlign: "center" }}>
                <Text type="secondary">
                    {_("Adjust how relations are displayed on this page.")}
                </Text>
            </div>
        </div>
    );

    return (
        <Popover
            content={popoverContent}
            title={null}
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
        >
            <Tooltip title={levelTooltips[dataDetailLevel]}>
                <Button size="small" icon={<SlidersOutlined />}>
                    {currentLabel}
                </Button>
            </Tooltip>
        </Popover>
    );
};

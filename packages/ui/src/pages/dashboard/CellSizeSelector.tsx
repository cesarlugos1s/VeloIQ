import React, { useState } from "react";
import { Button, Popover, Slider, Tooltip, Typography } from "antd";
import { SlidersOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CellSizeSelectorProps {
    /** Panel title and trigger tooltip, e.g. "Cell size". */
    label: string;
    /** Number of discrete steps on the slider (0..stepCount-1). */
    stepCount: number;
    /** Slider marks, keyed by step index — JSX, so callers can size/format
     * label text to fit as many marks as they need on one track. */
    marks: Record<number, React.ReactNode>;
    /** Currently selected step index. */
    value: number;
    onChange: (index: number) => void;
    /** Plain-text label for the currently selected step — shown as the
     * trigger button's own text, so the button always reads as "whatever is
     * currently selected" rather than a fixed caption. */
    currentLabelText: string;
}

/** A small icon button whose label is the current selection; clicking it
 * opens a popover containing the actual slider. Matches the "Data Detail
 * Level" selector pattern used by DynamicShow/DynamicEdit (DataDetailSlider)
 * so every personalization surface in the framework opens the same way. */
export const CellSizeSelector: React.FC<CellSizeSelectorProps> = ({ label, stepCount, marks, value, onChange, currentLabelText }) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover
            content={
                <div style={{ width: 480, padding: "8px 4px" }}>
                    <div style={{ marginBottom: 8 }}>
                        <Text strong>{label}</Text>
                    </div>
                    <Slider
                        min={0}
                        max={stepCount - 1}
                        step={null}
                        marks={marks}
                        value={value}
                        onChange={onChange}
                        tooltip={{ formatter: (index?: number) => (index !== undefined ? marks[index] : "") ?? "" }}
                    />
                </div>
            }
            title={null}
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
        >
            <Tooltip title={label}>
                <Button size="small" icon={<SlidersOutlined />} style={{ marginRight: 12 }}>
                    {currentLabelText}
                </Button>
            </Tooltip>
        </Popover>
    );
};

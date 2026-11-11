/**
 * The temporary view type button of a relation block: a button like "Design
 * options" on list pages whose popover holds only the view type selector. The
 * block's host builds the button and provides it through a context; the
 * toolbar of the block's view (RelatedObjectsTable, an embedded list) draws it
 * with `RelationViewTypeSwitchSlot`. A view without a toolbar leaves it
 * undrawn, and the host then floats it at the top right of the block.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { Button, Popover, Select, Tooltip, Typography } from "antd";
import { TableOutlined } from "@ant-design/icons";
import { buildListViewTypeLabels } from "../temporaryLayout/TemporaryPageLayoutControls";

const { Text } = Typography;
const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

interface RelationViewTypeSwitchContextValue {
    button: React.ReactNode;
    /** Called by a toolbar slot while it is mounted; returns the function that undoes it. */
    registerToolbarSlot: () => () => void;
}

export const RelationViewTypeSwitchContext = createContext<RelationViewTypeSwitchContextValue | null>(null);

/** Draws the enclosing relation block's view type button inside a toolbar (nothing outside a relation block). */
export const RelationViewTypeSwitchSlot: React.FC = () => {
    const context = useContext(RelationViewTypeSwitchContext);
    const register = context?.registerToolbarSlot;
    useEffect(() => (register ? register() : undefined), [register]);
    return <>{context?.button ?? null}</>;
};

/** True while a toolbar of the block draws the button (the host floats it otherwise). */
export function useToolbarSlotCount(): { hasToolbarSlot: boolean; registerToolbarSlot: () => () => void } {
    const [slotCount, setSlotCount] = useState(0);
    const registerToolbarSlot = React.useCallback(() => {
        setSlotCount((count) => count + 1);
        return () => setSlotCount((count) => count - 1);
    }, []);
    return { hasToolbarSlot: slotCount > 0, registerToolbarSlot };
}

export const RelationViewTypeButton: React.FC<{
    /** The temporary choice; undefined means the configured view type is shown. */
    temporaryViewType: string | undefined;
    offeredViewTypes: string[];
    onChange: (viewType: string | undefined) => void;
}> = ({ temporaryViewType, offeredViewTypes, onChange }) => {
    const [open, setOpen] = useState(false);
    const labels = buildListViewTypeLabels();
    const content = (
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 8 }}>
            <Text type="secondary">{_("These changes last until the page is reloaded and do not change the page configuration.")}</Text>
            <Text>{_("View type")}</Text>
            <Select<string>
                size="small"
                virtual={false}
                listHeight={400}
                value={temporaryViewType ?? ""}
                options={[
                    { value: "", label: _("Configured view type") },
                    ...offeredViewTypes.map((token) => ({ value: token, label: labels[token] ?? token })),
                ]}
                onChange={(value) => { onChange(value || undefined); setOpen(false); }}
            />
        </div>
    );
    return (
        <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
            <Tooltip title={_("View type")}>
                <Button size="small" icon={<TableOutlined />} type={temporaryViewType ? "primary" : "default"} aria-label={_("View type")} />
            </Tooltip>
        </Popover>
    );
};

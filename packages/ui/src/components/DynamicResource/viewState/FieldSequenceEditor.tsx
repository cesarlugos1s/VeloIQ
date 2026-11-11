/**
 * Field sequence editor: which fields are visible and in what order.
 * Shared by every view type that uses the field sequence (see
 * viewTypeCapabilities); it edits the `fieldSequence` of the shared view state.
 */
import React from "react";
import { Button, Checkbox, Tooltip, theme } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import type { FieldDef } from "../types";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface FieldSequenceEditorProps {
    fields: FieldDef[];
    /** Visible field keys, or null while the defaults apply. */
    selectedKeys: string[] | null;
    /** Visible field keys in sequence order. */
    orderedKeys: string[];
    onSelectionChange: (values: string[]) => void;
    onMove: (key: string, direction: "left" | "right") => void;
    onReset: () => void;
}

export const FieldSequenceEditor: React.FC<FieldSequenceEditorProps> = ({ fields, selectedKeys, orderedKeys, onSelectionChange, onMove, onReset }) => {
    const { token } = theme.useToken();
    const options = fields.map((field) => ({ label: field.label, value: field.key }));
    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>{_("Columns")}</span>
                {selectedKeys && selectedKeys.length > 0 && (
                    <Button size="small" onClick={onReset}>
                        {_("Reset to default")}
                    </Button>
                )}
            </div>
            <div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Select columns")}</div>
                <Checkbox.Group
                    value={selectedKeys || []}
                    onChange={(values) => onSelectionChange(values as string[])}
                    options={options}
                />
                {(!selectedKeys || selectedKeys.length === 0) && (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 6 }}>
                        Using default columns. Select fields to customize.
                    </div>
                )}
            </div>
            <div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>{_("Column order")}</div>
                {orderedKeys.length === 0 ? (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("No custom order yet.")}</div>
                ) : (
                    orderedKeys.map((key, index) => {
                        const field = fields.find((item) => item.key === key);
                        if (!field) return null;
                        return (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <div style={{ flex: 1 }}>{field.label}</div>
                                <Tooltip title={_("Move left")}>
                                    <Button size="small" icon={<ArrowLeftOutlined />} disabled={index === 0} onClick={() => onMove(key, "left")} />
                                </Tooltip>
                                <Tooltip title={_("Move right")}>
                                    <Button size="small" icon={<ArrowRightOutlined />} disabled={index === orderedKeys.length - 1} onClick={() => onMove(key, "right")} />
                                </Tooltip>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
};

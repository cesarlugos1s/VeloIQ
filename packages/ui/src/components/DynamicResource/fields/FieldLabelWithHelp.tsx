/**
 * The label of a field in a record form (show/edit pages and Sections Grid
 * cells): its label, the required mark, and — when the field has a
 * description — an info icon whose tooltip shows that description, translated.
 * One component, so every record form shows field help the same way.
 */
import React from "react";
import { Tooltip, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { FieldDef } from "../types";

const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? translate(text) : text;
};

export const FieldLabelWithHelp: React.FC<{ field: FieldDef }> = ({ field }) => {
    const { token } = theme.useToken();
    return (
        <>
            {field.label}
            {field.required ? <span style={{ color: token.colorError, marginLeft: 3 }}>*</span> : null}
            {field.description ? (
                <Tooltip title={_(field.description)}>
                    <InfoCircleOutlined
                        className="jm-field-help"
                        aria-label={_(field.description)}
                        style={{ color: token.colorTextTertiary, fontSize: 12, marginLeft: 4, cursor: "help" }}
                    />
                </Tooltip>
            ) : null}
        </>
    );
};

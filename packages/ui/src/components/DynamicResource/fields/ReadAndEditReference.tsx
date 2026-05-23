import React, { useState } from "react";
import { Button, Form, Tooltip } from "antd";
import { EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import type { FieldDef, ModelDef } from "../types";
import { resolveResourcePath } from "../utils/model";
import { ReferenceField } from "./ReferenceField";
import { RelationSelect } from "./RelationSelect";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const ReadAndEditReference: React.FC<{
    value?: any;
    onChange?: (val: any) => void;
    field: FieldDef;
    allModels?: ModelDef[];
    model?: ModelDef;
    currentId?: string | number;
}> = ({ value, onChange, field, allModels, model, currentId }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<any>(undefined);
    const form = Form.useFormInstance();

    const resource = field.referencePath
        ? field.referencePath
        : field.reference
            ? resolveResourcePath(field.reference, allModels)
            : "";

    const modelResource = model ? resolveResourcePath(model.resource || model.name, allModels) : undefined;
    const isSelfRef = resource && modelResource && resource === modelResource;

    const handleEdit = () => {
        setDraft(value);
        setEditing(true);
    };

    const handleConfirm = () => {
        onChange?.(draft);
        if (form) form.setFieldValue(field.key, draft);
        setEditing(false);
    };

    const handleCancel = () => {
        setDraft(undefined);
        setEditing(false);
    };

    const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 4 };

    if (editing) {
        return (
            <div style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <RelationSelect
                        field={field}
                        value={draft}
                        onChange={setDraft}
                        allModels={allModels}
                        excludeId={isSelfRef ? currentId : undefined}
                    />
                </div>
                <Tooltip title={_("Confirm")}>
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleConfirm} />
                </Tooltip>
                <Tooltip title={_("Cancel")}>
                    <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
                </Tooltip>
            </div>
        );
    }

    if (!value) {
        return (
            <div style={row}>
                <span>-</span>
                <Tooltip title={_("Edit")}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} style={{ padding: "0 2px", height: "auto" }} />
                </Tooltip>
            </div>
        );
    }

    return (
        <div style={row}>
            <ReferenceField id={value} resource={resource} />
            <Tooltip title={_("Edit")}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} style={{ padding: "0 2px", height: "auto" }} />
            </Tooltip>
        </div>
    );
};

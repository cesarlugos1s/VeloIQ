import React, { useState } from "react";
import { Button, Form, Space } from "antd";
import { EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import type { FieldDef, ModelDef } from "../types";
import { resolveResourcePath } from "../utils/model";
import { ReferenceField } from "./ReferenceField";
import { RelationSelect } from "./RelationSelect";

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

    if (editing) {
        return (
            <Space size={4} style={{ width: "100%" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <RelationSelect
                        field={field}
                        value={draft}
                        onChange={setDraft}
                        allModels={allModels}
                        excludeId={isSelfRef ? currentId : undefined}
                    />
                </div>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleConfirm} />
                <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
            </Space>
        );
    }

    if (!value) {
        return (
            <Space size={4}>
                <span style={{ color: "inherit" }}>-</span>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} style={{ padding: "0 2px", height: "auto" }} />
            </Space>
        );
    }

    return (
        <Space size={4}>
            <ReferenceField id={value} resource={resource} />
            <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} style={{ padding: "0 2px", height: "auto" }} />
        </Space>
    );
};

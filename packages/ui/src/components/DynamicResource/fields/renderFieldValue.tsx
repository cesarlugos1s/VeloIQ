import React from "react";
import { Input } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, resolveResourcePath } from "../utils/model";
import { formatNumberValue, formatDateValue, formatDateTimeValue, formatTimeValue } from "../utils/formatting";
import { renderOptionTag } from "../utils/colors";
import { ReferenceField } from "./ReferenceField";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const renderFieldValue = (field: FieldDef, record: any, allModels?: ModelDef[]) => {
    const isNlSentenceField = field.key === "nl_sentence" || field.key === "nl_asks_sentence";
    if (isNlSentenceField) {
        const value = record?.[field.key];
        return (
            <Input.TextArea
                value={value === null || value === undefined ? "" : String(value)}
                autoSize={{ minRows: 3, maxRows: 18 }}
                style={{ resize: "vertical", background: "#f3f6f9" }}
                placeholder={_(field.key)}
                readOnly
            />
        );
    }
    if (field.type === "boolean") {
        return record?.[field.key]
            ? <CheckCircleOutlined style={{ color: "green", fontSize: "1.2em" }} />
            : <CloseCircleOutlined style={{ color: "red", fontSize: "1.2em" }} />;
    }
    if (field.reference && record?.[field.key] && hasReferenceModel(field.reference, allModels)) {
        return <ReferenceField id={record[field.key]} resource={resolveResourcePath(field.referencePath || field.reference, allModels)} />;
    }
    if (field.type === "number") {
        return formatNumberValue(record?.[field.key]) ?? "-";
    }
    if (field.type === "date") {
        return formatDateValue(record?.[field.key]) ?? "-";
    }
    if (field.type === "datetime") {
        return formatDateTimeValue(record?.[field.key]) ?? "-";
    }
    if (field.type === "time") {
        return formatTimeValue(record?.[field.key]);
    }
    if (field.options && record?.[field.key] !== undefined && record?.[field.key] !== null) {
        return renderOptionTag(field, record[field.key]);
    }
    return record?.[field.key] ?? "-";
};

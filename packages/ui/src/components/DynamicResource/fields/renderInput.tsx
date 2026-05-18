import React from "react";
import { Input, Select, Checkbox, DatePicker, InputNumber, TimePicker } from "antd";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, isFileModel, resolveResourcePath } from "../utils/model";
import { applyRelationFieldOverrides } from "../utils/viewConfig";
import { RelationSelect } from "./RelationSelect";
import { FileUploadInput } from "./FileUploadInput";
import { AsyncSelectInput } from "./AsyncSelectInput";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const renderInput = (field: FieldDef, allModels?: ModelDef[], model?: ModelDef, currentId?: string | number) => {
    const resolvedField = model && allModels
        ? applyRelationFieldOverrides(model, allModels).find((item) => item.key === field.key) || field
        : field;
    if (resolvedField.key === "data" && isFileModel(model)) {
        return <FileUploadInput />;
    }
    const isNlSentenceField = resolvedField.key === "nl_sentence" || resolvedField.key === "nl_asks_sentence";
    const sentenceFieldHelper = _(resolvedField.key);
    if (isNlSentenceField) {
        return (
            <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 18 }}
                style={{ resize: "vertical", background: "#f3f6f9" }}
                placeholder={sentenceFieldHelper}
            />
        );
    }
    if (resolvedField.readOnly) {
        return <Input disabled />;
    }
    if (resolvedField.reference && hasReferenceModel(resolvedField.reference, allModels)) {
        const refResource = resolveResourcePath(resolvedField.reference, allModels);
        const modelResource = model ? resolveResourcePath(model.resource || model.name, allModels) : undefined;
        const isSelfRef = refResource && modelResource && refResource === modelResource;
        return <RelationSelect field={resolvedField} allModels={allModels} excludeId={isSelfRef ? currentId : undefined} />;
    }
    if (resolvedField.optionsUrl) return <AsyncSelectInput optionsUrl={resolvedField.optionsUrl} placeholder={`${_("Select")} ${_(resolvedField.label)}...`} />;
    if (resolvedField.options) return <Select options={resolvedField.options} style={{ width: "100%" }} placeholder={`Select ${resolvedField.label}...`} allowClear />;
    switch (resolvedField.type) {
        case "boolean": return <Checkbox />;
        case "date": return <DatePicker style={{ width: "100%" }} placeholder={_("Select date")} />;
        case "datetime": return <DatePicker showTime style={{ width: "100%" }} placeholder={_("Select date and time")} />;
        case "time": return <TimePicker style={{ width: "100%" }} />;
        case "number": return <InputNumber style={{ width: "100%" }} />;
        default: return <Input />;
    }
};

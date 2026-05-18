import React, { useContext, useMemo } from "react";
import { Card } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useModelTone } from "../../../utils/modelTone";
import type { ModelDef } from "../types";
import { PrimaryShowContext } from "../types";
import { getRecordDisplayLabel, resolveResourcePath } from "../utils/model";
import { getShowHref } from "../utils/navigation";

export const RelatedObjectPrimaryCard: React.FC<{
    record: any;
    model: ModelDef;
    allModels?: ModelDef[];
    customPageName?: string;
}> = ({ record, model, allModels, customPageName }) => {
    const allModelsList = useMemo(() => allModels || [], [allModels]);
    const tone = useModelTone(model);
    const PrimaryShowRenderer = useContext(PrimaryShowContext);
    const label = getRecordDisplayLabel(record);
    const id = record?.eid ?? record?.id;
    const resource = resolveResourcePath(model.resource || model.name, allModelsList);
    const showHref = id !== undefined && id !== null ? getShowHref(resource, id, allModelsList) : undefined;
    const viewQuery = customPageName ? `?view=${encodeURIComponent(customPageName)}` : "";
    const embeddedSrc = id !== undefined && id !== null ? `/embedded/${resource}/show/${id}${viewQuery}` : undefined;

    const bodyContent = PrimaryShowRenderer && id !== undefined && id !== null
        ? <PrimaryShowRenderer model={model} id={id} allModels={allModelsList} viewName={customPageName} />
        : embeddedSrc
            ? <iframe title={label} src={embeddedSrc} style={{ width: "100%", minHeight: 480, border: "none", display: "block" }} />
            : null;

    return (
        <Card
            size="small"
            title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{label}</span>
                    {showHref && (
                        <a href={showHref} style={{ fontSize: 12, color: tone.solid }}>
                            <EyeOutlined />
                        </a>
                    )}
                </span>
            }
            variant="borderless"
            style={{ marginBottom: 12, boxShadow: `0 8px 20px -16px ${tone.shadow}` }}
            styles={{ header: { background: "transparent", color: tone.text }, body: { padding: 0 } }}
        >
            {bodyContent}
        </Card>
    );
};

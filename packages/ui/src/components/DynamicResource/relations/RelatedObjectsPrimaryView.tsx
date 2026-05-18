import React from "react";
import { Spin, Alert, Empty } from "antd";
import type { ModelDef, RelationDef } from "../types";
import { getRecordDisplayLabel } from "../utils/model";
import { useRelatedGalleryRecords } from "./hooks";
import { RelatedObjectPrimaryCard } from "./RelatedObjectPrimaryCard";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsPrimaryView: React.FC<{
    rel: RelationDef;
    record: any;
    model: ModelDef;
    allModels?: ModelDef[];
    customPageName?: string;
}> = ({ rel, record, model, allModels, customPageName }) => {
    const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!records.length) return <Empty description={_("No related objects.")} />;

    return (
        <div style={{ display: "grid", gap: 8 }}>
            {records.map((item) => {
                const id = item?.eid ?? item?.id;
                return (
                    <RelatedObjectPrimaryCard
                        key={id ?? getRecordDisplayLabel(item)}
                        record={item}
                        model={model}
                        allModels={allModels}
                        customPageName={customPageName}
                    />
                );
            })}
        </div>
    );
};

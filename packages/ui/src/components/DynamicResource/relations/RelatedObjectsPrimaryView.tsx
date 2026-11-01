import React from "react";
import { Spin, Alert, Empty } from "antd";
import type { ModelDef, RelationDef } from "../types";
import { getRecordDisplayLabel } from "../utils/model";
import { useRelatedGalleryRecords } from "./hooks";
import { RelatedObjectPrimaryCard } from "./RelatedObjectPrimaryCard";
import { PrimaryCarouselLayout } from "../PrimaryCarouselLayout";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsPrimaryView: React.FC<{
    rel: RelationDef;
    record: any;
    model: ModelDef;
    allModels?: ModelDef[];
    customPageName?: string;
    /** "scroll" stacks the records' cards (default); "carousel" shows one at a time. */
    layout?: "scroll" | "carousel";
}> = ({ rel, record, model, allModels, customPageName, layout = "scroll" }) => {
    const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!records.length) return <Empty description={_("No related objects.")} />;

    if (layout === "carousel") {
        return <PrimaryCarouselLayout records={records} model={model} allModels={allModels} customPageName={customPageName} />;
    }

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

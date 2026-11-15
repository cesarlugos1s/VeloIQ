/**
 * Map view of the records related to a record through a many-to-many relation.
 *
 * Loads the related records the same way the related calendar and gallery do, then hands them
 * to the shared MapView. One-to-many relations show the map through the standard list page.
 */
import React from "react";
import { Alert, Empty, Spin } from "antd";
import type { ModelDef, RelationDef } from "../types";
import { MapView } from "../MapView";
import { translateText } from "../utils/i18n";
import { DEFAULT_ANALYZE_SERVER_AGGREGATION_THRESHOLD, useViewSettings } from "../utils/viewConfig";
import { useRelatedGalleryRecords } from "./hooks";

// Resolved at call time — see utils/i18n.ts's translateText for why.
const _ = (text: string): string => translateText(text, text);

export const RelatedObjectsMap: React.FC<{
    rel: RelationDef;
    record: any;
    relatedModel: ModelDef;
    allModels?: ModelDef[];
}> = ({ rel, record, relatedModel, allModels }) => {
    const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
    const { settings: viewSettings } = useViewSettings();

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!records.length) return <Empty description={_("No related records available.")} />;
    return (
        <MapView
            model={relatedModel}
            allModels={allModels}
            records={records}
            tileUrl={viewSettings?.mapTileUrl}
            tileAttribution={viewSettings?.mapTileAttribution}
            aggregationThreshold={viewSettings?.analyzeServerAggregationThreshold ?? DEFAULT_ANALYZE_SERVER_AGGREGATION_THRESHOLD}
        />
    );
};

import React from "react";
import { Spin, Alert, theme } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useApiUrl, useGo } from "@refinedev/core";
import type { ModelDef, RelationDef } from "../types";
import { resolveResourcePath } from "../utils/model";
import { useViewSettings } from "../utils/viewConfig";
import { getGalleryItemId, getGalleryItemLabel, renderSharedGalleryCard } from "../utils/gallery";
import { useRelatedGalleryRecords } from "./hooks";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsGallery: React.FC<{
    rel: RelationDef;
    record: any;
    relatedModel: ModelDef;
    allModels?: ModelDef[];
}> = ({ rel, record, relatedModel, allModels }) => {
    const apiUrl = useApiUrl();
    const go = useGo();
    const paneNav = usePaneNavigation();
    const { token } = theme.useToken();
    const { settings: viewSettings } = useViewSettings();
    const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
    const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const imageWidth = viewSettings?.galleryImageWidth ?? 180;
    const imageHeight = viewSettings?.galleryImageHeight ?? 140;

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!records.length) return <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#bfbfbf", fontSize: 12 }}><FileTextOutlined style={{ fontSize: 16 }} />{_("No images available")}</div>;

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {records.map((item) => {
                const id = getGalleryItemId(item);
                const label = getGalleryItemLabel(item, id);
                return renderSharedGalleryCard({
                    item,
                    itemId: id,
                    label,
                    apiUrl,
                    imageWidth,
                    imageHeight,
                    borderColor: token.colorBorder,
                    textColor: token.colorText,
                    onClick: id !== undefined && id !== null
                        ? () => {
                            if (paneNav?.isInMultiPane) {
                                paneNav.openDetail(resource, id);
                            } else {
                                go({ to: { resource, action: "show", id } });
                            }
                        }
                        : undefined,
                });
            })}
        </div>
    );
};

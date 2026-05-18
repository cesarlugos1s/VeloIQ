import React from "react";
import { FileTextOutlined } from "@ant-design/icons";

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tif", "tiff"]);

export const isImageRecord = (record: any) => {
    // Direct URL fields (avatar_url, image_url, photo_url) always qualify.
    if (record?.avatar_url || record?.image_url || record?.photo_url) return true;
    const format = String(record?.data_format || "").toLowerCase();
    if (format.startsWith("image/")) return true;
    const name = String(record?.data_name || "");
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
    return false;
};

export const recordHasData = (record: any) => {
    if (record?.data_present === false) return false;
    if (record?.data_size !== undefined && record?.data_size !== null) {
        const size = Number(record.data_size);
        return Number.isFinite(size) ? size > 0 : true;
    }
    return true;
};

export const getGalleryItemId = (record: any, fallbackId?: any) => record?.eid ?? record?.id ?? fallbackId;

export const getGalleryItemLabel = (record: any, fallbackId?: any) => {
    const fileId = fallbackId ?? "";
    return record?.title || record?.name || record?.data_name || record?._label || `File ${fileId}`;
};

export const getGalleryItemContentUrl = (apiUrl: string, record: any, id: any) => {
    // Prefer a direct image URL field before falling back to file storage.
    const directUrl = record?.avatar_url || record?.image_url || record?.photo_url;
    if (directUrl && typeof directUrl === "string") return directUrl;
    const hasData = recordHasData(record);
    const isImage = isImageRecord(record) && hasData;
    if (!isImage || !id) return "";
    return `${apiUrl}/file/${id}/content`;
};

export const renderSharedGalleryCard = ({
    item,
    itemId,
    label,
    apiUrl,
    imageWidth,
    imageHeight,
    borderColor,
    textColor,
    onClick,
}: {
    item: any;
    itemId: any;
    label: string;
    apiUrl: string;
    imageWidth: number;
    imageHeight: number;
    borderColor: string;
    textColor: string;
    onClick?: () => void;
}) => {
    const contentUrl = getGalleryItemContentUrl(apiUrl, item, itemId);
    const imageStyle: React.CSSProperties = {
        width: imageWidth,
        height: imageHeight,
        objectFit: "cover",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: "#f5f5f5",
    };
    return (
        <div
            key={itemId ?? label}
            style={{ width: imageWidth, display: "grid", gap: 6, cursor: onClick ? "pointer" : "default" }}
            onClick={onClick}
        >
            {contentUrl ? (
                <img src={contentUrl} alt={label} style={imageStyle} />
            ) : (
                <div style={{ ...imageStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#8c8c8c" }}>
                    <FileTextOutlined style={{ fontSize: 24 }} />
                </div>
            )}
            <div style={{ fontSize: 12, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
            </div>
        </div>
    );
};

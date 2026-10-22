import React from "react";
import { Button, Typography, theme } from "antd";
import * as AntDIcons from "@ant-design/icons";
import { CollapsibleBanner } from "./CollapsibleBanner";
import type { BannerPayload, BannerPosition, ContentRect } from "./types";

const { Text } = Typography;

// i18n helper — resolved at CALL time so window._ is always available.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? t(text) : text;
};

/** The Ant Design icon named *name*, or a bell when there is no such icon. */
export const bannerIcon = (name: string): React.ReactNode => {
    const registry = AntDIcons as unknown as Record<string, React.ComponentType>;
    const Icon = registry[name] ?? AntDIcons.NotificationOutlined;
    return <Icon />;
};

/** A row value as text: lists joined, objects and empty values left out. */
const cellText = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(", ");
    if (typeof value === "object") return "";
    return String(value);
};

export interface ModelBannerProps {
    banner: BannerPayload;
    /** The banner's current position (its configured one, or where the user moved it). */
    position: BannerPosition;
    contentRect: ContentRect;
    onMove?: (position: BannerPosition) => void;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    /** Opens a row's record; rows are clickable only when this is given and the banner has a row resource. */
    onOpenRow?: (resource: string, eid: number | string) => void;
    /** Opens the full list; the "View all" link shows only when this is given and the banner has a list resource. */
    onViewAll?: (resource: string) => void;
}

/**
 * ModelBanner — a CollapsibleBanner drawn from a banner of ``banners.json``.
 *
 * Collapsed, it shows its icon with the row count and/or title (the banner's
 * ``collapsed_content``). Expanded, it lists the rows of its model, named
 * query or ORM query: the first column as the row's text and the other
 * columns after it, each row opening its record when the banner names a row
 * resource, and a "View all" link to the list.
 */
export const ModelBanner: React.FC<ModelBannerProps> = ({
    banner, position, contentRect, onMove, expanded, onExpandedChange, onOpenRow, onViewAll,
}) => {
    const { token } = theme.useToken();
    const title = _(banner.title || "");
    const [mainColumn, ...otherColumns] = banner.columns;

    const collapsedContent = {
        count: String(banner.count),
        title,
        title_and_count: `${title} (${banner.count})`,
        icon: null,
    }[banner.collapsed_content] ?? String(banner.count);

    const rowResource = banner.row_resource;
    const viewAllResource = banner.view_all_resource;

    return (
        <CollapsibleBanner
            bannerKey={banner.key}
            title={title || `${banner.count}`}
            icon={bannerIcon(banner.icon)}
            tone={banner.tone}
            collapsedContent={collapsedContent}
            headerExtra={<span style={{ fontWeight: 400 }}>({banner.count} {_("total")})</span>}
            position={position}
            contentRect={contentRect}
            collapsedSize={banner.collapsed}
            expandedSize={banner.expanded}
            movable={banner.movable}
            onMove={onMove}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            footer={viewAllResource && onViewAll ? (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onViewAll(viewAllResource)}>
                    {_("View all")}
                </Button>
            ) : undefined}
        >
            {banner.rows.map((row, i) => {
                const clickable = Boolean(rowResource && onOpenRow && row.eid !== null && row.eid !== undefined);
                const content = (
                    <>
                        <Text style={{ flex: 1, minWidth: 0 }}>{mainColumn ? cellText(row[mainColumn.key]) : ""}</Text>
                        {otherColumns.map((column) => {
                            const text = cellText(row[column.key]);
                            return text ? (
                                <Text key={column.key} type="secondary" style={{ whiteSpace: "nowrap" }}>
                                    {_(column.label)}: {text}
                                </Text>
                            ) : null;
                        })}
                    </>
                );
                const rowStyle: React.CSSProperties = {
                    display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "6px 0", width: "100%",
                    borderTop: i > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                };
                return clickable ? (
                    <button
                        key={`${row.eid}-${i}`}
                        type="button"
                        onClick={() => onOpenRow!(rowResource!, row.eid)}
                        style={{ ...rowStyle, background: "none", border: "none", borderTop: rowStyle.borderTop, textAlign: "left", cursor: "pointer", font: "inherit" }}
                    >
                        {content}
                    </button>
                ) : (
                    <div key={`${row.eid ?? ""}-${i}`} style={rowStyle}>{content}</div>
                );
            })}
            {banner.count > banner.rows.length && (
                <Text type="secondary" style={{ display: "block", padding: "6px 0" }}>
                    {banner.rows.length} / {banner.count}
                </Text>
            )}
        </CollapsibleBanner>
    );
};

export default ModelBanner;

import React, { useEffect, useState } from "react";
import { Button, Tooltip, Typography, theme } from "antd";
import {
    ArrowDownOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined,
    ArrowUpOutlined,
    CloseOutlined,
    ColumnWidthOutlined,
    VerticalAlignMiddleOutlined,
} from "@ant-design/icons";
import { bannerMoves, isCurrentPosition, percentSize } from "./layout";
import type { BannerMove } from "./layout";
import type { BannerPosition, BannerSizes, BannerTone, ContentRect } from "./types";

const { Text } = Typography;

// i18n helper — resolved at CALL time so window._ is always available.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? t(text) : text;
};

const MOVE_ICONS: Record<BannerMove["id"], React.ReactNode> = {
    left: <ArrowLeftOutlined />,
    center: <ColumnWidthOutlined />,
    right: <ArrowRightOutlined />,
    top: <ArrowUpOutlined />,
    middle: <VerticalAlignMiddleOutlined />,
    bottom: <ArrowDownOutlined />,
};

/** Background, border and text colours of a banner tone, from the active Ant Design theme. */
const useToneColors = (tone: BannerTone) => {
    const { token } = theme.useToken();
    const tones: Record<BannerTone, { bg: string; border: string; accent: string; text: string }> = {
        neutral: { bg: token.colorBgElevated, border: token.colorBorder, accent: token.colorPrimary, text: token.colorText },
        info: { bg: token.colorInfoBg, border: token.colorInfoBorder, accent: token.colorInfo, text: token.colorInfoText },
        success: { bg: token.colorSuccessBg, border: token.colorSuccessBorder, accent: token.colorSuccess, text: token.colorSuccessText },
        warning: { bg: token.colorWarningBg, border: token.colorWarningBorder, accent: token.colorWarning, text: token.colorWarningText },
        error: { bg: token.colorErrorBg, border: token.colorErrorBorder, accent: token.colorError, text: token.colorErrorText },
    };
    return { ...(tones[tone] ?? tones.neutral), shadow: token.boxShadowSecondary };
};

export interface CollapsibleBannerProps {
    /** Shown in the expanded header and as the collapsed banner's accessible name. */
    title: string;
    icon: React.ReactNode;
    tone?: BannerTone;
    /** What the collapsed banner shows after its icon (e.g. a count); nothing for an icon-only banner. */
    collapsedContent?: React.ReactNode;
    /** Extra text after the title in the expanded header (e.g. "(12)"). */
    headerExtra?: React.ReactNode;
    /** Body of the expanded banner. */
    children: React.ReactNode;
    /** Shown under the body of the expanded banner (e.g. a "View all" link). */
    footer?: React.ReactNode;
    position: BannerPosition;
    /** The content area the percentage sizes are relative to. */
    contentRect: ContentRect;
    collapsedSize: BannerSizes;
    expandedSize: BannerSizes;
    /** Show the arrows that move the banner to another edge (on hover, and while expanded). */
    movable?: boolean;
    onMove?: (position: BannerPosition) => void;
    /** Controlled expanded state; leave out for the banner to manage it itself. */
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    /** Identifies the banner in the DOM (``data-banner-key``). */
    bannerKey?: string;
}

/**
 * CollapsibleBanner — a small badge that expands into a panel when clicked.
 *
 * It only draws the banner; where it sits is set by its parent (see
 * ``BannerHost``, which places banners at their anchor of the content area and
 * stacks those sharing an anchor). The expanded panel opens towards the inside
 * of the page: above the badge for a bottom banner, below it otherwise. Esc or
 * the close button collapses it.
 */
export const CollapsibleBanner: React.FC<CollapsibleBannerProps> = ({
    title,
    icon,
    tone = "neutral",
    collapsedContent,
    headerExtra,
    children,
    footer,
    position,
    contentRect,
    collapsedSize,
    expandedSize,
    movable = true,
    onMove,
    expanded,
    onExpandedChange,
    bannerKey,
}) => {
    const colors = useToneColors(tone);
    const [ownExpanded, setOwnExpanded] = useState(false);
    const [hovered, setHovered] = useState(false);
    const open = expanded ?? ownExpanded;
    const setOpen = (next: boolean) => {
        if (expanded === undefined) setOwnExpanded(next);
        onExpandedChange?.(next);
    };

    // Esc collapses the expanded panel.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const collapsedPx = percentSize(collapsedSize, contentRect);
    const expandedPx = percentSize(expandedSize, contentRect);
    const alignItems = position.horizontal === "left" ? "flex-start" : position.horizontal === "right" ? "flex-end" : "center";

    const arrows = movable && onMove && (open || hovered) ? (
        <div style={{ display: "inline-flex", gap: 2 }} role="toolbar" aria-label={_("Move banner")}>
            {bannerMoves(_).map((move) => (
                <Tooltip key={move.id} title={move.label}>
                    <Button
                        type="text"
                        size="small"
                        icon={MOVE_ICONS[move.id]}
                        aria-label={move.label}
                        disabled={isCurrentPosition(move, position)}
                        onClick={(e) => { e.stopPropagation(); onMove(move.to(position)); }}
                    />
                </Tooltip>
            ))}
        </div>
    ) : null;

    const panel = open ? (
        <div
            role="dialog"
            aria-label={title}
            style={{
                width: "max-content",
                minWidth: Math.min(320, expandedPx.maxWidth),
                maxWidth: expandedPx.maxWidth,
                maxHeight: expandedPx.maxHeight,
                // Shrinks with the group when banners stacked at the same anchor need the room.
                minHeight: 0,
                flexShrink: 1,
                display: "flex",
                flexDirection: "column",
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderTop: `2px solid ${colors.accent}`,
                borderRadius: 8,
                boxShadow: colors.shadow,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", flexWrap: "wrap" }}>
                <span style={{ color: colors.accent }}>{icon}</span>
                <Text strong style={{ color: colors.text, flex: 1, minWidth: 0 }}>
                    {title} {headerExtra}
                </Text>
                {arrows}
                <Button type="text" size="small" icon={<CloseOutlined />} aria-label={_("Close")} title={_("Close")} onClick={() => setOpen(false)} />
            </div>
            <div style={{ overflowY: "auto", padding: "0 12px", minHeight: 0 }}>{children}</div>
            {footer && <div style={{ padding: "6px 12px", borderTop: `1px solid ${colors.border}` }}>{footer}</div>}
        </div>
    ) : null;

    const badge = (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexDirection: position.horizontal === "right" ? "row-reverse" : "row" }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={title}
                title={title}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    maxWidth: collapsedPx.maxWidth,
                    maxHeight: Math.max(collapsedPx.maxHeight, 24),
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    padding: "4px 12px",
                    background: colors.bg,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: 16,
                    boxShadow: colors.shadow,
                    color: colors.text,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                <span style={{ color: colors.accent, display: "inline-flex" }}>{icon}</span>
                {collapsedContent !== undefined && collapsedContent !== null && (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{collapsedContent}</span>
                )}
            </button>
            {!open && arrows && (
                <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12, boxShadow: colors.shadow }}>{arrows}</div>
            )}
        </div>
    );

    return (
        <div
            data-banner-key={bannerKey}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex",
                // The panel opens towards the inside of the page.
                flexDirection: position.vertical === "bottom" ? "column-reverse" : "column",
                alignItems,
                gap: 8,
                minHeight: 0,
                maxHeight: "100%",
                pointerEvents: "auto",
            }}
        >
            {badge}
            {panel}
        </div>
    );
};

export default CollapsibleBanner;

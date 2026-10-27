/**
 * Collapsible side panels for tool and builder pages (shared by the framework's extension packages).
 *
 * A collapsed panel leaves a narrow column: an expand arrow and the panel's name written
 * vertically. Whether a panel is collapsed is remembered in the browser.
 */
import React, { useState } from "react";
import { Button, Tooltip, Typography } from "antd";
import { DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";

// Resolved when called (not when the file loads), so the host's translations are always the current ones.
const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? (translate(text) as string) : text;
};

const { Text } = Typography;

export const COLLAPSED_SPINE_WIDTH = 34;

/** The column a collapsed side panel leaves: an expand button and the panel's name written vertically. */
export const CollapsedSpine: React.FC<{ title: string; side: "left" | "right"; token: any; onExpand: () => void }> =
    ({ title, side, token, onExpand }) => (
        <Tooltip title={`${_("Expand")}: ${title}`} placement={side === "left" ? "right" : "left"}>
            <div onClick={onExpand} role="button" style={{
                width: COLLAPSED_SPINE_WIDTH, flexShrink: 0, cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 10, padding: "10px 0", background: token.colorBgContainer,
                borderRight: side === "left" ? `1px solid ${token.colorBorderSecondary}` : undefined,
                borderLeft: side === "right" ? `1px solid ${token.colorBorderSecondary}` : undefined,
            }}>
                {side === "left" ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                <Text strong className="jm-panel-title" style={{ writingMode: "vertical-rl", whiteSpace: "nowrap", fontSize: 12 }}>{title}</Text>
            </div>
        </Tooltip>
    );

/** The bar above a section stacked vertically with another: its name and a button that minimizes it to just this bar. */
export const SectionBar: React.FC<{ title: string; minimized: boolean; token: any; onToggle: () => void }> =
    ({ title, minimized, token, onToggle }) => (
        <Tooltip title={minimized ? `${_("Expand")}: ${title}` : `${_("Minimize")}: ${title}`}>
            <div onClick={onToggle} role="button" style={{
                display: "flex", alignItems: "center", gap: 8, padding: "3px 12px", cursor: "pointer", flexShrink: 0,
                background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}>
                {minimized ? <DownOutlined style={{ fontSize: 11 }} /> : <UpOutlined style={{ fontSize: 11 }} />}
                <Text strong className="jm-panel-title" style={{ fontSize: 12 }}>{title}</Text>
            </div>
        </Tooltip>
    );

/** A true/false setting kept in the browser, so a collapsed panel stays collapsed. */
export function useRememberedFlag(storageKey: string): [boolean, (value: boolean) => void] {
    const [flag, setFlag] = useState<boolean>(() => {
        try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
    });
    const update = (value: boolean) => {
        setFlag(value);
        try { localStorage.setItem(storageKey, value ? "1" : "0"); } catch { /* the choice just is not remembered */ }
    };
    return [flag, update];
}

/** A thin box that groups related buttons or status indicators, so it takes as little room as possible. */
export const COMPACT_GROUP_PADDING = "2px 6px";

/**
 * A side panel that can be collapsed to a narrow column showing its name vertically.
 * Pass `fill` for a panel that takes the remaining width instead of a fixed one.
 */
export const CollapsibleSidePanel: React.FC<{
    title: string; side: "left" | "right"; token: any; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void;
    width?: number | string; fill?: boolean; padding?: number; children: React.ReactNode;
}> = ({ title, side, token, collapsed, onCollapsedChange, width, fill, padding = 8, children }) => {
    if (collapsed) return <CollapsedSpine title={title} side={side} token={token} onExpand={() => onCollapsedChange(false)} />;
    return (
        <div style={{
            ...(fill ? { flex: 1, minWidth: 0 } : { width, flexShrink: 0 }), display: "flex", flexDirection: "column",
            background: token.colorBgContainer, overflow: "auto",
            borderRight: side === "left" && !fill ? `1px solid ${token.colorBorderSecondary}` : undefined,
            borderLeft: side === "right" && !fill ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}>
            <div className="jm-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 2px 8px", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <span className="jm-panel-title" style={{ fontWeight: 500 }}>{title}</span>
                <Tooltip title={`${_("Collapse")}: ${title}`}>
                    <Button type="text" size="small" icon={side === "left" ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
                        onClick={() => onCollapsedChange(true)} />
                </Tooltip>
            </div>
            <div style={{ padding, flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
        </div>
    );
};

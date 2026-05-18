import React, { useCallback, useEffect, useState } from "react";
import { Button, Drawer, Tooltip, theme } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import type { GeneralActionsButtonPosition } from "./viewConfig";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const NARROW_BREAKPOINT = 768;

const useIsNarrow = (breakpoint: number = NARROW_BREAKPOINT) => {
    const [narrow, setNarrow] = useState<boolean>(() =>
        typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
    );
    useEffect(() => {
        const handler = () => setNarrow(window.innerWidth < breakpoint);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, [breakpoint]);
    return narrow;
};

export type ActionsButtonStackDirection = "row" | "column";

export const ActionsButtonStack: React.FC<{
    direction: ActionsButtonStackDirection;
    children: React.ReactNode;
}> = ({ direction, children }) => (
    <div
        style={{
            display: "flex",
            alignItems: direction === "column" ? "stretch" : "center",
            flexDirection: direction,
            gap: 8,
            flexWrap: direction === "row" ? "wrap" : "nowrap",
        }}
    >
        {children}
    </div>
);

export const VerticalActionsLayout: React.FC<{
    position: GeneralActionsButtonPosition;
    onBarMount: (el: HTMLDivElement | null) => void;
    children: React.ReactNode;
}> = ({ position, onBarMount, children }) => {
    const { token } = theme.useToken();
    const narrow = useIsNarrow();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const mountRef = useCallback(
        (el: HTMLDivElement | null) => onBarMount(el),
        [onBarMount],
    );

    const isVertical = position === "left" || position === "right";
    const stickyOffset = 80;
    const sideOffset = 16;
    const sideKey: "left" | "right" = position === "left" ? "left" : "right";
    const useDrawer = isVertical && narrow;
    const useFixedBar = isVertical && !narrow;
    const contentSidePadding = useFixedBar ? 72 : 0;

    return (
        <>
            {useFixedBar && (
                <div
                    ref={mountRef}
                    style={{
                        position: "fixed",
                        top: stickyOffset,
                        [sideKey]: sideOffset,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: 8,
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 8,
                        boxShadow: token.boxShadowTertiary,
                        zIndex: 5,
                    }}
                />
            )}
            {useDrawer && (
                <div
                    style={{
                        position: "fixed",
                        top: stickyOffset,
                        [sideKey]: sideOffset,
                        zIndex: 1001,
                    }}
                >
                    <Tooltip title={_("Actions")} placement={sideKey === "left" ? "right" : "left"}>
                        <Button
                            size="small"
                            icon={<MenuOutlined />}
                            onClick={() => setDrawerOpen(true)}
                        />
                    </Tooltip>
                </div>
            )}
            <div
                style={{
                    paddingLeft: sideKey === "left" ? contentSidePadding : 0,
                    paddingRight: sideKey === "right" ? contentSidePadding : 0,
                }}
            >
                {children}
            </div>
            {useDrawer && (
                <Drawer
                    title={_("Actions")}
                    placement={sideKey}
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    width={240}
                    forceRender
                >
                    <div
                        ref={mountRef}
                        style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    />
                </Drawer>
            )}
        </>
    );
};

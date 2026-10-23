/**
 * SingleItemCarousel — one item at a time, moved back and forth with edge
 * arrows (and, with ``arrowKeyNavigation``, the keyboard's arrow keys while it
 * has focus), with an "N / M" position badge.
 *
 * The one reusable carousel of the UI package, kept with the Dynamic Resource
 * view-type helpers (gallery, calendar, view configuration): the dashboard's
 * "fit cell" rows (FitCellCarousel's FitCellRow) and pages such as a portal's
 * swipe deck render their items through it. A plain CSS transform over a flex track
 * rather than a react-slick Carousel: showing "item N" needs only index
 * arithmetic, which avoids react-slick's slide-measurement issues when
 * carousels are nested.
 *
 * Controlled (``activeIndex`` + ``onActiveIndexChange``) or not. ``wrapAround``
 * (default true) goes from the last item to the first; without it the arrows
 * stop at the ends.
 */
import React, { useState } from "react";
import { Button, theme } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

export interface SingleItemCarouselProps<Item> {
    items: Item[];
    /** The key of an item (React list key). */
    getItemKey: (item: Item, index: number) => React.Key;
    /** Render an item; ``isActive`` is true for the item shown. */
    renderItem: (item: Item, index: number, isActive: boolean) => React.ReactNode;
    /** The item shown (controlled); omit to let the carousel keep it. */
    activeIndex?: number;
    /** Called with the index of the item to show (arrows, keyboard). */
    onActiveIndexChange?: (index: number) => void;
    /** Go from the last item to the first and back (default true). */
    wrapAround?: boolean;
    /** Fixed height of the carousel; omit to take the items' height. */
    height?: number;
    /** Padding around each item: pixels, or CSS shorthand such as "0 36px" (default 0). */
    itemPadding?: number | string;
    /** Where the "N / M" badge sits (default bottom-right). */
    positionBadgeCorner?: "top-right" | "bottom-right";
    /** Disable the arrows (e.g. while an item animates out). */
    navigationDisabled?: boolean;
    /** Move with the keyboard's left/right arrow keys while focused (default false: a
     *  surrounding carousel may already handle them, as the dashboard's does). */
    arrowKeyNavigation?: boolean;
}

/** An edge arrow of the carousel. */
const CarouselSideArrow: React.FC<{ direction: "left" | "right"; disabled: boolean; onClick: () => void }> = ({ direction, disabled, onClick }) => (
    <Button
        shape="circle"
        size="small"
        icon={direction === "left" ? <ArrowLeftOutlined /> : <ArrowRightOutlined />}
        aria-label={direction === "left" ? _("Previous") : _("Next")}
        disabled={disabled}
        onClick={onClick}
        style={{
            position: "absolute", zIndex: 20, top: "50%", transform: "translateY(-50%)",
            ...(direction === "left" ? { left: 4 } : { right: 4 }),
        }}
    />
);

/** The "N / M" position badge. */
export const CarouselPositionBadge: React.FC<{ corner: "top-right" | "bottom-right"; current: number; total: number }> = ({ corner, current, total }) => {
    const { token } = theme.useToken();
    const positionStyle: React.CSSProperties = corner === "top-right" ? { top: 6, right: 8 } : { bottom: 6, right: 8 };
    return (
        <div style={{
            position: "absolute",
            zIndex: 20,
            ...positionStyle,
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 10,
            background: token.colorBgElevated,
            color: token.colorTextSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
        }}>
            {current} / {total}
        </div>
    );
};

export function SingleItemCarousel<Item>({
    items, getItemKey, renderItem, activeIndex: controlledActiveIndex, onActiveIndexChange,
    wrapAround = true, height, itemPadding = 0, positionBadgeCorner = "bottom-right", navigationDisabled = false,
    arrowKeyNavigation = false,
}: SingleItemCarouselProps<Item>): React.ReactElement {
    const [ownActiveIndex, setOwnActiveIndex] = useState(0);
    const count = items.length;
    const requestedIndex = controlledActiveIndex ?? ownActiveIndex;
    const activeIndex = count === 0 ? 0 : Math.min(Math.max(requestedIndex, 0), count - 1);
    const hasMultipleItems = count > 1;

    const showIndex = (index: number) => {
        const next = wrapAround ? ((index % count) + count) % count : Math.min(Math.max(index, 0), count - 1);
        if (controlledActiveIndex === undefined) setOwnActiveIndex(next);
        onActiveIndexChange?.(next);
    };
    const canGoBack = hasMultipleItems && !navigationDisabled && (wrapAround || activeIndex > 0);
    const canGoForward = hasMultipleItems && !navigationDisabled && (wrapAround || activeIndex < count - 1);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowLeft" && canGoBack) { event.preventDefault(); showIndex(activeIndex - 1); }
        if (event.key === "ArrowRight" && canGoForward) { event.preventDefault(); showIndex(activeIndex + 1); }
    };

    return (
        <div tabIndex={arrowKeyNavigation && hasMultipleItems ? 0 : undefined}
            onKeyDown={arrowKeyNavigation ? handleKeyDown : undefined}
            style={{ position: "relative", height, overflow: "hidden", outline: "none" }}>
            {hasMultipleItems && (
                <>
                    <CarouselSideArrow direction="left" disabled={!canGoBack} onClick={() => showIndex(activeIndex - 1)} />
                    <CarouselSideArrow direction="right" disabled={!canGoForward} onClick={() => showIndex(activeIndex + 1)} />
                    <CarouselPositionBadge corner={positionBadgeCorner} current={activeIndex + 1} total={count} />
                </>
            )}
            <div style={{
                display: "flex",
                alignItems: height ? undefined : "flex-start",
                height,
                width: "100%",
                transform: `translateX(-${activeIndex * 100}%)`,
                transition: "transform 0.3s ease",
            }}>
                {items.map((item, index) => (
                    <div key={getItemKey(item, index)} style={{
                        // minWidth 0: a slide never grows past the carousel's width, whatever its content's
                        // minimum width, so moving by 100% always lands exactly on the next item.
                        flex: "0 0 100%", width: "100%", minWidth: 0, height, padding: itemPadding, boxSizing: "border-box",
                    }}>
                        {renderItem(item, index, index === activeIndex)}
                    </div>
                ))}
            </div>
        </div>
    );
}

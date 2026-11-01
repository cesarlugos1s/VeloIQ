/**
 * The carousel layout of the primary view (view type "primary-carousel").
 *
 * Shows the records of a list one at a time, each as the primary view's card
 * (the record's show page), moved with the carousel's arrows. Above it: a
 * searchable dropdown of the records (their titles) to jump to one; the
 * toolbar shows the position in the list, as "N / M". Search and
 * filters belong to the list page (or relation) that owns the records.
 *
 * A host's footer for the resource (registerPrimaryCarouselFooter) is shown
 * under each card.
 *
 * The dropdown and the full-page button form one toolbar row. With
 * `toolbarContainer` (an element in the list page's Filters bar) the toolbar is
 * drawn there, so the search, the dropdown and the button share one row.
 */
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Empty, Select, Tag, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useHref, useInRouterContext } from "react-router-dom";
import { SingleItemCarousel } from "./utils/singleItemCarousel";
import { RelatedObjectPrimaryCard } from "./relations/RelatedObjectPrimaryCard";
import { registeredPrimaryCarouselFooter } from "./primaryCarouselFooters";
import { getRecordDisplayLabel, resolveResourcePath } from "./utils/model";
import { getShowHref } from "./utils/navigation";
import type { ModelDef } from "./types";

const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/** Titles offered by the dropdown at a time; more are added when its list is scrolled to the end. */
const JUMP_OPTIONS_PAGE_SIZE = 50;

/** The button that opens a record's page in a new browser tab; the address includes the app's (or portal's) base path. */
const FullPageButton: React.FC<{ showPath: string }> = ({ showPath }) => {
    const href = useHref(showPath);
    return (
        <Tooltip title={_("View in full page")}>
            <Button icon={<EyeOutlined />} href={href} target="_blank" rel="noopener noreferrer" aria-label={_("View in full page")} />
        </Tooltip>
    );
};

/**
 * Tighter spacing for the record page inside the carousel (a deck page wants the whole record and its
 * buttons on one screen): less padding in the page's card, under the tabs and the form, around the title.
 */
const CAROUSEL_COMPACT_STYLE = `
.jm-primary-carousel .ant-page-header-heading-left { margin: 0; }
.jm-primary-carousel .ant-page-header-content { padding-top: 4px; }
.jm-primary-carousel .ant-page-header-content > .ant-spin-nested-loading .ant-spin-container > .ant-card > .ant-card-body { padding: 4px 12px; }
.jm-primary-carousel .ant-tabs-nav { margin-bottom: 4px; }
.jm-primary-carousel .ant-tabs-tabpane-active > .ant-form { padding-bottom: 0 !important; }
.jm-primary-carousel .ant-tabs-tabpane-active > .ant-form > div:empty { display: none; }
`;

const recordId = (record: any): string | number => record?.eid ?? record?.id;

export const PrimaryCarouselLayout: React.FC<{
    records: any[];
    model: ModelDef;
    allModels?: ModelDef[];
    customPageName?: string;
    /** Height of the carousel (pixels or any CSS length); a card taller than it scrolls inside. Omitted: as tall as the record shown. */
    height?: number | string;
    /** Element to draw the toolbar (dropdown and full-page button) in; omitted: above the carousel. */
    toolbarContainer?: HTMLElement | null;
}> = ({ records, model, allModels, customPageName, height, toolbarContainer }) => {
    const inRouter = useInRouterContext();
    const [removedIds, setRemovedIds] = useState<Set<string | number>>(new Set());
    const [activeIndex, setActiveIndex] = useState(0);
    const [jumpSearch, setJumpSearch] = useState("");
    const [jumpOptionsShown, setJumpOptionsShown] = useState(JUMP_OPTIONS_PAGE_SIZE);

    const shownRecords = useMemo(() => records.filter((record) => !removedIds.has(recordId(record))), [records, removedIds]);
    const Footer = registeredPrimaryCarouselFooter(model.resource || model.name);

    const jumpOptions = useMemo(() => {
        const wanted = jumpSearch.trim().toLowerCase();
        return shownRecords
            .map((record, index) => ({ value: index, label: getRecordDisplayLabel(record) }))
            .filter((option) => !wanted || String(option.label).toLowerCase().includes(wanted));
    }, [shownRecords, jumpSearch]);

    if (shownRecords.length === 0) return <Empty description={_("No records available")} />;

    const currentIndex = Math.min(activeIndex, shownRecords.length - 1);
    const currentRecordId = recordId(shownRecords[currentIndex]);
    const currentShowHref = currentRecordId !== undefined && currentRecordId !== null
        ? getShowHref(resolveResourcePath(model.resource || model.name, allModels || []), currentRecordId, allModels || [])
        : undefined;

    const toolbar = (
            <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
            <Select
                showSearch
                filterOption={false}
                value={currentIndex}
                options={jumpOptions.slice(0, jumpOptionsShown)}
                onSearch={(text) => { setJumpSearch(text); setJumpOptionsShown(JUMP_OPTIONS_PAGE_SIZE); }}
                onPopupScroll={(event) => {
                    const list = event.currentTarget;
                    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 8) setJumpOptionsShown((shown) => shown + JUMP_OPTIONS_PAGE_SIZE);
                }}
                onChange={(index: number) => setActiveIndex(index)}
                onOpenChange={(open) => { if (!open) setJumpSearch(""); }}
                placeholder={_("Go to…")}
                style={{ flex: 1 }}
            />
            <Tag style={{ margin: 0, alignSelf: "center", whiteSpace: "nowrap" }}>{currentIndex + 1} / {shownRecords.length}</Tag>
            {currentShowHref && inRouter && <FullPageButton showPath={currentShowHref} />}
            </div>
    );

    return (
        <div className="jm-primary-carousel" style={{ display: "flex", flexDirection: "column", gap: 8, height }}>
            <style>{CAROUSEL_COMPACT_STYLE}</style>
            {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
            <div style={{ flex: height === undefined ? undefined : 1, minHeight: 0 }}>
                <SingleItemCarousel
                    items={shownRecords}
                    getItemKey={(record, index) => recordId(record) ?? index}
                    activeIndex={currentIndex}
                    onActiveIndexChange={setActiveIndex}
                    wrapAround={false}
                    arrowKeyNavigation
                    showPositionBadge={false}
                    height={height === undefined ? undefined : "100%"}
                    itemPadding="0 36px"
                    renderItem={(record, _index, isActive) => !isActive ? null : (
                        <div style={height === undefined ? undefined : { height: "100%", overflow: "auto" }}>
                            <RelatedObjectPrimaryCard
                                record={record}
                                model={model}
                                allModels={allModels}
                                customPageName={customPageName}
                                showHeader={false}
                                marginBottom={0}
                                footer={Footer ? (
                                    <Footer
                                        record={record}
                                        removeRecord={() => setRemovedIds((removed) => new Set(removed).add(recordId(record)))}
                                    />
                                ) : undefined}
                            />
                        </div>
                    )}
                />
            </div>
        </div>
    );
};

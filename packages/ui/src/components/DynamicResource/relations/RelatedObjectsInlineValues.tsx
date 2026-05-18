import React, { useCallback, useState } from "react";
import { Spin, Alert, Pagination, theme } from "antd";
import { useGo } from "@refinedev/core";
import type { ModelDef, RelationDef } from "../types";
import { getShowHref, shouldHandleLinkClick } from "../utils/navigation";
import { INLINE_DEFAULT_PAGE_SIZE, INLINE_PAGE_SIZE_OPTIONS, useRelatedInlineItems } from "./hooks";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";

export const RelatedObjectsInlineValues: React.FC<{
    rel: RelationDef;
    record: any;
    viewType: "list" | "csv";
    allowedRelatedIds?: Set<string | number>;
    allModels?: ModelDef[];
}> = ({ rel, record, viewType, allowedRelatedIds, allModels }) => {
    const go = useGo();
    const paneNav = usePaneNavigation();
    const { token } = theme.useToken();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(INLINE_DEFAULT_PAGE_SIZE);
    const { items, loading, error, total } = useRelatedInlineItems({ rel, record, allowedRelatedIds, allModels, page, pageSize });

    const handlePageChange = useCallback((newPage: number, newPageSize?: number) => {
        if (newPageSize && newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setPage(1);
        } else {
            setPage(newPage);
        }
    }, [pageSize]);

    const renderItem = (item: { id: any; label: string; resource: string }) => (
        <a
            href={getShowHref(item.resource, item.id, allModels)}
            onClick={(e) => {
                if (!shouldHandleLinkClick(e)) return;
                e.preventDefault();
                if (item.resource && item.id !== undefined && item.id !== null) {
                    if (paneNav?.isInMultiPane) {
                        paneNav.openDetail(item.resource, item.id);
                    } else {
                        go({ to: { resource: item.resource, action: "show", id: item.id } });
                    }
                }
            }}
            style={{ cursor: "pointer", color: token.colorLink, textDecoration: "none" }}
        >
            {item.label}
        </a>
    );

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!items.length && total === 0) return <span>-</span>;

    const paginationProps = total > pageSize ? {
        size: "small" as const,
        current: page,
        pageSize,
        total,
        hideOnSinglePage: true,
        showSizeChanger: true,
        pageSizeOptions: INLINE_PAGE_SIZE_OPTIONS,
        onChange: handlePageChange,
        onShowSizeChange: handlePageChange,
        style: { marginTop: 4 },
    } : undefined;

    if (viewType === "csv") {
        return (
            <span>
                {items.map((item, index) => (
                    <span key={`${item.resource}-${item.id}-${index}`}>
                        {renderItem(item)}
                        {index < items.length - 1 ? ", " : ""}
                    </span>
                ))}
                {paginationProps && <Pagination {...(paginationProps as any)} />}
            </span>
        );
    }

    return (
        <>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
                {items.map((item, index) => (
                    <li key={`${item.resource}-${item.id}-${index}`}>{renderItem(item)}</li>
                ))}
            </ul>
            {paginationProps && <Pagination {...(paginationProps as any)} />}
        </>
    );
};

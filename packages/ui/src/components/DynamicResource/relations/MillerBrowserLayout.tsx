import React, { useEffect, useRef, useState } from "react";
import { Button, Drawer, Empty, Grid, Spin, Tooltip, Typography, theme } from "antd";
import { FileOutlined, FolderOutlined, LinkOutlined, RightOutlined } from "@ant-design/icons";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, RelationDef } from "../types";
import { resolveResourcePath, resolveModelName, getRecordDisplayLabel } from "../utils/model";
import { getShowHref, shouldHandleLinkClick } from "../utils/navigation";
import { DynamicShow } from "../pages/DynamicShow";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

interface MillerItem {
    id: string | number;
    label: string;
    isBranch: boolean;
    resource: string;
    resourcePath: string;
}

interface DetailNode {
    id: string | number;
    label: string;
    resource: string;
    resourcePath: string;
}

interface ColumnDesc {
    parentId: string | number;
}

// ---------------------------------------------------------------------------
// Data-fetching hook — loads branch children (sub-hierarchies) and optional
// leaf children (e.g. Items) for a given parent node.
// ---------------------------------------------------------------------------
function useMillerColumnItems({
    parentId,
    rel,
    allModels,
    apiUrl,
}: {
    parentId: string | number;
    rel: RelationDef;
    allModels?: ModelDef[];
    apiUrl: string;
}) {
    const [branches, setBranches] = useState<MillerItem[]>([]);
    const [leaves, setLeaves] = useState<MillerItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!parentId || !rel.resourcePath || !rel.targetKey || !rel.otherKey || !rel.otherResource) {
            setBranches([]);
            setLeaves([]);
            return;
        }
        let isMounted = true;
        const controller = new AbortController();
        const { signal } = controller;

        const bulkRead = async (resourcePath: string, ids: Array<string | number>): Promise<any[]> => {
            if (ids.length === 0) return [];
            try {
                const res = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ resource: resourcePath, ids }),
                    signal,
                });
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data?.items) ? data.items : [];
            } catch {
                return [];
            }
        };

        const fetchPage = async (path: string, filterKey: string): Promise<any[]> => {
            const params = new URLSearchParams();
            params.set("_start", "0");
            params.set("_end", "500");
            params.append(filterKey, String(parentId));
            const res = await authenticatedFetch(`${apiUrl}/${path}?${params}`, { signal });
            if (!res.ok) return [];
            const rows = await res.json();
            return Array.isArray(rows) ? rows : [];
        };

        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                // --- Branches ---
                const branchLinkRows = await fetchPage(rel.resourcePath!, rel.targetKey);
                let branchItems: MillerItem[] = [];
                if (branchLinkRows.length > 0) {
                    const branchIds = Array.from(new Set(
                        branchLinkRows.map((r: any) => r[rel.otherKey!]).filter(Boolean)
                    ));
                    const branchResourcePath = rel.otherResourcePath || resolveResourcePath(rel.otherResource!, allModels);
                    const isSelfReferential = rel.resourcePath === branchResourcePath;
                    const branchRecords = isSelfReferential
                        ? branchLinkRows
                        : await bulkRead(branchResourcePath, branchIds);
                    const branchById = new Map(branchRecords.map((r: any) => [r.eid ?? r.id, r]));
                    branchItems = branchLinkRows
                        .map((linkRow: any) => {
                            const childId = linkRow[rel.otherKey!];
                            const rec = branchById.get(childId);
                            if (!rec) return null;
                            return {
                                id: rec.eid ?? rec.id ?? childId,
                                label: getRecordDisplayLabel(rec),
                                isBranch: true,
                                resource: resolveModelName(rel.otherResource!, allModels),
                                resourcePath: branchResourcePath,
                            } satisfies MillerItem;
                        })
                        .filter(Boolean) as MillerItem[];
                }

                // --- Leaves (optional) ---
                const leafConfigs = rel.millerLeafConfigs && rel.millerLeafConfigs.length > 0
                    ? rel.millerLeafConfigs
                    : (rel.millerLeafRelationPath && rel.millerLeafTargetKey && rel.millerLeafOtherKey && rel.millerLeafResource)
                        ? [{
                            relationPath: rel.millerLeafRelationPath,
                            targetKey: rel.millerLeafTargetKey,
                            otherKey: rel.millerLeafOtherKey,
                            resource: rel.millerLeafResource,
                            resourcePath: rel.millerLeafResourcePath,
                        }]
                        : [];

                let leafItems: MillerItem[] = [];
                if (leafConfigs.length > 0) {
                    const leafResults = await Promise.all(leafConfigs.map(async (cfg) => {
                        const leafLinkRows = await fetchPage(cfg.relationPath, cfg.targetKey);
                        if (leafLinkRows.length === 0) return [] as MillerItem[];
                        const leafIds = Array.from(new Set(
                            leafLinkRows.map((r: any) => r[cfg.otherKey]).filter(Boolean)
                        ));
                        const leafResourcePath = cfg.resourcePath || resolveResourcePath(cfg.resource, allModels);
                        const leafRecords = await bulkRead(leafResourcePath, leafIds);
                        const leafById = new Map(leafRecords.map((r: any) => [r.eid ?? r.id, r]));
                        return leafLinkRows
                            .map((linkRow: any) => {
                                const leafId = linkRow[cfg.otherKey];
                                const rec = leafById.get(leafId);
                                if (!rec) return null;
                                return {
                                    id: rec.eid ?? rec.id ?? leafId,
                                    label: getRecordDisplayLabel(rec),
                                    isBranch: false,
                                    resource: resolveModelName(cfg.resource, allModels),
                                    resourcePath: leafResourcePath,
                                } satisfies MillerItem;
                            })
                            .filter(Boolean) as MillerItem[];
                    }));
                    const seenIds = new Set<string | number>();
                    leafItems = leafResults.flat().filter((item) => {
                        if (seenIds.has(item.id)) return false;
                        seenIds.add(item.id);
                        return true;
                    });
                }

                if (isMounted) {
                    setBranches(branchItems);
                    setLeaves(leafItems);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (isMounted) {
                    setError(err instanceof Error ? err.message : _("Failed to load items"));
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAll();
        return () => {
            isMounted = false;
            controller.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        apiUrl,
        parentId,
        rel.resourcePath,
        rel.targetKey,
        rel.otherKey,
        rel.otherResource,
        rel.otherResourcePath,
        rel.millerLeafRelationPath,
        rel.millerLeafTargetKey,
        rel.millerLeafOtherKey,
        rel.millerLeafResource,
        rel.millerLeafResourcePath,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        JSON.stringify(rel.millerLeafConfigs),
    ]);

    return { branches, leaves, loading, error };
}

// ---------------------------------------------------------------------------
// MillerColumn — individually resizable scrollable column
// ---------------------------------------------------------------------------
interface MillerColumnProps {
    parentId: string | number;
    rel: RelationDef;
    selectedId: string | number | null;
    allModels?: ModelDef[];
    onBranchClick: (item: MillerItem) => void;
    onLeafClick: (item: MillerItem) => void;
    height: number;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
}

const MillerColumn: React.FC<MillerColumnProps> = ({
    parentId, rel, selectedId, allModels, onBranchClick, onLeafClick, height, width, onResizeStart,
}) => {
    const apiUrl = useApiUrl();
    const { token } = theme.useToken();
    const { branches, leaves, loading, error } = useMillerColumnItems({ parentId, rel, allModels, apiUrl });
    const items: MillerItem[] = [...branches, ...leaves];

    return (
        <div style={{ display: "flex", flexShrink: 0, height, width }}>
            {/* Scrollable content */}
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", backgroundColor: token.colorBgContainer }}>
                {loading && (
                    <div style={{ display: "flex", justifyContent: "center", paddingTop: 32 }}>
                        <Spin size="small" />
                    </div>
                )}
                {!loading && error && (
                    <div style={{ padding: "12px 16px", color: token.colorError, fontSize: 12 }}>{error}</div>
                )}
                {!loading && !error && items.length === 0 && (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={_("No items")}
                        style={{ margin: "32px 0" }}
                    />
                )}
                {items.map((item) => {
                    const href = getShowHref(item.resource, item.id, allModels);
                    const isSelected = selectedId === item.id;
                    return (
                        <a
                            key={`${item.isBranch ? "b" : "l"}-${item.id}`}
                            href={href}
                            title={item.label}
                            onClick={(e) => {
                                if (!shouldHandleLinkClick(e)) return;
                                e.preventDefault();
                                if (item.isBranch) onBranchClick(item);
                                else onLeafClick(item);
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "7px 12px",
                                textDecoration: "none",
                                color: isSelected ? token.colorPrimary : token.colorText,
                                backgroundColor: isSelected ? token.colorPrimaryBg : "transparent",
                                borderLeft: isSelected
                                    ? `3px solid ${token.colorPrimary}`
                                    : "3px solid transparent",
                                cursor: "pointer",
                                fontSize: 13,
                                lineHeight: "20px",
                                userSelect: "none",
                            }}
                            onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = token.colorFillAlter;
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                            }}
                        >
                            {item.isBranch ? (
                                <FolderOutlined style={{ color: token.colorWarning, flexShrink: 0, fontSize: 13 }} />
                            ) : (
                                <FileOutlined style={{ color: token.colorTextTertiary, flexShrink: 0, fontSize: 13 }} />
                            )}
                            <span style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {item.label}
                            </span>
                            {item.isBranch && (
                                <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary, flexShrink: 0 }} />
                            )}
                        </a>
                    );
                })}
            </div>
            {/* Per-column width resize handle */}
            <div
                onMouseDown={onResizeStart}
                style={{
                    width: 5,
                    flexShrink: 0,
                    cursor: "col-resize",
                    backgroundColor: token.colorFillAlter,
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div style={{ width: 2, height: 20, backgroundColor: token.colorBorder, borderRadius: 1 }} />
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// DetailPaneContent — renders DynamicShow for the selected node
// ---------------------------------------------------------------------------
const DetailPaneContent: React.FC<{ node: DetailNode; allModels?: ModelDef[] }> = ({ node, allModels }) => {
    const { token } = theme.useToken();
    const model = allModels?.find((m) => m.name === node.resource);
    const showHref = getShowHref(node.resource, node.id, allModels);
    if (!model) {
        return <Empty description={`${_("No schema for")} ${node.resource}`} style={{ marginTop: 32 }} />;
    }
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Typography.Title level={5} style={{ margin: 0, color: token.colorTextSecondary, fontWeight: 500, flex: 1, minWidth: 0 }}>
                    {node.label}
                </Typography.Title>
                {showHref && (
                    <Tooltip title={_("Open in new tab")}>
                        <Button
                            size="small"
                            icon={<LinkOutlined />}
                            href={showHref}
                            target="_blank"
                            rel="noopener noreferrer"
                        />
                    </Tooltip>
                )}
            </div>
            <DynamicShow model={model} allModels={allModels} idOverride={String(node.id)} embedded />
        </div>
    );
};

// ---------------------------------------------------------------------------
// MillerBrowserLayout — main orchestrator
// ---------------------------------------------------------------------------
export interface MillerBrowserLayoutProps {
    rel: RelationDef;
    record: any;
    allModels?: ModelDef[];
    showDetails: boolean;
}

const INITIAL_HEIGHT = 560;

export const MillerBrowserLayout: React.FC<MillerBrowserLayoutProps> = ({
    rel, record, allModels, showDetails,
}) => {
    const screens = Grid.useBreakpoint();
    const { token } = theme.useToken();
    const isDesktop = !!screens.md;
    const columnsRef = useRef<HTMLDivElement>(null);

    const rootId: string | number = record?.eid ?? record?.id;

    const [columns, setColumns] = useState<ColumnDesc[]>([{ parentId: rootId }]);
    const [selectedIds, setSelectedIds] = useState<(string | number | null)[]>([null]);
    const [detailNode, setDetailNode] = useState<DetailNode | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Resize state
    const [containerHeight, setContainerHeight] = useState(INITIAL_HEIGHT);
    const [columnsWidth, setColumnsWidth] = useState<number | null>(null);
    const [columnWidths, setColumnWidths] = useState<number[]>([]);
    const [draggingDir, setDraggingDir] = useState<"v" | "h" | null>(null);

    const DEFAULT_COL_WIDTH = 240;
    const getColWidth = (i: number) => columnWidths[i] ?? DEFAULT_COL_WIDTH;

    const handleResizeV = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = containerHeight;
        setDraggingDir("v");
        const onMove = (mv: MouseEvent) => setContainerHeight(Math.max(150, startH + mv.clientY - startY));
        const onUp = () => {
            setDraggingDir(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const handleResizeH = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = columnsRef.current?.getBoundingClientRect().width ?? columnsWidth ?? 400;
        setDraggingDir("h");
        const onMove = (mv: MouseEvent) => setColumnsWidth(Math.max(200, startW + mv.clientX - startX));
        const onUp = () => {
            setDraggingDir(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const handleColumnResizeStart = (colIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = getColWidth(colIndex);
        setDraggingDir("h");
        const onMove = (mv: MouseEvent) => {
            const next = Math.max(120, startW + mv.clientX - startX);
            setColumnWidths(prev => {
                const arr = [...prev];
                while (arr.length <= colIndex) arr.push(DEFAULT_COL_WIDTH);
                arr[colIndex] = next;
                return arr;
            });
        };
        const onUp = () => {
            setDraggingDir(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const handleBranchClick = (colIndex: number, item: MillerItem) => {
        setColumns([...columns.slice(0, colIndex + 1), { parentId: item.id }]);
        setSelectedIds([...selectedIds.slice(0, colIndex), item.id, null]);
        setDetailNode(null);
        setTimeout(() => {
            if (columnsRef.current) {
                columnsRef.current.scrollLeft = columnsRef.current.scrollWidth;
            }
        }, 60);
    };

    const handleLeafClick = (colIndex: number, item: MillerItem) => {
        setSelectedIds([...selectedIds.slice(0, colIndex), item.id]);
        const isSameModelAsBranch = item.resource === rel.otherResource;
        if (showDetails && !isSameModelAsBranch) {
            setDetailNode({ id: item.id, label: item.label, resource: item.resource, resourcePath: item.resourcePath });
            if (!isDesktop) setDrawerOpen(true);
        }
    };

    if (!rootId) {
        return <Empty description={_("No record selected")} />;
    }

    const columnsAreaStyle: React.CSSProperties = columnsWidth !== null
        ? { width: columnsWidth, flexShrink: 0, flexGrow: 0, minWidth: 200, overflowX: "auto", display: "flex", height: "100%" }
        : { width: showDetails ? "fit-content" : "100%", maxWidth: showDetails ? "50%" : "100%", flexShrink: 0, minWidth: 240, overflowX: "auto", display: "flex", height: "100%" };

    return (
        <>
            {/* Full-viewport overlay keeps cursor and blocks text selection while dragging */}
            {draggingDir && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    cursor: draggingDir === "v" ? "ns-resize" : "col-resize",
                    userSelect: "none",
                }} />
            )}

            {/* Main panel */}
            <div style={{
                display: "flex",
                overflow: "hidden",
                height: containerHeight,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: "8px 8px 0 0",
                backgroundColor: token.colorBgContainer,
            }}>
                {/* Columns area — horizontally scrollable, vertically scrolled per-column */}
                <div ref={columnsRef} style={columnsAreaStyle}>
                    {columns.map((col, colIndex) => (
                        <MillerColumn
                            key={`col-${colIndex}-${col.parentId}`}
                            parentId={col.parentId}
                            rel={rel}
                            selectedId={selectedIds[colIndex] ?? null}
                            allModels={allModels}
                            onBranchClick={(item) => handleBranchClick(colIndex, item)}
                            onLeafClick={(item) => handleLeafClick(colIndex, item)}
                            height={containerHeight}
                            width={getColWidth(colIndex)}
                            onResizeStart={(e) => handleColumnResizeStart(colIndex, e)}
                        />
                    ))}
                </div>

                {/* Horizontal splitter — desktop tree-details only */}
                {showDetails && isDesktop && (
                    <div
                        onMouseDown={handleResizeH}
                        style={{
                            width: 6,
                            flexShrink: 0,
                            cursor: "col-resize",
                            backgroundColor: token.colorFillAlter,
                            borderLeft: `1px solid ${token.colorBorderSecondary}`,
                            borderRight: `1px solid ${token.colorBorderSecondary}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <div style={{ width: 2, height: 28, backgroundColor: token.colorTextQuaternary, borderRadius: 1 }} />
                    </div>
                )}

                {/* Detail pane — desktop only */}
                {showDetails && detailNode && isDesktop && detailNode.resource !== rel.otherResource && (
                    <div style={{
                        flex: 1,
                        minWidth: 0,
                        height: "100%",
                        overflowY: "auto",
                        padding: "16px",
                        backgroundColor: token.colorBgLayout,
                    }}>
                        <DetailPaneContent node={detailNode} allModels={allModels} />
                    </div>
                )}

                {/* Detail drawer — mobile/tablet */}
                {showDetails && (
                    <Drawer
                        title={detailNode?.label ?? _("Details")}
                        placement="right"
                        open={drawerOpen && !isDesktop}
                        onClose={() => setDrawerOpen(false)}
                        width={Math.min(typeof window !== "undefined" ? window.innerWidth - 32 : 360, 420)}
                        styles={{ body: { padding: 16 } }}
                    >
                        {detailNode && detailNode.resource !== rel.otherResource && (
                            <DetailPaneContent node={detailNode} allModels={allModels} />
                        )}
                    </Drawer>
                )}
            </div>

            {/* Vertical resize handle */}
            <div
                onMouseDown={handleResizeV}
                style={{
                    height: 8,
                    cursor: "ns-resize",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: token.colorFillAlter,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                }}
            >
                <div style={{ width: 40, height: 3, backgroundColor: token.colorBorder, borderRadius: 2 }} />
            </div>
        </>
    );
};

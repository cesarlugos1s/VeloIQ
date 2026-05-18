import React, { useCallback, useEffect, useState } from "react";
import { Spin, Alert, Empty, Pagination, Tooltip, Button, Input, Checkbox, message, theme } from "antd";
import { EditOutlined, SaveOutlined, SearchOutlined, ShareAltOutlined } from "@ant-design/icons";
import { useApiUrl, useGo } from "@refinedev/core";
import { useNavigate, useLocation } from "react-router-dom";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, RelationDef } from "../types";
import { findModelByName, getRecordDisplayLabel, resolveModelName, resolveResourcePath } from "../utils/model";
import { getShowHref, shouldHandleLinkClick } from "../utils/navigation";
import { INLINE_DEFAULT_PAGE_SIZE, INLINE_PAGE_SIZE_OPTIONS, useRelatedInlineItems } from "./hooks";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsEditableList: React.FC<{
    rel: RelationDef;
    record: any;
    allModels?: ModelDef[];
}> = ({ rel, record, allModels }) => {
    const go = useGo();
    const paneNav = usePaneNavigation();
    const navigate = useNavigate();
    const location = useLocation();
    const apiUrl = useApiUrl();
    const { token } = theme.useToken();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(INLINE_DEFAULT_PAGE_SIZE);
    const { items: fetchedItems, loading, error, total } = useRelatedInlineItems({ rel, record, allModels, page, pageSize });
    const [localItems, setLocalItems] = useState<Array<{ id: any; label: string; resource: string }> | null>(null);
    useEffect(() => { setLocalItems(null); }, [fetchedItems]);
    const items = localItems ?? fetchedItems;
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [allOptions, setAllOptions] = useState<Array<{ id: number; label: string }>>([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [baselineIds, setBaselineIds] = useState<Set<number>>(new Set());
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        if (!editing) return;
        const snapshot = new Set(items.map((item) => Number(item.id)));
        setBaselineIds(snapshot);
        setSelectedIds(new Set(snapshot));
        let cancelled = false;
        const fetchAllOptions = async () => {
            if (!rel.otherResource) return;
            setOptionsLoading(true);
            try {
                const resource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
                const params = new URLSearchParams();
                params.set("_start", "0");
                params.set("_end", "50000");
                const response = await authenticatedFetch(`${apiUrl}/${resource}?${params.toString()}`);
                if (!response.ok) throw new Error(`Failed to load options`);
                const data = await response.json();
                if (!cancelled && Array.isArray(data)) {
                    setAllOptions(data.map((item: any) => ({
                        id: item.eid ?? item.id,
                        label: getRecordDisplayLabel(item),
                    })));
                }
            } catch (err) {
                console.warn("Failed to load options for editable-list", err);
            } finally {
                if (!cancelled) setOptionsLoading(false);
            }
        };
        fetchAllOptions();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    const handleSave = useCallback(async () => {
        if (!rel.otherKey || !rel.targetKey) return;
        const recordId = record?.eid ?? record?.id;
        if (recordId === undefined || recordId === null) return;
        setSaving(true);
        const errors: string[] = [];
        const successfulAdds = new Set<number>();
        const successfulRemoves = new Set<number>();
        try {
            const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
            const toAdd = [...selectedIds].filter((id) => !baselineIds.has(id));
            const toRemove = [...baselineIds].filter((id) => !selectedIds.has(id));
            for (const id of toRemove) {
                const deleteId = rel.targetKey === "eid_from" ? `${recordId}:${id}` : `${id}:${recordId}`;
                const resp = await authenticatedFetch(`${apiUrl}/${relationResource}/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
                if (!resp.ok) {
                    let detail = `Failed to remove relation (${resp.status})`;
                    try { const body = await resp.json(); if (body?.detail) detail = String(body.detail); } catch {}
                    errors.push(detail);
                } else {
                    successfulRemoves.add(id);
                }
            }
            for (const id of toAdd) {
                const payload = { [rel.targetKey]: recordId, [rel.otherKey]: id };
                const resp = await authenticatedFetch(`${apiUrl}/${relationResource}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) {
                    let detail = `Failed to add relation (${resp.status})`;
                    try {
                        const body = await resp.json();
                        if (body?.detail) {
                            const d = String(body.detail);
                            if (d.toLowerCase().includes("unique") || d.toLowerCase().includes("duplicate")) {
                                const optLabel = allOptions.find((o) => o.id === id)?.label ?? String(id);
                                detail = `"${optLabel}" ${_("is already linked to another record and cannot be added here.")}`;
                            } else {
                                detail = d;
                            }
                        }
                    } catch {}
                    errors.push(detail);
                } else {
                    successfulAdds.add(id);
                }
            }
            const newBaseline = new Set(baselineIds);
            for (const id of successfulRemoves) newBaseline.delete(id);
            for (const id of successfulAdds) newBaseline.add(id);
            setBaselineIds(newBaseline);
            setSelectedIds(new Set(newBaseline));

            if (errors.length > 0) {
                message.error(errors[0], 6);
                if (errors.length > 1) message.warning(`${errors.length - 1} ${_("other error(s) occurred.")}`, 4);
            } else {
                message.success(_("Changes saved."));
                setEditing(false);
                setSearchText("");
            }
            const otherResource = resolveModelName(rel.otherResource, allModels);
            const newItems = allOptions
                .filter((opt) => newBaseline.has(opt.id))
                .map((opt) => ({ id: opt.id, label: opt.label, resource: otherResource }));
            setLocalItems(newItems);
        } catch (err) {
            message.error(err instanceof Error ? err.message : _("Failed to save changes."));
        } finally {
            setSaving(false);
        }
    }, [apiUrl, allModels, allOptions, rel, record, selectedIds, baselineIds]);

    const handleCancel = useCallback(() => {
        setEditing(false);
        setSelectedIds(new Set(baselineIds));
        setSearchText("");
    }, [baselineIds]);

    const handleCreateNewAndRelate = useCallback(() => {
        const otherKey = rel.otherKey;
        if (!otherKey || !rel.targetKey) return;
        const recordId = record?.eid ?? record?.id;
        if (recordId === undefined || recordId === null) return;
        const params = new URLSearchParams();
        const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
        const relatedModel = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
        const relatedResource = relatedModel
            ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels)
            : null;
        if (!relatedResource) {
            message.warning(_("No create route for the related model. Opening relation create form."));
            params.append(rel.targetKey, String(recordId));
            const returnTo = `${location.pathname}${location.search}${location.hash}`;
            if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
            navigate(`/${relationResource}/create?${params.toString()}`);
            return;
        }
        params.append("relate_resource", relationResource);
        params.append("relate_target_key", rel.targetKey);
        params.append("relate_other_key", otherKey);
        params.append("relate_target_id", String(recordId));
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
        navigate(`/${relatedResource}/create?${params.toString()}`);
    }, [rel, record, allModels, location, navigate]);

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;

    if (!editing) {
        return (
            <div style={{ minHeight: 22 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                    <Tooltip title={_("Edit")}>
                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditing(true)} />
                    </Tooltip>
                </div>
                {items.length === 0 && total === 0 ? (
                    <span style={{ color: token.colorTextSecondary, fontStyle: "italic" }}>—</span>
                ) : (
                    <>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {items.map((item, index) => (
                                <li key={`${item.resource}-${item.id}-${index}`}>
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
                                </li>
                            ))}
                        </ul>
                        {total > pageSize && (
                            <Pagination
                                size="small"
                                current={page}
                                pageSize={pageSize}
                                total={total}
                                {...({ hideOnSinglePage: true } as any)}
                                showSizeChanger={true}
                                pageSizeOptions={INLINE_PAGE_SIZE_OPTIONS}
                                onChange={(p, newPageSize) => {
                                    if (newPageSize && newPageSize !== pageSize) {
                                        setPageSize(newPageSize);
                                        setPage(1);
                                    } else {
                                        setPage(p);
                                    }
                                }}
                                onShowSizeChange={(_, newPageSize) => {
                                    setPageSize(newPageSize);
                                    setPage(1);
                                }}
                                style={{ marginTop: 4 }}
                            />
                        )}
                    </>
                )}
            </div>
        );
    }

    const hasChanges = (() => {
        if (selectedIds.size !== baselineIds.size) return true;
        for (const id of selectedIds) { if (!baselineIds.has(id)) return true; }
        return false;
    })();

    const filteredOptions = allOptions.filter((opt) =>
        !searchText || opt.label.toLowerCase().includes(searchText.toLowerCase())
    );
    const sortedOptions = [...filteredOptions].sort((a, b) => {
        const aSelected = selectedIds.has(a.id) ? 0 : 1;
        const bSelected = selectedIds.has(b.id) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        return a.label.localeCompare(b.label);
    });

    return (
        <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: 6, padding: 8, background: token.colorBgContainer }}>
            <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                    prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
                    placeholder={_("Search...")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    size="small"
                    style={{ flex: 1 }}
                />
                {rel.otherResource && rel.otherKey && rel.targetKey && (
                    <Tooltip title={_("Create new and relate")}>
                        <Button size="small" icon={<ShareAltOutlined />} onClick={handleCreateNewAndRelate} />
                    </Tooltip>
                )}
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 8 }}>
                {optionsLoading ? (
                    <div style={{ textAlign: "center", padding: 16 }}><Spin size="small" /></div>
                ) : sortedOptions.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={_("No options")} />
                ) : (
                    sortedOptions.map((opt) => {
                        const checked = selectedIds.has(opt.id);
                        return (
                            <div
                                key={opt.id}
                                onClick={() => {
                                    setSelectedIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(opt.id)) next.delete(opt.id);
                                        else next.add(opt.id);
                                        return next;
                                    });
                                }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    background: checked ? token.colorPrimaryBg : "transparent",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = checked ? token.colorPrimaryBgHover : token.colorFillSecondary; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = checked ? token.colorPrimaryBg : "transparent"; }}
                            >
                                <Checkbox checked={checked} />
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {opt.label}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
                <Button size="small" onClick={handleCancel}>{_("Cancel")}</Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!hasChanges}>
                    {_("Save")}
                </Button>
            </div>
        </div>
    );
};

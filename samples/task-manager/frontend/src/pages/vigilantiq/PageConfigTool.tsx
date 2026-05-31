/**
 * VigilantIQ Page Configuration Tool.
 *
 * Mimics the JuiceMantics WYSIWYG layout: a three-pane editor with a left
 * PALETTE (fields / relations / embedded NL sentences), a center CANVAS
 * (tabs → sections laid out in a grid → entries placed in section cells), and
 * a right PROPERTIES panel that edits whatever is selected (section or entry).
 * The left and right panes are drag-resizable.
 *
 * Self-contained: @juicemantics/veloiq-ui exports + antd only (no @dnd-kit).
 * Adding an entry = click a palette item (drops into the selected section);
 * positioning uses row/col move controls instead of drag.
 *
 * Persisted via the pageconfig module at /pageconfig/configs/{model}/{view_type}.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Typography, Card, Select, Button, Space, Input, message, Spin, Tag,
    Empty, Tooltip, Popconfirm, Switch, theme, List, Modal, Tabs,
} from "antd";
import {
    ToolOutlined, PlusOutlined, DeleteOutlined, CloseOutlined, SaveOutlined,
    ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined,
    EditOutlined, DatabaseOutlined, ApartmentOutlined, CommentOutlined,
    RollbackOutlined, EyeOutlined, CopyOutlined,
} from "@ant-design/icons";
import type { ModelDef } from "@juicemantics/veloiq-ui";
import { API_URL, authenticatedFetch, useAllModels } from "@juicemantics/veloiq-ui";

const { Title, Text } = Typography;
const BASE = `${API_URL}/pageconfig/configs`;
const VIEW_TYPES = ["show", "edit", "list", "create"];

// Per-element-type view-type option sets (mirrors the JuiceMantics panel).
const FIELD_VIEW_TYPES_SHOW = [
    "read-only-field", "read-only-textarea", "read-only-markdown", "read-only-json",
    "read-only-url", "read-only-email", "read-only-currency", "read-only-percentage",
    "read-only-progress", "read-only-rating", "read-only-duration", "read-only-phone",
    "read-only-color", "read-only-code", "read-only-image-url", "read-only-qrcode",
    "read-only-relative", "read-only-truncated-text",
];
const FIELD_VIEW_TYPES_EDIT = [
    "editable-field", "editable-textarea", "editable-markdown", "editable-json",
    "editable-url", "editable-email", "editable-currency", "editable-percentage",
    "editable-progress", "editable-rating", "editable-duration", "editable-phone",
    "editable-color", "editable-code", "editable-image-url", "read-only-field",
];
const RELATION_VIEW_TYPES = [
    "table", "editable-table", "editable-list", "list", "csv", "read-and-edit-csv",
    "editable-csv", "gallery", "calendar", "primary", "totals-details", "tree", "tree-details",
];
const NLSENTENCE_VIEW_TYPES = ["primary", "editable-table", "table", "list", "muledit"];

type EntryKind = "field" | "relation" | "nlsentence";
interface Entry {
    id: string; kind: EntryKind; key: string; label: string;
    row: number; column: number; show_label: boolean; view_type?: string;
    limit?: number; // relations only
}
interface Section { id: string; name: string; grid_row: number; grid_col: number; entries: Entry[]; }
interface Tab { id: string; name: string; tab_order: number; sections: Section[]; }
interface NlSentenceOpt { eid: number; name: string; }

const uid = () => Math.random().toString(36).slice(2, 9);
const DETAILS = "__details__";

export default function PageConfigTool() {
    const allModels = useAllModels();
    const { token } = theme.useToken();

    // Keyed by model.name (the entity class name) because that is what the host
    // app's DynamicShow/DynamicEdit fetch view configurations with — keeping the
    // saved config discoverable at render time.
    const modelOptions = useMemo(() => allModels.filter((m) => !m.hideInMenu)
        .map((m) => ({ label: m.label || m.name, value: m.name })), [allModels]);

    const [model, setModel] = useState<string | undefined>();
    const [viewType, setViewType] = useState("show");
    const [sections, setSections] = useState<Section[]>([]);   // Details tab
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTab, setActiveTab] = useState<string>(DETAILS); // DETAILS or tab.id
    const [selSectionId, setSelSectionId] = useState<string | null>(null);
    const [selEntryId, setSelEntryId] = useState<string | null>(null);
    const [nlSentences, setNlSentences] = useState<NlSentenceOpt[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [jsonImport, setJsonImport] = useState("");

    // undo history (snapshots of {sections, tabs} taken before each mutation)
    const [history, setHistory] = useState<{ sections: Section[]; tabs: Tab[] }[]>([]);
    const snapshot = () => setHistory((h) =>
        [...h.slice(-29), { sections: JSON.parse(JSON.stringify(sections)), tabs: JSON.parse(JSON.stringify(tabs)) }]);
    const undo = () => {
        setHistory((h) => {
            if (h.length === 0) return h;
            const prev = h[h.length - 1];
            setSections(prev.sections);
            setTabs(prev.tabs);
            setSelEntryId(null); setSelSectionId(null);
            return h.slice(0, -1);
        });
    };

    // resizable side panels (px widths, center flexes)
    const rootRef = useRef<HTMLDivElement>(null);
    const [leftW, setLeftW] = useState(240);
    const [rightW, setRightW] = useState(300);
    const [drag, setDrag] = useState<null | "left" | "right">(null);
    useEffect(() => {
        if (!drag) return;
        const onMove = (e: MouseEvent) => {
            const el = rootRef.current; if (!el) return;
            const rect = el.getBoundingClientRect();
            if (drag === "left") setLeftW(Math.min(420, Math.max(160, e.clientX - rect.left)));
            else setRightW(Math.min(480, Math.max(200, rect.right - e.clientX)));
        };
        const onUp = () => setDrag(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [drag]);

    const modelDef = allModels.find((m) => m.name === model);

    // ---- load config + nl sentences ----
    const loadConfig = async (m: string, v: string) => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${BASE}/${m}/${v}`);
            if (res.ok) {
                const cfg = await res.json();
                setSections(cfg.sections?.length ? cfg.sections : [{ id: uid(), name: "General", grid_row: 1, grid_col: 1, entries: [] }]);
                setTabs(cfg.tabs ?? []);
                setActiveTab(DETAILS);
                setSelSectionId(null); setSelEntryId(null);
            }
        } catch { message.error("Failed to load configuration"); }
        finally { setLoading(false); }
    };
    useEffect(() => { if (model) loadConfig(model, viewType); }, [model, viewType]);

    useEffect(() => {
        // NL sentences are optional (only when the NLP module is licensed).
        (async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/cw_nlsentence?_start=0&_end=200`);
                if (res.ok) {
                    const rows = await res.json();
                    setNlSentences((Array.isArray(rows) ? rows : []).map((r: any) => ({
                        eid: r.eid ?? r.id, name: r.nl_sentence_name || r.nl_sentence || `Sentence ${r.eid ?? r.id}`,
                    })));
                }
            } catch { /* nlp not licensed — no embedded sentences */ }
        })();
    }, []);

    // ---- active sections (Details or a tab) ----
    const activeSections = activeTab === DETAILS ? sections : (tabs.find((t) => t.id === activeTab)?.sections ?? []);
    const setActiveSections = (updater: (s: Section[]) => Section[]) => {
        if (activeTab === DETAILS) setSections(updater);
        else setTabs((ts) => ts.map((t) => t.id === activeTab ? { ...t, sections: updater(t.sections) } : t));
    };

    const selSection = activeSections.find((s) => s.id === selSectionId) ?? null;
    const selEntry: Entry | null = (() => {
        for (const s of activeSections) { const e = s.entries.find((e) => e.id === selEntryId); if (e) return e; }
        return null;
    })();

    // ---- placed keys (to filter palette) across ALL tabs+details ----
    const placed = new Set<string>();
    [...sections, ...tabs.flatMap((t) => t.sections)].forEach((s) =>
        s.entries.forEach((e) => placed.add(`${e.kind}:${e.key}`)));

    const availFields = (modelDef?.fields ?? []).filter((f) => !placed.has(`field:${f.key}`))
        .map((f) => ({ kind: "field" as const, key: f.key, label: f.label || f.key }));
    const availRelations = (modelDef?.relations ?? []).filter((r: any) => !placed.has(`relation:${r.resource || r.label}`))
        .map((r: any) => ({ kind: "relation" as const, key: r.resource || r.label, label: r.label || r.resource }));
    const availNls = nlSentences.filter((n) => !placed.has(`nlsentence:${n.eid}`))
        .map((n) => ({ kind: "nlsentence" as const, key: String(n.eid), label: n.name }));

    // ---- section mutations ----
    const addSection = () => {
        snapshot();
        const maxRow = Math.max(0, ...activeSections.map((s) => s.grid_row));
        const s: Section = { id: uid(), name: `Section ${activeSections.length + 1}`, grid_row: maxRow + 1, grid_col: 1, entries: [] };
        setActiveSections((arr) => [...arr, s]);
        setSelSectionId(s.id); setSelEntryId(null);
    };
    const updateSection = (id: string, patch: Partial<Section>) => {
        snapshot();
        setActiveSections((arr) => arr.map((s) => s.id === id ? { ...s, ...patch } : s));
    };
    const removeSection = (id: string) => {
        snapshot();
        setActiveSections((arr) => arr.filter((s) => s.id !== id));
        if (selSectionId === id) setSelSectionId(null);
    };

    // ---- entry mutations ----
    const targetSectionId = selSectionId && activeSections.some((s) => s.id === selSectionId)
        ? selSectionId : activeSections[0]?.id;
    const addEntry = (item: { kind: EntryKind; key: string; label: string }) => {
        if (!targetSectionId) { message.warning("Add a section first"); return; }
        snapshot();
        setActiveSections((arr) => arr.map((s) => {
            if (s.id !== targetSectionId) return s;
            const nextRow = Math.max(0, ...s.entries.map((e) => e.row)) + 1;
            const entry: Entry = { id: uid(), ...item, row: nextRow, column: 1, show_label: true };
            return { ...s, entries: [...s.entries, entry] };
        }));
    };
    const updateEntry = (id: string, patch: Partial<Entry>) => {
        snapshot();
        setActiveSections((arr) => arr.map((s) => ({ ...s, entries: s.entries.map((e) => e.id === id ? { ...e, ...patch } : e) })));
    };
    const removeEntry = (id: string) => {
        snapshot();
        setActiveSections((arr) => arr.map((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) })));
        if (selEntryId === id) setSelEntryId(null);
    };
    // Drag-and-drop: add a new palette item, or move an existing entry, to a cell.
    const addEntryAt = (sectionId: string, item: { kind: EntryKind; key: string; label: string }, row: number, col: number) => {
        snapshot();
        setActiveSections((arr) => arr.map((s) => s.id === sectionId
            ? { ...s, entries: [...s.entries, { id: uid(), kind: item.kind, key: item.key, label: item.label, row, column: col, show_label: true }] }
            : s));
    };
    const moveEntryTo = (entryId: string, sectionId: string, row: number, col: number) => {
        snapshot();
        setActiveSections((arr) => {
            let moved: Entry | undefined;
            const stripped = arr.map((s) => ({ ...s, entries: s.entries.filter((e) => { if (e.id === entryId) { moved = e; return false; } return true; }) }));
            if (!moved) return arr;
            const m = moved;
            return stripped.map((s) => s.id === sectionId ? { ...s, entries: [...s.entries, { ...m, row, column: col }] } : s);
        });
    };
    const onDropToCell = (sectionId: string, row: number, col: number, payload: any) => {
        if (!payload || !payload.type) return;
        if (payload.type === "new") addEntryAt(sectionId, payload, row, col);
        else if (payload.type === "move" && payload.entryId) moveEntryTo(payload.entryId, sectionId, row, col);
    };

    // ---- tab mutations ----
    const addTab = () => {
        snapshot();
        const t: Tab = { id: uid(), name: `Tab ${tabs.length + 1}`, tab_order: tabs.length, sections: [] };
        setTabs((ts) => [...ts, t]); setActiveTab(t.id);
    };
    const renameTab = (id: string, name: string) => { snapshot(); setTabs((ts) => ts.map((t) => t.id === id ? { ...t, name } : t)); };
    const removeTab = (id: string) => {
        snapshot();
        setTabs((ts) => ts.filter((t) => t.id !== id));
        if (activeTab === id) setActiveTab(DETAILS);
    };
    const moveTab = (id: string, dir: -1 | 1) => setTabs((ts) => {
        const sorted = [...ts].sort((a, b) => a.tab_order - b.tab_order);
        const i = sorted.findIndex((t) => t.id === id); const j = i + dir;
        if (i < 0 || j < 0 || j >= sorted.length) return ts;
        [sorted[i].tab_order, sorted[j].tab_order] = [sorted[j].tab_order, sorted[i].tab_order];
        return [...sorted];
    });

    const handleSave = async () => {
        if (!model) return;
        setSaving(true);
        try {
            const res = await authenticatedFetch(`${BASE}/${model}/${viewType}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sections, tabs }),
            });
            if (res.ok) message.success("Page configuration saved"); else message.error("Save failed");
        } catch { message.error("Network error"); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!model) return;
        setDeleting(true);
        try {
            const res = await authenticatedFetch(`${BASE}/${model}/${viewType}`, { method: "DELETE" });
            if (res.ok || res.status === 404) {
                message.success("Configuration deleted");
                setSections([{ id: uid(), name: "General", grid_row: 1, grid_col: 1, entries: [] }]);
                setTabs([]); setHistory([]); setSelEntryId(null); setSelSectionId(null);
            } else message.error("Delete failed");
        } catch { message.error("Network error"); } finally { setDeleting(false); }
    };

    const copyToEdit = async () => {
        if (!model) return;
        try {
            const res = await authenticatedFetch(`${BASE}/${model}/edit`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sections, tabs }),
            });
            if (res.ok) message.success("Copied Show layout to the Edit page"); else message.error("Copy failed");
        } catch { message.error("Network error"); }
    };

    const applyJsonImport = () => {
        try {
            const parsed = JSON.parse(jsonImport);
            snapshot();
            if (Array.isArray(parsed.sections)) setSections(parsed.sections);
            if (Array.isArray(parsed.tabs)) setTabs(parsed.tabs);
            message.success("Imported — review and Save to persist");
            setJsonOpen(false); setJsonImport("");
        } catch { message.error("Invalid JSON"); }
    };

    const kindIcon = (k: EntryKind) =>
        k === "relation" ? <ApartmentOutlined /> : k === "nlsentence" ? <CommentOutlined /> : <DatabaseOutlined />;
    const kindColor = (k: EntryKind) => k === "relation" ? "blue" : k === "nlsentence" ? "purple" : "default";

    // ---- section grid render (rows × cols of sections) ----
    const renderSectionGrid = () => {
        const rowMap = new Map<number, Section[]>();
        activeSections.forEach((s) => rowMap.set(s.grid_row, [...(rowMap.get(s.grid_row) || []), s]));
        const rows = Array.from(rowMap.keys()).sort((a, b) => a - b);
        if (activeSections.length === 0)
            return <Empty image={<ToolOutlined style={{ fontSize: 40, color: token.colorTextDisabled }} />}
                description="No sections yet. Add a section, then click palette items to place fields." />;
        return rows.map((r) => {
            const rowSecs = (rowMap.get(r) || []).slice().sort((a, b) => a.grid_col - b.grid_col);
            const rowMaxCol = Math.max(1, ...rowSecs.map((s) => s.grid_col));
            return (
            <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${rowMaxCol}, minmax(0, 1fr))`, gap: 12, alignItems: "stretch", marginBottom: 12 }}>
                {rowSecs.map((section) => (
                    <div key={section.id} style={{ gridColumn: section.grid_col }}>
                    <SectionBlock key={section.id} section={section}
                        selected={selSectionId === section.id} selEntryId={selEntryId}
                        onSelectSection={() => { setSelSectionId(section.id); setSelEntryId(null); }}
                        onSelectEntry={(eid) => { setSelEntryId(eid); setSelSectionId(section.id); }}
                        onUpdate={updateSection} onRemove={removeSection} onRemoveEntry={removeEntry}
                        onDrop={onDropToCell}
                        kindIcon={kindIcon} kindColor={kindColor} token={token} />
                    </div>
                ))}
            </div>
            );
        });
    };

    if (!model) {
        return (
            <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
                <Title level={3}><ToolOutlined /> Page Configuration Tool</Title>
                <TargetBar {...{ modelOptions, model, setModel, viewType, setViewType, saving, handleSave }} />
                <Empty description="Select a model to configure its page layout" style={{ marginTop: 40 }} />
            </div>
        );
    }

    const sortedTabs = [...tabs].sort((a, b) => a.tab_order - b.tab_order);

    return (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 80px)" }}>
            <Title level={3} style={{ margin: 0 }}><ToolOutlined /> Page Configuration Tool</Title>
            <TargetBar {...{ modelOptions, model, setModel, viewType, setViewType, saving, handleSave }} />

            {/* Toolbar — undo / preview / copy / json / delete */}
            <Card size="small" bodyStyle={{ padding: "6px 12px" }}>
                <Space wrap>
                    <Tooltip title="Undo last change">
                        <Button size="small" icon={<RollbackOutlined />} onClick={undo} disabled={history.length === 0}>Undo</Button>
                    </Tooltip>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>Preview</Button>
                    {viewType === "show" && (
                        <Popconfirm title="Copy this Show layout to the Edit page?" onConfirm={copyToEdit}>
                            <Button size="small" icon={<CopyOutlined />}>Copy Show → Edit</Button>
                        </Popconfirm>
                    )}
                    <Button size="small" icon={<CopyOutlined />} onClick={() => { setJsonImport(""); setJsonOpen(true); }}>JSON</Button>
                    <Popconfirm title="Delete this configuration?" okButtonProps={{ danger: true }} onConfirm={handleDelete}>
                        <Button size="small" danger icon={<DeleteOutlined />} loading={deleting}>Delete</Button>
                    </Popconfirm>
                    <Text type="secondary" style={{ fontSize: 12 }}>{viewType} page · {activeTab === DETAILS ? "Details" : "tab"}</Text>
                </Space>
            </Card>

            {loading ? (
                <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>
            ) : (
                <div ref={rootRef} style={{ display: "flex", flex: 1, minHeight: 320, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, overflow: "hidden" }}>
                    {/* LEFT palette */}
                    <div style={{ width: leftW, flexShrink: 0, borderRight: `1px solid ${token.colorBorderSecondary}`, display: "flex", flexDirection: "column", background: token.colorBgContainer, overflow: "auto" }}>
                        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${token.colorBorderSecondary}`, fontWeight: 500 }}>Available</div>
                        <div style={{ padding: 8 }}>
                            <Palette title="Fields" items={availFields} onAdd={addEntry} kindIcon={kindIcon} kindColor={kindColor} />
                            <Palette title="Relations" items={availRelations} onAdd={addEntry} kindIcon={kindIcon} kindColor={kindColor} />
                            {availNls.length > 0 && <Palette title="NL Sentences" items={availNls} onAdd={addEntry} kindIcon={kindIcon} kindColor={kindColor} />}
                            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
                                Click an item to add it to the {selSection ? `"${selSection.name}"` : "first"} section.
                            </Text>
                        </div>
                    </div>
                    <div onMouseDown={(e) => { e.preventDefault(); setDrag("left"); }}
                         style={{ width: 6, cursor: "col-resize", background: drag === "left" ? token.colorPrimaryBg : token.colorBorderSecondary, flexShrink: 0 }} />

                    {/* CENTER canvas */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: token.colorBgLayout, overflow: "auto" }}>
                        {/* tab bar */}
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: "4px 4px 0", flexWrap: "wrap", background: token.colorBgContainer }}>
                            <TabPill label="Details" active={activeTab === DETAILS} onSelect={() => { setActiveTab(DETAILS); setSelSectionId(null); setSelEntryId(null); }} token={token} />
                            {sortedTabs.map((t, idx) => (
                                <TabPill key={t.id} label={t.name} active={activeTab === t.id} token={token}
                                    onSelect={() => { setActiveTab(t.id); setSelSectionId(null); setSelEntryId(null); }}
                                    onRename={(n) => renameTab(t.id, n)} onRemove={() => removeTab(t.id)}
                                    onMoveLeft={idx > 0 ? () => moveTab(t.id, -1) : undefined}
                                    onMoveRight={idx < sortedTabs.length - 1 ? () => moveTab(t.id, 1) : undefined} />
                            ))}
                            <Tooltip title="Add tab"><Button type="text" size="small" icon={<PlusOutlined />} onClick={addTab} style={{ marginBottom: 1 }} /></Tooltip>
                        </div>
                        {/* sections */}
                        <div style={{ padding: 12, flex: 1 }}>
                            {renderSectionGrid()}
                            <Button type="dashed" icon={<PlusOutlined />} onClick={addSection} style={{ width: "100%", marginTop: 4 }}>Add Section</Button>
                        </div>
                    </div>
                    <div onMouseDown={(e) => { e.preventDefault(); setDrag("right"); }}
                         style={{ width: 6, cursor: "col-resize", background: drag === "right" ? token.colorPrimaryBg : token.colorBorderSecondary, flexShrink: 0 }} />

                    {/* RIGHT properties */}
                    <div style={{ width: rightW, flexShrink: 0, borderLeft: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer, overflow: "auto", padding: 12 }}>
                        <PropertiesPanel selEntry={selEntry} selSection={selSection} viewType={viewType}
                            onUpdateEntry={updateEntry} onRemoveEntry={removeEntry}
                            onUpdateSection={updateSection} onRemoveSection={removeSection}
                            kindColor={kindColor} />
                    </div>
                </div>
            )}

            {/* Preview modal */}
            <Modal open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={820}
                   title={`Preview — ${modelDef?.label || model} (${viewType})`}>
                <PagePreview details={sections} tabs={[...tabs].sort((a, b) => a.tab_order - b.tab_order)} kindColor={kindColor} />
            </Modal>

            {/* JSON export / import modal */}
            <Modal open={jsonOpen} onCancel={() => { setJsonOpen(false); setJsonImport(""); }} width={680}
                   title="JSON — Export / Import"
                   footer={<Button onClick={() => { setJsonOpen(false); setJsonImport(""); }}>Close</Button>}>
                <Text type="secondary" style={{ fontSize: 12 }}>Current configuration (read-only)</Text>
                <Input.TextArea readOnly value={JSON.stringify({ sections, tabs }, null, 2)}
                    autoSize={{ minRows: 6, maxRows: 12 }} style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 6 }} />
                <Button size="small" icon={<CopyOutlined />} style={{ marginBottom: 12 }}
                    onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ sections, tabs }, null, 2)); message.success("Copied"); }}>
                    Copy to clipboard
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>Paste JSON to import</Text>
                <Input.TextArea value={jsonImport} onChange={(e) => setJsonImport(e.target.value)}
                    placeholder='{"sections": [...], "tabs": [...]}' autoSize={{ minRows: 5, maxRows: 10 }}
                    style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 8 }} />
                <Button type="primary" disabled={!jsonImport.trim()} onClick={applyJsonImport}>Apply import</Button>
            </Modal>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page preview — structural read-only render of tabs → sections → entries
// ---------------------------------------------------------------------------
const PagePreview: React.FC<{ details: Section[]; tabs: Tab[]; kindColor: (k: EntryKind) => string }> = ({ details, tabs, kindColor }) => {
    const renderSections = (secs: Section[]) => {
        if (secs.length === 0) return <Empty description="No sections" />;
        const rowMap = new Map<number, Section[]>();
        secs.forEach((s) => rowMap.set(s.grid_row, [...(rowMap.get(s.grid_row) || []), s]));
        return Array.from(rowMap.keys()).sort((a, b) => a - b).map((r) => (
            <div key={r} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                {(rowMap.get(r) || []).sort((a, b) => a.grid_col - b.grid_col).map((s) => (
                    <Card key={s.id} size="small" title={s.name} style={{ flex: 1 }}>
                        {s.entries.length === 0 ? <Text type="secondary">empty</Text> :
                            [...s.entries].sort((a, b) => a.row - b.row || a.column - b.column).map((e) => (
                                <div key={e.id} style={{ marginBottom: 4 }}>
                                    {e.show_label && <Text type="secondary" style={{ marginRight: 6 }}>{e.label}:</Text>}
                                    <Tag color={kindColor(e.kind)}>{e.view_type || e.kind}</Tag>
                                </div>
                            ))}
                    </Card>
                ))}
            </div>
        ));
    };
    if (tabs.length === 0) return <div>{renderSections(details)}</div>;
    return (
        <Tabs items={[
            { key: "__details__", label: "Details", children: renderSections(details) },
            ...tabs.map((t) => ({ key: t.id, label: t.name, children: renderSections(t.sections) })),
        ]} />
    );
};

// ---------------------------------------------------------------------------
// Target bar (model + view type + save)
// ---------------------------------------------------------------------------
const TargetBar: React.FC<any> = ({ modelOptions, model, setModel, viewType, setViewType, saving, handleSave }) => (
    <Card size="small">
        <Space wrap align="end">
            <span><Text type="secondary">Model</Text><br />
                <Select placeholder="Select a model" options={modelOptions} value={model} onChange={setModel} showSearch style={{ minWidth: 260 }} /></span>
            <span><Text type="secondary">View</Text><br />
                <Select options={VIEW_TYPES.map((v) => ({ label: v, value: v }))} value={viewType} onChange={setViewType} style={{ minWidth: 140 }} /></span>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!model}>Save</Button>
        </Space>
    </Card>
);

// ---------------------------------------------------------------------------
// Palette group
// ---------------------------------------------------------------------------
const Palette: React.FC<{
    title: string;
    items: { kind: EntryKind; key: string; label: string }[];
    onAdd: (i: { kind: EntryKind; key: string; label: string }) => void;
    kindIcon: (k: EntryKind) => React.ReactNode; kindColor: (k: EntryKind) => string;
}> = ({ title, items, onAdd, kindIcon, kindColor }) => (
    <div style={{ marginBottom: 10 }}>
        <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase" }}>{title}</Text>
        {items.length === 0 ? (
            <div style={{ fontSize: 12, color: "#aaa", padding: "2px 0" }}>none</div>
        ) : (
            <List size="small" split={false} dataSource={items} renderItem={(it) => (
                <List.Item style={{ padding: "2px 0" }}>
                    <div
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "all";
                            e.dataTransfer.setData("text/plain", JSON.stringify({ type: "new", kind: it.kind, key: it.key, label: it.label }));
                        }}
                        onClick={() => onAdd(it)}
                        style={{ cursor: "grab", display: "inline-block" }}
                        title="Drag into a section cell, or click to add"
                    >
                        <Tag icon={kindIcon(it.kind)} color={kindColor(it.kind)} style={{ pointerEvents: "none" }}>{it.label}</Tag>
                    </div>
                </List.Item>
            )} />
        )}
    </div>
);

// ---------------------------------------------------------------------------
// Tab pill
// ---------------------------------------------------------------------------
const TabPill: React.FC<{
    label: string; active: boolean; token: any;
    onSelect: () => void; onRename?: (n: string) => void; onRemove?: () => void;
    onMoveLeft?: () => void; onMoveRight?: () => void;
}> = ({ label, active, token, onSelect, onRename, onRemove, onMoveLeft, onMoveRight }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(label);
    useEffect(() => setVal(label), [label]);
    const commit = () => { setEditing(false); if (val.trim() && val.trim() !== label) onRename?.(val.trim()); };
    return (
        <div onClick={onSelect} style={{
            display: "flex", alignItems: "center", gap: 2, padding: "4px 10px", borderRadius: "6px 6px 0 0",
            border: `1px solid ${active ? token.colorBorder : token.colorBorderSecondary}`,
            borderBottom: active ? `1px solid ${token.colorBgContainer}` : undefined,
            background: active ? token.colorBgContainer : token.colorFillAlter, cursor: "pointer", marginBottom: active ? -1 : 0,
        }}>
            {editing ? (
                <Input size="small" value={val} autoFocus style={{ width: 90 }}
                    onChange={(e) => setVal(e.target.value)} onBlur={commit} onPressEnter={commit} onClick={(e) => e.stopPropagation()} />
            ) : (
                <>
                    <span style={{ fontSize: 12, fontWeight: active ? 500 : 400 }}>{label}</span>
                    {active && onRename && (
                        <Space size={0} style={{ marginLeft: 4 }} onClick={(e) => e.stopPropagation()}>
                            <Button type="text" size="small" style={{ width: 18, height: 18, padding: 0 }} icon={<EditOutlined style={{ fontSize: 10 }} />} onClick={() => setEditing(true)} />
                            {onMoveLeft && <Button type="text" size="small" style={{ width: 18, height: 18, padding: 0 }} icon={<ArrowLeftOutlined style={{ fontSize: 10 }} />} onClick={onMoveLeft} />}
                            {onMoveRight && <Button type="text" size="small" style={{ width: 18, height: 18, padding: 0 }} icon={<ArrowRightOutlined style={{ fontSize: 10 }} />} onClick={onMoveRight} />}
                            <Popconfirm title="Remove this tab?" onConfirm={onRemove}>
                                <Button type="text" size="small" danger style={{ width: 18, height: 18, padding: 0 }} icon={<CloseOutlined style={{ fontSize: 10 }} />} />
                            </Popconfirm>
                        </Space>
                    )}
                </>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Section block (grid of entry cells)
// ---------------------------------------------------------------------------
const SectionBlock: React.FC<{
    section: Section; selected: boolean; selEntryId: string | null;
    onSelectSection: () => void; onSelectEntry: (eid: string) => void;
    onUpdate: (id: string, patch: Partial<Section>) => void; onRemove: (id: string) => void;
    onRemoveEntry: (id: string) => void;
    onDrop: (sectionId: string, row: number, col: number, payload: any) => void;
    kindIcon: (k: EntryKind) => React.ReactNode; kindColor: (k: EntryKind) => string; token: any;
}> = ({ section, selected, selEntryId, onSelectSection, onSelectEntry, onUpdate, onRemove, onRemoveEntry, onDrop, kindIcon, kindColor, token }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(section.name);
    const [overCell, setOverCell] = useState<string | null>(null);
    useEffect(() => setName(section.name), [section.name]);

    const maxRow = Math.max(1, ...section.entries.map((e) => e.row));
    const maxCol = Math.max(1, ...section.entries.map((e) => e.column));
    const rows = Math.max(2, maxRow + 1);
    const cols = Math.max(2, maxCol + 1);

    // Column sizing: the trailing column is a narrow (20%) "add column" drop zone
    // when it holds no content in any row; content columns share the rest equally.
    // Once content lands in the last column, all columns distribute proportionally.
    const lastColHasContent = section.entries.some((e) => e.column === cols);
    const colWidth = (c: number): string => {
        if (!lastColHasContent && c === cols) return "20%";
        const shareCols = lastColHasContent ? cols : cols - 1;
        const avail = lastColHasContent ? 100 : 80;
        return `${avail / shareCols}%`;
    };

    const commit = () => { setEditing(false); if (name.trim()) onUpdate(section.id, { name: name.trim() }); };

    const handleCellDrop = (e: React.DragEvent, row: number, col: number) => {
        e.preventDefault(); e.stopPropagation();
        setOverCell(null);
        try { onDrop(section.id, row, col, JSON.parse(e.dataTransfer.getData("text/plain") || "{}")); }
        catch { /* ignore malformed drag payload */ }
    };

    return (
        <div onClick={onSelectSection} style={{
            border: `${selected ? 2 : 1}px solid ${selected ? token.colorPrimary : token.colorBorder}`,
            borderRadius: 8, background: token.colorBgContainer, flex: 1, minWidth: 200, overflow: "hidden", cursor: "pointer",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: token.colorFillAlter, borderBottom: `1px solid ${token.colorBorderSecondary}`, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                {editing ? (
                    <Input size="small" value={name} autoFocus style={{ flex: 1, minWidth: 80 }}
                        onChange={(e) => setName(e.target.value)} onBlur={commit} onPressEnter={commit} />
                ) : (
                    <Text strong style={{ flex: 1, fontSize: 13, color: token.colorPrimary, cursor: "text", minWidth: 60 }}
                        onClick={() => setEditing(true)}>{section.name}</Text>
                )}
                <Space size={2}>
                    <Tooltip title="Move up"><Button size="small" type="text" icon={<ArrowUpOutlined />} onClick={() => onUpdate(section.id, { grid_row: Math.max(1, section.grid_row - 1) })} /></Tooltip>
                    <Tooltip title="Move down"><Button size="small" type="text" icon={<ArrowDownOutlined />} onClick={() => onUpdate(section.id, { grid_row: section.grid_row + 1 })} /></Tooltip>
                    <Tooltip title="Move left"><Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => onUpdate(section.id, { grid_col: Math.max(1, section.grid_col - 1) })} /></Tooltip>
                    <Tooltip title="Move right"><Button size="small" type="text" icon={<ArrowRightOutlined />} onClick={() => onUpdate(section.id, { grid_col: section.grid_col + 1 })} /></Tooltip>
                    <Popconfirm title="Remove section?" onConfirm={() => onRemove(section.id)}>
                        <Button size="small" type="text" danger icon={<CloseOutlined />} />
                    </Popconfirm>
                </Space>
                <Text type="secondary" style={{ fontSize: 10 }}>r{section.grid_row}/c{section.grid_col}</Text>
            </div>
            <div style={{ padding: 6, overflowX: "auto" }} onClick={(e) => e.stopPropagation()}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, tableLayout: "fixed" }}>
                    <colgroup>
                        {Array.from({ length: cols }).map((_, ci) => <col key={ci} style={{ width: colWidth(ci + 1) }} />)}
                    </colgroup>
                    <tbody>
                        {Array.from({ length: rows }).map((_, ri) => (
                            <tr key={ri}>
                                {Array.from({ length: cols }).map((__, ci) => {
                                    const row = ri + 1, col = ci + 1;
                                    const cellId = `${row}:${col}`;
                                    const isOver = overCell === cellId;
                                    const cell = section.entries.filter((e) => e.row === row && e.column === col);
                                    return (
                                        <td key={ci}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (overCell !== cellId) setOverCell(cellId); }}
                                            onDragLeave={() => { if (overCell === cellId) setOverCell(null); }}
                                            onDrop={(e) => handleCellDrop(e, row, col)}
                                            style={{
                                                verticalAlign: "top", padding: 4, borderRadius: 4, minWidth: 60, height: 36,
                                                border: `1px dashed ${isOver ? token.colorPrimary : token.colorBorderSecondary}`,
                                                background: isOver ? token.colorPrimaryBg : (cell.length ? "transparent" : token.colorBgLayout),
                                                transition: "background 0.12s, border-color 0.12s",
                                            }}>
                                            {cell.length === 0 ? (
                                                <div style={{ textAlign: "center", color: token.colorTextQuaternary, fontSize: 10, pointerEvents: "none" }}>
                                                    {isOver ? "Drop here" : `r${row} c${col}`}
                                                </div>
                                            ) : cell.map((e) => (
                                                <div key={e.id}
                                                    draggable
                                                    onDragStart={(ev) => { ev.stopPropagation(); ev.dataTransfer.effectAllowed = "all"; ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "move", entryId: e.id })); }}
                                                    onClick={() => onSelectEntry(e.id)}
                                                    style={{
                                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, padding: "2px 6px", marginBottom: 2,
                                                        borderRadius: 4, cursor: "grab", fontSize: 12,
                                                        border: `1px solid ${e.id === selEntryId ? token.colorPrimary : token.colorBorderSecondary}`,
                                                        background: e.id === selEntryId ? token.colorPrimaryBg : token.colorBgContainer,
                                                    }}>
                                                    <Tag icon={kindIcon(e.kind)} color={kindColor(e.kind)} style={{ margin: 0 }}>{e.label}</Tag>
                                                    <CloseOutlined style={{ fontSize: 10 }} onClick={(ev) => { ev.stopPropagation(); onRemoveEntry(e.id); }} />
                                                </div>
                                            ))}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Right properties panel
// ---------------------------------------------------------------------------
const PropertiesPanel: React.FC<{
    selEntry: Entry | null; selSection: Section | null; viewType: string;
    onUpdateEntry: (id: string, patch: Partial<Entry>) => void; onRemoveEntry: (id: string) => void;
    onUpdateSection: (id: string, patch: Partial<Section>) => void; onRemoveSection: (id: string) => void;
    kindColor: (k: EntryKind) => string;
}> = ({ selEntry, selSection, viewType, onUpdateEntry, onRemoveEntry, onUpdateSection, onRemoveSection, kindColor }) => {
    if (selEntry) {
        // View-type options depend on the element kind (field / relation / nlsentence).
        const viewOpts = selEntry.kind === "relation"
            ? RELATION_VIEW_TYPES
            : selEntry.kind === "nlsentence"
                ? NLSENTENCE_VIEW_TYPES
                : (viewType === "edit" ? FIELD_VIEW_TYPES_EDIT : FIELD_VIEW_TYPES_SHOW);
        const kindLabel = selEntry.kind === "relation" ? "Relation" : selEntry.kind === "nlsentence" ? "NL Sentence" : "Field";
        return (
            <div>
                <Title level={5}>
                    <Tag color={kindColor(selEntry.kind)}>{kindLabel}</Tag> {selEntry.label}
                </Title>
                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">Label</Text>
                    <Input value={selEntry.label} onChange={(e) => onUpdateEntry(selEntry.id, { label: e.target.value })} />
                </div>

                {/* show_label: not relevant for NL sentences (they render their own block) */}
                {selEntry.kind !== "nlsentence" && (
                    <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Text type="secondary">Show label</Text>
                        <Switch checked={selEntry.show_label} onChange={(v) => onUpdateEntry(selEntry.id, { show_label: v })} />
                    </div>
                )}

                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">
                        {selEntry.kind === "relation" ? "Relation view type"
                            : selEntry.kind === "nlsentence" ? "NL Chat view type" : "Field view type"}
                    </Text>
                    <Select allowClear showSearch placeholder="default" value={selEntry.view_type} style={{ width: "100%" }}
                        options={viewOpts.map((v) => ({ label: v, value: v }))}
                        onChange={(v) => onUpdateEntry(selEntry.id, { view_type: v })} />
                </div>

                {/* Relations can cap the number of related rows shown */}
                {selEntry.kind === "relation" && (
                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary">Row limit</Text>
                        <Input type="number" min={1} placeholder="no limit" value={selEntry.limit ?? ""} style={{ width: "100%" }}
                            onChange={(e) => onUpdateEntry(selEntry.id, { limit: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })} />
                    </div>
                )}

                <Space style={{ marginBottom: 12 }}>
                    <span><Text type="secondary">Row</Text><br />
                        <Input type="number" min={1} value={selEntry.row} style={{ width: 80 }}
                            onChange={(e) => onUpdateEntry(selEntry.id, { row: Math.max(1, Number(e.target.value) || 1) })} /></span>
                    <span><Text type="secondary">Column</Text><br />
                        <Input type="number" min={1} value={selEntry.column} style={{ width: 80 }}
                            onChange={(e) => onUpdateEntry(selEntry.id, { column: Math.max(1, Number(e.target.value) || 1) })} /></span>
                </Space>
                <Popconfirm title="Remove this entry?" onConfirm={() => onRemoveEntry(selEntry.id)}>
                    <Button danger block icon={<DeleteOutlined />}>Remove from section</Button>
                </Popconfirm>
            </div>
        );
    }
    if (selSection) {
        return (
            <div>
                <Title level={5}>Section: {selSection.name}</Title>
                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">Name</Text>
                    <Input value={selSection.name} onChange={(e) => onUpdateSection(selSection.id, { name: e.target.value })} />
                </div>
                <Space style={{ marginBottom: 12 }}>
                    <span><Text type="secondary">Grid row</Text><br />
                        <Input type="number" min={1} value={selSection.grid_row} style={{ width: 90 }}
                            onChange={(e) => onUpdateSection(selSection.id, { grid_row: Math.max(1, Number(e.target.value) || 1) })} /></span>
                    <span><Text type="secondary">Grid col</Text><br />
                        <Input type="number" min={1} value={selSection.grid_col} style={{ width: 90 }}
                            onChange={(e) => onUpdateSection(selSection.id, { grid_col: Math.max(1, Number(e.target.value) || 1) })} /></span>
                </Space>
                <Popconfirm title="Remove this section?" onConfirm={() => onRemoveSection(selSection.id)}>
                    <Button danger block icon={<DeleteOutlined />}>Remove section</Button>
                </Popconfirm>
            </div>
        );
    }
    return <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
        Select a section or an entry on the canvas to edit its properties.
    </div>;
};

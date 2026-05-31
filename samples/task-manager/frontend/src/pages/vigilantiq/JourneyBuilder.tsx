/**
 * VigilantIQ Journey Builder.
 *
 * Visual journey-definition designer that mimics the JuiceMantics layout:
 *   - A journey list to pick / create a journey.
 *   - An editor with a "Journey Properties" card on top, and below it a
 *     resizable two-pane area: a design CANVAS on the left and a PROPERTIES
 *     panel on the right.
 *   - The canvas lays steps out in BFS columns from the start step and draws
 *     forward transitions as arrows between columns. Clicking a step node or a
 *     transition arrow shows its editable properties in the right panel.
 *   - The divider between canvas and properties is drag-resizable.
 *
 * Self-contained: @juicemantics/veloiq-ui exports + antd only (no @dnd-kit,
 * no reactflow). Talks to the journey module's /journeys CRUD API.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Typography, Card, Table, Button, Space, Input, InputNumber, Select, AutoComplete, Form, Row, Col,
    Tag, Empty, message, Spin, Popconfirm, theme, Tooltip,
} from "antd";
import {
    BranchesOutlined, PlusOutlined, DeleteOutlined, ArrowRightOutlined,
    ArrowLeftOutlined, SaveOutlined, EditOutlined, SyncOutlined, WarningOutlined,
} from "@ant-design/icons";
import { useMenu } from "@refinedev/core";
import type { ModelDef } from "@juicemantics/veloiq-ui";
import { API_URL, authenticatedFetch, useAllModels } from "@juicemantics/veloiq-ui";

const { Title, Text } = Typography;
const JOURNEYS = `${API_URL}/journeys`;
const VIEW_TYPES = ["create", "edit", "show", "list", "nlchat"];

interface ConditionClause {
    id: string;
    lhs_step_id: string; lhs_field: string;
    operator: string;
    rhs_type: "constant" | "payload";
    rhs_constant: string; rhs_step_id: string; rhs_field: string;
}
interface ConditionDef { clauses: ConditionClause[]; logic: "AND" | "OR"; }

interface StepDef { step_id: string; model_name: string; view_type: string; step_description?: string; }
interface Transition {
    from_step_id: string; to_step_id: string;
    condition?: string; condition_def?: ConditionDef | null;
    routing_strategy?: string; param_mappings?: unknown[];
}
interface JourneyDef {
    journey_id: string; name: string; description?: string; module?: string;
    allowed_roles?: string[]; start_step_id: string;
    steps: Record<string, StepDef>; transitions: Transition[];
}

type PanelView =
    | { mode: "empty" }
    | { mode: "step"; stepId: string }
    | { mode: "transition"; idx: number }
    | { mode: "new-step" }
    | { mode: "new-transition" };

const emptyJourney = (): JourneyDef => ({
    journey_id: "", name: "", description: "", module: "",
    allowed_roles: [], start_step_id: "", steps: {}, transitions: [],
});

// ---------------------------------------------------------------------------
// Condition builder — visual clause editor for transition conditions
// (mimics the JuiceMantics ConditionBuilder)
// ---------------------------------------------------------------------------
const newClause = (): ConditionClause => ({
    id: `${Date.now()}-${Math.random()}`,
    lhs_step_id: "", lhs_field: "", operator: "==",
    rhs_type: "constant", rhs_constant: "", rhs_step_id: "", rhs_field: "",
});

const getFieldType = (model: ModelDef | undefined, fieldKey: string): string => {
    if (!model || !fieldKey) return "string";
    const field = model.fields?.find((f) => f.key === fieldKey);
    const t = (field?.type || "").toLowerCase();
    if (t === "bool" || t === "boolean") return "boolean";
    if (t.includes("int") || t === "number" || t.includes("float") || t.includes("decimal")) return "number";
    return "string";
};

const operatorsForType = (type: string): { label: string; value: string }[] => {
    if (type === "boolean") return [{ label: "is", value: "==" }];
    if (type === "number") return [
        { label: "= (equals)", value: "==" }, { label: "≠ (not equals)", value: "!=" },
        { label: "> (greater than)", value: ">" }, { label: "≥ (at least)", value: ">=" },
        { label: "< (less than)", value: "<" }, { label: "≤ (at most)", value: "<=" },
    ];
    return [
        { label: "= (equals)", value: "==" }, { label: "≠ (not equals)", value: "!=" },
        { label: "contains", value: "contains" }, { label: "starts with", value: "startswith" },
        { label: "ends with", value: "endswith" },
    ];
};

const clauseToString = (c: ConditionClause, fieldType: string): string => {
    if (!c.lhs_step_id || !c.lhs_field || !c.operator) return "";
    const lhs = `payload.${c.lhs_step_id}.${c.lhs_field}`;
    let rhs: string;
    if (c.rhs_type === "payload") {
        if (!c.rhs_step_id || !c.rhs_field) return "";
        rhs = `payload.${c.rhs_step_id}.${c.rhs_field}`;
    } else {
        const val = c.rhs_constant;
        if (val === "" || val == null) return "";
        rhs = (fieldType === "number" || fieldType === "boolean") ? val : `"${val.replace(/"/g, '\\"')}"`;
    }
    return `${lhs} ${c.operator} ${rhs}`;
};

const isClauseComplete = (c: ConditionClause): boolean => {
    if (!c.lhs_step_id || !c.lhs_field || !c.operator) return false;
    if (c.rhs_type === "payload") return !!(c.rhs_step_id && c.rhs_field);
    return c.rhs_constant !== "" && c.rhs_constant != null;
};

const buildConditionString = (
    def: ConditionDef, steps: Record<string, StepDef>, getModel: (n: string) => ModelDef | undefined,
): string => def.clauses
    .map((c) => clauseToString(c, getFieldType(getModel(steps[c.lhs_step_id]?.model_name ?? ""), c.lhs_field)))
    .filter(Boolean)
    .join(` ${def.logic} `);

const parseConditionToDef = (text: string): ConditionDef | null => {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    let logic: "AND" | "OR" = "AND";
    let parts: string[];
    if (/ OR /i.test(trimmed)) { logic = "OR"; parts = trimmed.split(/ OR /i); }
    else if (/ AND /i.test(trimmed)) { logic = "AND"; parts = trimmed.split(/ AND /i); }
    else parts = [trimmed];
    const OPS = [">=", "<=", "!=", "==", "contains", "startswith", "endswith", ">", "<"];
    const clauses: ConditionClause[] = [];
    for (const part of parts) {
        const m = part.trim().match(/^payload\.(\w+)\.(\w+)\s+(.+)$/);
        if (!m) continue;
        const [, stepId, field, rest] = m;
        let operator = "", rhsRaw = "";
        for (const op of OPS) {
            if (rest.startsWith(op + " ") || rest === op) { operator = op; rhsRaw = rest.slice(op.length).trim(); break; }
        }
        if (!operator) continue;
        const rp = rhsRaw.match(/^payload\.(\w+)\.(\w+)$/);
        let rhs_type: "constant" | "payload" = "constant", rhs_constant = "", rhs_step_id = "", rhs_field = "";
        if (rp) { rhs_type = "payload"; rhs_step_id = rp[1]; rhs_field = rp[2]; }
        else if ((rhsRaw.startsWith('"') && rhsRaw.endsWith('"')) || (rhsRaw.startsWith("'") && rhsRaw.endsWith("'")))
            rhs_constant = rhsRaw.slice(1, -1);
        else rhs_constant = rhsRaw;
        clauses.push({ id: `${Date.now()}-${Math.random()}`, lhs_step_id: stepId, lhs_field: field, operator, rhs_type, rhs_constant, rhs_step_id, rhs_field });
    }
    return clauses.length > 0 ? { clauses, logic } : null;
};

const ConditionBuilder: React.FC<{
    condition: string;
    conditionDef: ConditionDef | null;
    steps: Record<string, StepDef>;
    allModels: ModelDef[];
    onChange: (condition: string, def: ConditionDef | null) => void;
}> = ({ condition, conditionDef, steps, allModels, onChange }) => {
    const getModel = useCallback((name: string) =>
        allModels.find((m) => (m.resource || m.name).toLowerCase() === name.toLowerCase()
            || m.name.toLowerCase() === name.toLowerCase()), [allModels]);

    const initial = useMemo(() => (conditionDef && conditionDef.clauses.length > 0) ? conditionDef : parseConditionToDef(condition), []);
    const [clauses, setClauses] = useState<ConditionClause[]>(initial?.clauses ?? []);
    const [logic, setLogic] = useState<"AND" | "OR">(initial?.logic ?? "AND");

    const stepOptions = useMemo(() => Object.keys(steps).map((id) => ({ value: id, label: id })), [steps]);
    const fieldOptionsFor = useCallback((stepId: string) => {
        const model = getModel(steps[stepId]?.model_name ?? "");
        return (model?.fields ?? []).map((f) => ({ value: f.key, label: f.label || f.key }));
    }, [steps, getModel]);

    const push = useCallback((next: ConditionClause[], nextLogic: "AND" | "OR", keepText?: boolean) => {
        const def: ConditionDef = { clauses: next, logic: nextLogic };
        const allComplete = next.length > 0 && next.every(isClauseComplete);
        const str = allComplete ? buildConditionString(def, steps, getModel) : "";
        onChange(str || (keepText ? condition : ""), next.length > 0 ? def : null);
    }, [steps, getModel, onChange, condition]);

    const updateClause = (id: string, patch: Partial<ConditionClause>) => {
        const next = clauses.map((c) => c.id === id ? { ...c, ...patch } : c);
        setClauses(next); push(next, logic, true);
    };
    const addClause = () => { const next = [...clauses, newClause()]; setClauses(next); onChange(condition, { clauses: next, logic }); };
    const removeClause = (id: string) => { const next = clauses.filter((c) => c.id !== id); setClauses(next); push(next, logic, false); };
    const updateLogic = (next: "AND" | "OR") => { setLogic(next); push(clauses, next, false); };

    const builderStr = useMemo(() => {
        if (clauses.length === 0 || !clauses.every(isClauseComplete)) return null;
        return buildConditionString({ clauses, logic }, steps, getModel);
    }, [clauses, logic, steps, getModel]);
    const outOfSync = builderStr !== null && builderStr !== condition && condition !== "";

    return (
        <div>
            <div style={{ background: "#f9fafb", border: "1px solid #e8e8e8", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: clauses.length > 0 ? 10 : 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, flex: 1, fontWeight: 500 }}>Condition Builder</Text>
                    {clauses.length > 1 && (
                        <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Logic:</Text>
                            <Select size="small" value={logic} onChange={updateLogic} style={{ width: 170 }}
                                options={[{ value: "AND", label: "AND — all must match" }, { value: "OR", label: "OR — any must match" }]} />
                        </Space>
                    )}
                    <Button size="small" icon={<PlusOutlined />} onClick={addClause}>Add clause</Button>
                </div>
                {clauses.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>No clauses yet — add one to build the condition visually, or type it directly below.</Text>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {clauses.map((clause, idx) => {
                            const lhsModel = getModel(steps[clause.lhs_step_id]?.model_name ?? "");
                            const fieldType = getFieldType(lhsModel, clause.lhs_field);
                            let rhsInput: React.ReactNode;
                            if (clause.rhs_type === "payload") {
                                rhsInput = (
                                    <Space.Compact>
                                        <Select size="small" value={clause.rhs_step_id || undefined} placeholder="Step" style={{ width: 120 }}
                                            options={stepOptions} onChange={(v) => updateClause(clause.id, { rhs_step_id: v, rhs_field: "" })} />
                                        <Select size="small" value={clause.rhs_field || undefined} placeholder="Field" style={{ width: 130 }}
                                            options={fieldOptionsFor(clause.rhs_step_id)} disabled={!clause.rhs_step_id}
                                            onChange={(v) => updateClause(clause.id, { rhs_field: v })} />
                                    </Space.Compact>
                                );
                            } else if (fieldType === "boolean") {
                                rhsInput = <Select size="small" value={clause.rhs_constant || undefined} placeholder="Value" style={{ width: 90 }}
                                    options={[{ value: "true", label: "True" }, { value: "false", label: "False" }]}
                                    onChange={(v) => updateClause(clause.id, { rhs_constant: v })} />;
                            } else if (fieldType === "number") {
                                rhsInput = <InputNumber size="small" value={clause.rhs_constant !== "" ? Number(clause.rhs_constant) : undefined}
                                    placeholder="Number" style={{ width: 120 }}
                                    onChange={(v) => updateClause(clause.id, { rhs_constant: v != null ? String(v) : "" })} />;
                            } else {
                                rhsInput = <Input size="small" value={clause.rhs_constant} placeholder="Text value" style={{ width: 140 }}
                                    onChange={(e) => updateClause(clause.id, { rhs_constant: e.target.value })} />;
                            }
                            return (
                                <div key={clause.id}>
                                    {idx > 0 && (
                                        <Tooltip title="Click to toggle AND / OR">
                                            <Tag color={logic === "AND" ? "blue" : "purple"} style={{ cursor: "pointer", marginBottom: 4, fontSize: 11 }}
                                                onClick={() => updateLogic(logic === "AND" ? "OR" : "AND")}>{logic}</Tag>
                                        </Tooltip>
                                    )}
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>payload.</Text>
                                        <Select size="small" value={clause.lhs_step_id || undefined} placeholder="step" style={{ width: 130 }} showSearch
                                            options={stepOptions}
                                            onChange={(v) => updateClause(clause.id, { lhs_step_id: v, lhs_field: "", operator: "==", rhs_constant: "", rhs_step_id: "", rhs_field: "" })} />
                                        <Text type="secondary" style={{ fontSize: 11 }}>.</Text>
                                        <Select size="small" value={clause.lhs_field || undefined} placeholder="field" style={{ width: 150 }} showSearch
                                            options={fieldOptionsFor(clause.lhs_step_id)} disabled={!clause.lhs_step_id}
                                            onChange={(v) => updateClause(clause.id, { lhs_field: v, operator: operatorsForType(getFieldType(lhsModel, v))[0]?.value ?? "==" })} />
                                        <Select size="small" value={clause.operator} style={{ width: 150 }}
                                            options={operatorsForType(fieldType)} onChange={(v) => updateClause(clause.id, { operator: v })} />
                                        <Select size="small" value={clause.rhs_type} style={{ width: 130 }}
                                            options={[{ value: "constant", label: "Value" }, { value: "payload", label: "Payload field" }]}
                                            onChange={(v: "constant" | "payload") => updateClause(clause.id, { rhs_type: v, rhs_constant: "", rhs_step_id: "", rhs_field: "" })} />
                                        {rhsInput}
                                        <Tooltip title="Remove clause">
                                            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeClause(clause.id)} />
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {outOfSync && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <WarningOutlined style={{ color: "#faad14", fontSize: 12 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>Condition text was edited manually and differs from the builder.</Text>
                    <Button size="small" type="link" icon={<SyncOutlined />} style={{ padding: 0, fontSize: 11, height: "auto" }}
                        onClick={() => onChange(buildConditionString({ clauses, logic }, steps, getModel), { clauses, logic })}>Reset to builder</Button>
                </div>
            )}
            <Input.TextArea rows={2} value={condition} placeholder="payload.step_id.field_name > 0"
                style={{ fontFamily: "monospace", fontSize: 12 }}
                onChange={(e) => {
                    const text = e.target.value;
                    const parsed = parseConditionToDef(text);
                    if (parsed) { setClauses(parsed.clauses); setLogic(parsed.logic); }
                    onChange(text, parsed ?? (clauses.length > 0 ? { clauses, logic } : null));
                }} />
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                Leave blank for the default (fallback) path. Use the builder above or type an expression directly.
            </Text>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Design canvas — BFS-column flow of steps with transition arrows
// ---------------------------------------------------------------------------
const DesignCanvas: React.FC<{
    draft: JourneyDef;
    panelView: PanelView;
    modelLabel: (resource: string) => string;
    onSelectStep: (stepId: string) => void;
    onSelectTransition: (idx: number) => void;
}> = ({ draft, panelView, modelLabel, onSelectStep, onSelectTransition }) => {
    const { token } = theme.useToken();
    const { steps, transitions, start_step_id } = draft;
    const stepIds = Object.keys(steps);
    if (stepIds.length === 0) return null;

    const startId = (start_step_id && steps[start_step_id]) ? start_step_id : stepIds[0];
    const depth: Record<string, number> = { [startId]: 0 };
    const queue = [startId];
    const seen = new Set([startId]);
    const order: string[] = [];
    while (queue.length) {
        const cur = queue.shift()!;
        order.push(cur);
        for (const t of transitions.filter((t) => t.from_step_id === cur)) {
            if (!seen.has(t.to_step_id) && steps[t.to_step_id]) {
                seen.add(t.to_step_id);
                depth[t.to_step_id] = depth[cur] + 1;
                queue.push(t.to_step_id);
            }
        }
    }
    const maxDepth = Math.max(0, ...Object.values(depth));
    stepIds.forEach((sid) => { if (!seen.has(sid)) { depth[sid] = maxDepth + 1; order.push(sid); } });
    const numCols = Math.max(0, ...Object.values(depth)) + 1;
    const columns: string[][] = Array.from({ length: numCols }, () => []);
    order.forEach((sid) => columns[depth[sid]].push(sid));

    const colFwd: { idx: number; t: Transition }[][] = columns.map((ids, ci) =>
        ids.flatMap((from) => transitions
            .map((t, idx) => ({ t, idx }))
            .filter(({ t }) => t.from_step_id === from && steps[t.to_step_id] && depth[t.to_step_id] === ci + 1)));
    const renderedIdx = new Set(colFwd.flat().map((e) => e.idx));
    const extra = transitions.map((t, idx) => ({ t, idx })).filter(({ idx }) => !renderedIdx.has(idx));

    const stepSel = (sid: string) => panelView.mode === "step" && panelView.stepId === sid;
    const transSel = (idx: number) => panelView.mode === "transition" && panelView.idx === idx;

    return (
        <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, overflowX: "auto", paddingBottom: 8 }}>
                {columns.map((ids, ci) => (
                    <React.Fragment key={ci}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {ids.map((sid) => {
                                const step = steps[sid];
                                const sel = stepSel(sid);
                                const isStart = sid === start_step_id;
                                return (
                                    <div key={sid} onClick={() => onSelectStep(sid)} style={{
                                        padding: "8px 14px", borderRadius: 8, minWidth: 130, textAlign: "center", cursor: "pointer",
                                        border: sel ? `2px solid ${token.colorPrimary}` : `1.5px solid ${isStart ? token.colorPrimary : token.colorBorder}`,
                                        background: sel || isStart ? token.colorPrimaryBg : token.colorBgContainer,
                                        boxShadow: sel ? `0 0 0 3px ${token.colorPrimaryBgHover}` : "0 1px 3px rgba(0,0,0,0.06)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                                            <Text style={{ fontSize: 13 }}>{sid}</Text>
                                            {isStart && <Tag color="green" style={{ fontSize: 10, margin: 0 }}>START</Tag>}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{modelLabel(step.model_name)}</Text>
                                            <Tag style={{ fontSize: 10, margin: 0 }}>{step.view_type}</Tag>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {ci < columns.length - 1 && (
                            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignSelf: "stretch", gap: 4, padding: "0 2px", minWidth: 44 }}>
                                {colFwd[ci].map(({ t, idx }) => (
                                    <div key={idx} onClick={() => onSelectTransition(idx)} style={{
                                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer",
                                        padding: "4px 6px", borderRadius: 6,
                                        background: transSel(idx) ? token.colorPrimaryBg : "transparent",
                                        border: `1px solid ${transSel(idx) ? token.colorPrimary : "transparent"}`,
                                    }}>
                                        <ArrowRightOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                                        {t.condition && <Text type="secondary" style={{ fontSize: 9, maxWidth: 80, textAlign: "center", wordBreak: "break-all" }}>{t.condition.slice(0, 30)}</Text>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            {extra.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Other transitions</Text>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {extra.map(({ t, idx }) => (
                            <Tag key={idx} onClick={() => onSelectTransition(idx)} style={{ cursor: "pointer" }}
                                 color={transSel(idx) ? "blue" : "default"}>
                                {t.from_step_id} → {t.to_step_id}
                            </Tag>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function JourneyBuilder() {
    const allModels = useAllModels();
    const { menuItems } = useMenu();
    const { token } = theme.useToken();
    const [journeys, setJourneys] = useState<JourneyDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<JourneyDef | null>(null); // null = list view
    const [isNew, setIsNew] = useState(false);
    const [panelView, setPanelView] = useState<PanelView>({ mode: "empty" });
    const [pendingStep, setPendingStep] = useState<StepDef>({ step_id: "", model_name: "", view_type: "create", step_description: "" });
    const [pendingTrans, setPendingTrans] = useState<Transition>({ from_step_id: "", to_step_id: "" });

    // resizable splitter
    const containerRef = useRef<HTMLDivElement>(null);
    const [splitPercent, setSplitPercent] = useState(62);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitPercent(Math.min(82, Math.max(30, pct)));
        };
        const onUp = () => setDragging(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [dragging]);

    const modelOptions = useMemo(() => allModels.filter((m) => !m.hideInMenu)
        .map((m) => ({ label: m.label || m.name, value: m.resource || m.name })), [allModels]);
    // Module options come from the app's actual menu modules (keys "module:{name}")
    // so a journey's module matches the key the sidebar/top menu injects under.
    // Falls back to any ModelDef.module. The field is free-text (AutoComplete),
    // so a module can always be typed even if no suggestion is detected.
    const moduleOptions = useMemo(() => {
        const opts: { label: string; value: string }[] = [];
        const add = (value: string, label?: string) => {
            if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: label || value });
        };
        const walk = (items: any[]) => (items || []).forEach((it) => {
            const key = String(it?.key || it?.name || "");
            if (key.startsWith("module:")) add(key.slice("module:".length), typeof it.label === "string" ? it.label : undefined);
            if (it?.children?.length) walk(it.children);
        });
        walk(menuItems || []);
        allModels.forEach((m) => { if (m.module) add(m.module); });
        return opts.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }, [menuItems, allModels]);
    const modelLabel = (resource: string) =>
        allModels.find((m) => (m.resource || m.name) === resource)?.label || resource;

    const load = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${JOURNEYS}?_start=0&_end=200`);
            if (res.ok) { const d = await res.json(); setJourneys(Array.isArray(d) ? d : (d.data ?? [])); }
        } catch { message.error("Failed to load journeys"); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const patch = (p: Partial<JourneyDef>) => setDraft((d) => d ? { ...d, ...p } : d);
    const stepOptions = draft ? Object.keys(draft.steps).map((s) => ({ label: s, value: s })) : [];

    const openNew = () => { setDraft(emptyJourney()); setIsNew(true); setPanelView({ mode: "empty" }); };
    const openEdit = (j: JourneyDef) => {
        setDraft({ ...emptyJourney(), ...j, steps: j.steps || {}, transitions: j.transitions || [] });
        setIsNew(false); setPanelView({ mode: "empty" });
    };
    const backToList = () => { setDraft(null); load(); };

    const handleDelete = async (id: string) => {
        const res = await authenticatedFetch(`${JOURNEYS}/${id}`, { method: "DELETE" });
        if (res.ok) { message.success("Journey deleted"); load(); } else message.error("Delete failed");
    };

    const handleSave = async () => {
        if (!draft) return;
        if (!draft.journey_id || !draft.name) { message.warning("Journey ID and Name are required"); return; }
        const payload = { ...draft, allowed_roles: draft.allowed_roles || [] };
        const url = isNew ? JOURNEYS : `${JOURNEYS}/${draft.journey_id}`;
        const res = await authenticatedFetch(url, {
            method: isNew ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) { message.success(isNew ? "Journey created" : "Journey updated"); setIsNew(false); }
        else message.error(data.detail ?? "Save failed (check for cycles / duplicate id)");
    };

    // step / transition mutations
    const commitStep = (step: StepDef, originalId?: string) => {
        if (!step.step_id || !step.model_name) { message.warning("Step ID and Model are required"); return; }
        setDraft((d) => {
            if (!d) return d;
            const steps = { ...d.steps };
            if (originalId && originalId !== step.step_id) delete steps[originalId];
            steps[step.step_id] = step;
            const start = d.start_step_id || step.step_id;
            return { ...d, steps, start_step_id: start };
        });
        setPanelView({ mode: "step", stepId: step.step_id });
    };
    const removeStep = (sid: string) => {
        setDraft((d) => d ? {
            ...d,
            steps: Object.fromEntries(Object.entries(d.steps).filter(([k]) => k !== sid)),
            transitions: d.transitions.filter((t) => t.from_step_id !== sid && t.to_step_id !== sid),
            start_step_id: d.start_step_id === sid ? "" : d.start_step_id,
        } : d);
        setPanelView({ mode: "empty" });
    };
    const commitTransition = (t: Transition, idx?: number) => {
        if (!t.from_step_id || !t.to_step_id) { message.warning("From and To steps are required"); return; }
        let newIdx = idx;
        setDraft((d) => {
            if (!d) return d;
            const transitions = [...d.transitions];
            if (idx != null) transitions[idx] = t;
            else { transitions.push(t); newIdx = transitions.length - 1; }
            return { ...d, transitions };
        });
        // Keep the properties panel open on the (possibly new) transition so the
        // condition builder edits persist live without closing the editor.
        setPanelView({ mode: "transition", idx: newIdx ?? 0 });
    };
    const removeTransition = (idx: number) => {
        setDraft((d) => d ? { ...d, transitions: d.transitions.filter((_, i) => i !== idx) } : d);
        setPanelView({ mode: "empty" });
    };

    if (loading) return <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>;

    // ---- LIST VIEW ----
    if (!draft) {
        const columns = [
            { title: "ID", dataIndex: "journey_id", render: (v: string) => <Text code>{v}</Text> },
            { title: "Name", dataIndex: "name" },
            { title: "Module", dataIndex: "module", render: (v: string) => v ? <Tag>{v}</Tag> : "—" },
            { title: "Steps", render: (_: unknown, j: JourneyDef) => Object.keys(j.steps || {}).length },
            { title: "Actions", render: (_: unknown, j: JourneyDef) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(j)}>Edit</Button>
                    <Popconfirm title="Delete this journey?" onConfirm={() => handleDelete(j.journey_id)}>
                        <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                    </Popconfirm>
                </Space>
            ) },
        ];
        return (
            <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Title level={3}><BranchesOutlined /> Journey Builder</Title>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>New Journey</Button>
                </Space>
                <Card size="small">
                    <Table rowKey="journey_id" dataSource={journeys} columns={columns} pagination={false}
                           size="small" locale={{ emptyText: "No journeys defined yet" }} />
                </Card>
            </div>
        );
    }

    // ---- EDITOR VIEW ----
    return (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 80px)" }}>
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={backToList}>Back</Button>
                    <Title level={4} style={{ margin: 0 }}><BranchesOutlined /> {isNew ? "New Journey" : draft.name}</Title>
                </Space>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save Journey</Button>
            </Space>

            {/* Journey Properties */}
            <Card size="small" title="Journey Properties">
                <Form layout="vertical" size="small">
                    <Row gutter={[12, 0]}>
                        <Col span={6}><Form.Item label="Journey ID" required style={{ marginBottom: 8 }}>
                            <Input value={draft.journey_id} disabled={!isNew}
                                   onChange={(e) => patch({ journey_id: e.target.value })} placeholder="new_item_onboarding" />
                        </Form.Item></Col>
                        <Col span={6}><Form.Item label="Name" required style={{ marginBottom: 8 }}>
                            <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                        </Form.Item></Col>
                        <Col span={6}><Form.Item label="Start Step" style={{ marginBottom: 8 }}>
                            <Select value={draft.start_step_id || undefined} options={stepOptions}
                                    onChange={(v) => patch({ start_step_id: v })} placeholder="Select start step" />
                        </Form.Item></Col>
                        <Col span={6}><Form.Item label="Module" style={{ marginBottom: 8 }}
                            extra={!draft.module ? "Journeys with a module appear under it in the menu" : undefined}>
                            <AutoComplete
                                value={draft.module || undefined}
                                options={moduleOptions}
                                onChange={(v) => patch({ module: v ?? "" })}
                                placeholder="Type or pick a module (e.g. identity)"
                                allowClear
                                style={{ width: "100%" }}
                                filterOption={(input, opt) =>
                                    String(opt?.value ?? "").toLowerCase().includes(input.toLowerCase()) ||
                                    String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item></Col>
                        <Col span={24}><Form.Item label="Description" style={{ marginBottom: 0 }}>
                            <Input value={draft.description || ""} onChange={(e) => patch({ description: e.target.value })} />
                        </Form.Item></Col>
                    </Row>
                </Form>
            </Card>

            {/* Canvas + Properties (resizable) */}
            <div ref={containerRef} style={{ display: "flex", flex: 1, minHeight: 320, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, overflow: "hidden" }}>
                {/* Canvas */}
                <div style={{ flex: `0 0 calc(${splitPercent}% - 3px)`, display: "flex", flexDirection: "column", background: token.colorBgLayout, minWidth: 0 }}>
                    <div style={{ padding: "8px 12px", borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer, display: "flex", gap: 8 }}>
                        <Button size="small" icon={<PlusOutlined />} onClick={() => {
                            setPendingStep({ step_id: "", model_name: "", view_type: "create", step_description: "" });
                            setPanelView({ mode: "new-step" });
                        }}>Add Step</Button>
                        <Button size="small" icon={<PlusOutlined />} disabled={Object.keys(draft.steps).length < 2}
                            onClick={() => { setPendingTrans({ from_step_id: "", to_step_id: "" }); setPanelView({ mode: "new-transition" }); }}>
                            Add Transition
                        </Button>
                    </div>
                    <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
                        {Object.keys(draft.steps).length === 0 ? (
                            <Empty description="Add your first step to get started" style={{ padding: 40 }}>
                                <Button type="primary" size="small" icon={<PlusOutlined />}
                                    onClick={() => { setPendingStep({ step_id: "", model_name: "", view_type: "create", step_description: "" }); setPanelView({ mode: "new-step" }); }}>
                                    Add First Step
                                </Button>
                            </Empty>
                        ) : (
                            <DesignCanvas draft={draft} panelView={panelView} modelLabel={modelLabel}
                                onSelectStep={(sid) => setPanelView({ mode: "step", stepId: sid })}
                                onSelectTransition={(idx) => setPanelView({ mode: "transition", idx })} />
                        )}
                    </div>
                </div>

                {/* Resize divider */}
                <div onMouseDown={(e) => { e.preventDefault(); setDragging(true); }} title="Drag to resize"
                     style={{ flex: "0 0 6px", cursor: "col-resize", background: dragging ? token.colorPrimaryBg : token.colorBorderSecondary }} />

                {/* Properties */}
                <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 12, background: token.colorBgContainer }}>
                    <PropertiesPanel
                        view={panelView} draft={draft} allModels={allModels} modelOptions={modelOptions} stepOptions={stepOptions}
                        pendingStep={pendingStep} setPendingStep={setPendingStep}
                        pendingTrans={pendingTrans} setPendingTrans={setPendingTrans}
                        commitStep={commitStep} removeStep={removeStep}
                        commitTransition={commitTransition} removeTransition={removeTransition}
                    />
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Right properties panel
// ---------------------------------------------------------------------------
const PropertiesPanel: React.FC<{
    view: PanelView; draft: JourneyDef; allModels: ModelDef[];
    modelOptions: { label: string; value: string }[];
    stepOptions: { label: string; value: string }[];
    pendingStep: StepDef; setPendingStep: (s: StepDef) => void;
    pendingTrans: Transition; setPendingTrans: (t: Transition) => void;
    commitStep: (s: StepDef, originalId?: string) => void; removeStep: (sid: string) => void;
    commitTransition: (t: Transition, idx?: number) => void; removeTransition: (idx: number) => void;
}> = (p) => {
    const { view, draft, modelOptions, stepOptions } = p;

    if (view.mode === "empty")
        return <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
            Click a step or transition on the canvas to edit its properties, or use Add Step / Add Transition.
        </div>;

    if (view.mode === "new-step" || view.mode === "step") {
        const isNewStep = view.mode === "new-step";
        const original = view.mode === "step" ? draft.steps[view.stepId] : undefined;
        const s = isNewStep ? p.pendingStep : (original ?? p.pendingStep);
        const set = (patch: Partial<StepDef>) => {
            const next = { ...s, ...patch };
            if (isNewStep) p.setPendingStep(next);
            else p.commitStep(next, view.mode === "step" ? view.stepId : undefined);
        };
        return (
            <div>
                <Title level={5}>{isNewStep ? "New Step" : `Step: ${(view as any).stepId}`}</Title>
                <Form layout="vertical" size="small">
                    <Form.Item label="Step ID" required>
                        <Input value={s.step_id} onChange={(e) => isNewStep ? p.setPendingStep({ ...s, step_id: e.target.value }) : set({ step_id: e.target.value })} />
                    </Form.Item>
                    <Form.Item label="Model" required>
                        <Select value={s.model_name || undefined} options={modelOptions} showSearch
                                onChange={(v) => isNewStep ? p.setPendingStep({ ...s, model_name: v }) : set({ model_name: v })} />
                    </Form.Item>
                    <Form.Item label="View Type" required>
                        <Select value={s.view_type} options={VIEW_TYPES.map((v) => ({ label: v, value: v }))}
                                onChange={(v) => isNewStep ? p.setPendingStep({ ...s, view_type: v }) : set({ view_type: v })} />
                    </Form.Item>
                    <Form.Item label="Description">
                        <Input value={s.step_description || ""} onChange={(e) => isNewStep ? p.setPendingStep({ ...s, step_description: e.target.value }) : set({ step_description: e.target.value })} />
                    </Form.Item>
                    {isNewStep ? (
                        <Button type="primary" block onClick={() => p.commitStep(p.pendingStep)}>Add Step</Button>
                    ) : (
                        <Popconfirm title="Remove this step?" onConfirm={() => p.removeStep((view as any).stepId)}>
                            <Button danger block icon={<DeleteOutlined />}>Remove Step</Button>
                        </Popconfirm>
                    )}
                </Form>
            </div>
        );
    }

    // transition / new-transition
    const isNewT = view.mode === "new-transition";
    const original = view.mode === "transition" ? draft.transitions[view.idx] : undefined;
    const t = isNewT ? p.pendingTrans : (original ?? p.pendingTrans);
    const setT = (patch: Partial<Transition>) => {
        const next = { ...t, ...patch };
        if (isNewT) p.setPendingTrans(next);
        else p.commitTransition(next, (view as any).idx);
    };
    return (
        <div>
            <Title level={5}>{isNewT ? "New Transition" : "Transition"}</Title>
            <Form layout="vertical" size="small">
                <Form.Item label="From Step" required>
                    <Select value={t.from_step_id || undefined} options={stepOptions}
                            onChange={(v) => isNewT ? p.setPendingTrans({ ...t, from_step_id: v }) : setT({ from_step_id: v })} />
                </Form.Item>
                <Form.Item label="To Step" required>
                    <Select value={t.to_step_id || undefined} options={stepOptions}
                            onChange={(v) => isNewT ? p.setPendingTrans({ ...t, to_step_id: v }) : setT({ to_step_id: v })} />
                </Form.Item>
                <Form.Item label="Condition (optional)">
                    <ConditionBuilder
                        key={isNewT ? "new-transition" : `transition-${(view as any).idx}`}
                        condition={t.condition || ""}
                        conditionDef={t.condition_def ?? null}
                        steps={draft.steps}
                        allModels={p.allModels}
                        onChange={(condition, def) => {
                            if (isNewT) p.setPendingTrans({ ...t, condition, condition_def: def });
                            else setT({ condition, condition_def: def });
                        }}
                    />
                </Form.Item>
                {isNewT ? (
                    <Button type="primary" block onClick={() => p.commitTransition(p.pendingTrans)}>Add Transition</Button>
                ) : (
                    <Popconfirm title="Remove this transition?" onConfirm={() => p.removeTransition((view as any).idx)}>
                        <Button danger block icon={<DeleteOutlined />}>Remove Transition</Button>
                    </Popconfirm>
                )}
            </Form>
        </div>
    );
};

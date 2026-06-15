import { useEffect, useState } from "react";
import { AppSchema, FieldInfo, ModelInfo, ModuleInfo, NamedQueryDef, RelationInfo } from "../types";
import CommandCard, { CommandDef } from "../components/CommandCard";
import NamedQueryCreator from "../components/NamedQueryCreator";
import { api } from "../api";

const FIELD_TYPES = [
  "text", "textarea", "richtext", "email", "password", "url", "phone",
  "number", "integer", "decimal", "boolean", "date", "datetime", "time",
  "select", "multiselect", "file", "image", "uuid", "json", "color",
];

function addModelDef(modules: string[]): CommandDef {
  return {
    id: "add-model", label: "Add Model", description: "Scaffold a new model in this module",
    inputs: [
      { key: "name", label: "Model name", type: "text", required: true, placeholder: "e.g. Product" },
      { key: "module", label: "Module", type: modules.length ? "select" : "text", options: modules, required: true },
    ],
    build: (v) => `veloiq add-model ${v.name} --module ${v.module} --no-migrate`,
  };
}

function addFieldDef(resources: string[]): CommandDef {
  return {
    id: "add-field", label: "Add Field", description: "Add a typed column to this model",
    inputs: [
      { key: "resource", label: "Resource", type: resources.length ? "select" : "text", options: resources, required: true },
      { key: "name", label: "Field name", type: "text", required: true, placeholder: "e.g. price" },
      { key: "type", label: "Field type", type: "select", options: FIELD_TYPES, required: true },
      { key: "nullable", label: "Nullable", type: "select", options: ["optional", "required"] },
      { key: "literals", label: "Literals", type: "text", placeholder: "e.g. todo,in_progress,done" },
      { key: "default", label: "Default value", type: "text", placeholder: "e.g. todo" },
    ],
    build: (v) => {
      let cmd = `veloiq add-field ${v.resource} ${v.name} ${v.type}`;
      if (v.nullable === "required") cmd += " --required";
      if (v.literals?.trim()) cmd += ` --options ${v.literals.split(",").map((s) => s.trim()).filter(Boolean).join(",")}`;
      if (v.default?.trim()) cmd += ` --default ${v.default.trim()}`;
      cmd += " --no-migrate";
      return cmd;
    },
  };
}

function addRelationDef(models: string[]): CommandDef {
  return {
    id: "add-relation", label: "Add Relation", description: "Add a relation from this model to another",
    inputs: [
      { key: "model", label: "From model", type: models.length ? "select" : "text", options: models, required: true },
      { key: "target", label: "To model", type: models.length ? "select" : "text", options: models, required: true },
      { key: "type", label: "Relation type", type: "select", options: ["many-to-one", "many-to-many"] },
      { key: "min_items", label: "Min items", type: "text", placeholder: "0 (default)" },
      { key: "max_items", label: "Max items", type: "text", placeholder: "unlimited (default)" },
    ],
    build: (v) => {
      const cliType = v.type === "many-to-many" ? "many-to-many" : "fk";
      let cmd = `veloiq add-relation ${v.model} ${v.target}`;
      if (cliType !== "fk") cmd += ` --type ${cliType}`;
      if (v.min_items?.trim()) cmd += ` --min-items ${v.min_items.trim()}`;
      if (v.max_items?.trim()) cmd += ` --max-items ${v.max_items.trim()}`;
      cmd += " --no-migrate";
      return cmd;
    },
  };
}

const PAGE_TYPES = ["list", "show", "edit", "create"];

function scaffoldPageDef(resources: string[]): CommandDef {
  return {
    id: "scaffold-page", label: "Scaffold Page", description: "Generate a custom React page for this model",
    inputs: [
      { key: "resource", label: "Resource", type: resources.length ? "select" : "text", options: resources, required: true },
      { key: "page_type", label: "Page type", type: "select", options: PAGE_TYPES, required: true },
    ],
    build: (v) => `veloiq scaffold-page ${v.resource} ${v.page_type}`,
  };
}

// ── Relation graph ────────────────────────────────────────────────────────────

type EdgeType = "many-to-one" | "one-to-many" | "many-to-many" | "self-ref" | "referenced-by";

interface GraphEdge {
  label: string;
  target: string;
  targetLabel: string;
  edgeType: EdgeType;
}

const EDGE_COLORS: Record<EdgeType, string> = {
  "many-to-one": "#1677ff",
  "one-to-many": "#52c41a",
  "many-to-many": "#722ed1",
  "self-ref": "#fa8c16",
  "referenced-by": "#64748b",
};

function splitLabel(text: string, maxChars = 10): string[] {
  const words = text.replace(/_/g, " ").split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function buildEdges(model: ModelInfo): GraphEdge[] {
  const fkEdges: GraphEdge[] = model.fields
    .filter((f: FieldInfo) => f.reference)
    .map((f: FieldInfo) => ({
      label: f.label.replace(/ Id$/, ""),
      target: f.reference!,
      targetLabel: f.reference!,
      edgeType: "many-to-one" as EdgeType,
    }));

  const ormEdges: GraphEdge[] = model.relations.map((r: RelationInfo) => ({
    label: r.label,
    target: r.resource,
    targetLabel: r.label,
    edgeType: (r.is_recursive ? "self-ref" : r.resource_path ? "many-to-many" : "one-to-many") as EdgeType,
  }));

  const revEdges: GraphEdge[] = model.referenced_by.map(([mn, fk, resource]) => ({
    label: fk,
    target: resource || mn,
    targetLabel: mn,
    edgeType: "referenced-by" as EdgeType,
  }));

  return [...fkEdges, ...ormEdges, ...revEdges];
}

function RelationGraph({ model, onNavigate }: {
  model: ModelInfo;
  onNavigate?: (resource: string) => void;
}) {
  const edges = buildEdges(model);
  if (edges.length === 0) return <div className="vs-empty">No relations defined.</div>;

  const W = 700, H = 400;
  const cx = W / 2, cy = H / 2;
  const R_CENTER = 42, R_SAT = 30;
  const ORBIT = Math.min(160, (Math.min(W, H) / 2) - R_SAT - 20);
  const n = edges.length;

  const satellites = edges.map((e, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const sx = cx + ORBIT * Math.cos(angle);
    const sy = cy + ORBIT * Math.sin(angle);
    const color = EDGE_COLORS[e.edgeType];
    return { ...e, sx, sy, color };
  });

  const centerLines = splitLabel(model.label, 10);
  const centerY0 = cy - (centerLines.length - 1) * 7;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", minHeight: 260 }}>
      {/* Edges */}
      {satellites.map((s, i) => {
        const dx = s.sx - cx, dy = s.sy - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const x1 = cx + dx / dist * R_CENTER;
        const y1 = cy + dy / dist * R_CENTER;
        const x2 = s.sx - dx / dist * R_SAT;
        const y2 = s.sy - dy / dist * R_SAT;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dashed = s.edgeType === "referenced-by";
        const shortLabel = s.label.length > 15 ? s.label.slice(0, 14) + "…" : s.label;
        return (
          <g key={i}>
            <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
              stroke={s.color} strokeWidth={1.5} strokeDasharray={dashed ? "4 2" : undefined} />
            <text x={mx.toFixed(1)} y={(my - 5).toFixed(1)} textAnchor="middle"
              fill={s.color} fontSize={9} fontFamily="sans-serif">{shortLabel}</text>
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={R_CENTER} fill="#1677ff" stroke="#0958d9" strokeWidth={2} />
      <text x={cx} y={centerY0} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={11} fontWeight="bold" fontFamily="sans-serif">
        {centerLines.map((line, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : 14}>{line}</tspan>
        ))}
      </text>

      {/* Satellite nodes */}
      {satellites.map((s, i) => {
        const lines = splitLabel(s.targetLabel, 9);
        const y0 = s.sy - (lines.length - 1) * 6;
        const clickable = !!onNavigate;
        return (
          <g key={i} style={{ cursor: clickable ? "pointer" : "default" }}
            onClick={clickable ? () => onNavigate!(s.target) : undefined}>
            <circle cx={s.sx} cy={s.sy} r={R_SAT} fill={s.color} opacity={0.85}
              stroke={s.color} strokeWidth={1.5} />
            <text x={s.sx} y={y0} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={10} fontFamily="sans-serif">
              {lines.map((line, j) => (
                <tspan key={j} x={s.sx} dy={j === 0 ? 0 : 13}>{line}</tspan>
              ))}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {(["many-to-one", "one-to-many", "many-to-many", "referenced-by"] as EdgeType[])
        .filter((t) => edges.some((e) => e.edgeType === t))
        .map((t, i) => (
          <g key={t} transform={`translate(${12 + i * 115}, ${H - 18})`}>
            <rect width={10} height={10} rx={2} fill={EDGE_COLORS[t]} y={-8} />
            <text x={14} y={0} fontSize={9} fill="#888" fontFamily="sans-serif">{t}</text>
          </g>
        ))}
    </svg>
  );
}

// ── Module detail panel ───────────────────────────────────────────────────────

function ModuleDetail({ mod, allModules, devMode, onSelectModel, onSuccess }: {
  mod: ModuleInfo;
  allModules: string[];
  devMode: boolean;
  onSelectModel: (m: ModelInfo) => void;
  onSuccess?: () => void;
}) {
  return (
    <div className="vs-detail">
      <div className="vs-detail-title">{mod.name}</div>
      <div className="vs-detail-resource">{mod.path}</div>

      <div className="vs-section-title">Models ({mod.models.length})</div>
      {mod.models.length === 0 ? (
        <div className="vs-empty">No models in this module yet.</div>
      ) : (
        <table className="vs-table">
          <thead>
            <tr><th>Model</th><th>Resource</th><th>Fields</th><th>Dashboard</th><th>Search</th></tr>
          </thead>
          <tbody>
            {mod.models.map((m) => (
              <tr key={m.resource} style={{ cursor: "pointer" }} onClick={() => onSelectModel(m)}>
                <td style={{ color: "var(--accent)", fontWeight: 600 }}>{m.label}</td>
                <td><code className="vs-code">{m.resource}</code></td>
                <td style={{ color: "var(--text-muted)" }}>{m.fields.length}</td>
                <td>{m.in_dashboard && <span className="vs-tag vs-tag-info" style={{ fontSize: 11 }}>✓</span>}</td>
                <td>{m.in_search && <span className="vs-tag vs-tag-info" style={{ fontSize: 11 }}>✓</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {devMode && (
        <>
          <div className="vs-section-title" style={{ marginTop: 28 }}>Add Model</div>
          <CommandCard
            def={addModelDef(allModules)}
            prefill={{ module: mod.name }}
            onSuccess={onSuccess}
          />
        </>
      )}
    </div>
  );
}

// ── Named query panel inside ModelDetail ─────────────────────────────────────

function NamedQueriesSection({ model, module, allModelInfos, devMode, onSuccess }: {
  model: ModelInfo;
  module: string;
  allModelInfos: ModelInfo[];
  devMode: boolean;
  onSuccess?: () => void;
}) {
  const [defs, setDefs] = useState<NamedQueryDef[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NamedQueryDef | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.namedQueries()
      .then((r) => setDefs(r.named_queries.filter((d) => d.module === module && d.root_resource === model.resource)))
      .catch((e: Error) => setError(e.message));
  }, [module, model.resource]);

  const refresh = () => {
    setDefs(null);
    setCreating(false);
    setEditing(null);
    api.namedQueries()
      .then((r) => setDefs(r.named_queries.filter((d) => d.module === module && d.root_resource === model.resource)))
      .catch((e: Error) => setError(e.message));
    onSuccess?.();
  };

  const handleDelete = async (def: NamedQueryDef) => {
    if (!confirm(`Delete named query "${def.name}"?`)) return;
    try {
      await api.deleteNamedQuery(module, def.name);
      refresh();
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  if (creating || editing) {
    return (
      <NamedQueryCreator
        rootModel={model}
        module={module}
        allModels={allModelInfos}
        existingDef={editing ?? undefined}
        onSaved={refresh}
        onCancel={() => { setCreating(false); setEditing(null); }}
      />
    );
  }

  return (
    <>
      {error && <div className="vs-error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {defs === null ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
      ) : defs.length === 0 ? (
        <div className="vs-empty" style={{ padding: "12px 0", textAlign: "left" }}>
          No named queries defined for {model.label} yet.
        </div>
      ) : (
        <table className="vs-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr><th>Name</th><th>Label</th><th>Joins</th><th>Fields</th><th></th></tr>
          </thead>
          <tbody>
            {defs.map((d) => (
              <tr key={d.name}>
                <td><code className="vs-code">{d.name}</code></td>
                <td>{d.label}</td>
                <td style={{ color: "var(--text-muted)" }}>{d.joins.map((j) => j.alias).join(", ") || "—"}</td>
                <td style={{ color: "var(--text-muted)" }}>{d.fields.length}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {devMode && (
                    <>
                      <button onClick={() => setEditing(d)} className="vs-nq-action-btn">Edit</button>
                      <button onClick={() => handleDelete(d)} className="vs-nq-action-btn danger">Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {devMode && (
        <button className="vs-nq-add-btn" onClick={() => setCreating(true)}>
          + Create Named Query
        </button>
      )}
    </>
  );
}

// ── Model detail panel ────────────────────────────────────────────────────────

function ModelDetail({ model, mod, allModelInfos, allModels, allResources, devMode, onNavigate, onSuccess }: {
  model: ModelInfo;
  mod: ModuleInfo;
  allModelInfos: ModelInfo[];
  allModels: string[];
  allResources: string[];
  devMode: boolean;
  onNavigate?: (resource: string) => void;
  onSuccess?: () => void;
}) {
  return (
    <div className="vs-detail">
      <div className="vs-detail-title">{model.label}</div>
      <div className="vs-detail-resource">
        resource: {model.resource}&nbsp;·&nbsp;pk: {model.pk_field}&nbsp;·&nbsp;module: {model.module_name}
        {model.in_dashboard && <>&nbsp;·&nbsp;<span className="vs-tag vs-tag-info" style={{ fontSize: 11 }}>dashboard</span></>}
        {model.in_search && <>&nbsp;·&nbsp;<span className="vs-tag vs-tag-info" style={{ fontSize: 11 }}>search</span></>}
      </div>

      {model.description && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          {model.description}
        </p>
      )}

      {/* Fields */}
      {(() => {
        const plainFields = model.fields.filter((f) => !f.reference);
        const fkFields = model.fields.filter((f) => f.reference);
        const totalRelations = fkFields.length + model.relations.length;
        return (
          <>
            <div className="vs-section-title">Fields ({plainFields.length})</div>
            {plainFields.length === 0 ? (
              <div className="vs-empty">No field data — run <code>veloiq generate</code>.</div>
            ) : (
              <table className="vs-table">
                <thead>
                  <tr><th>Key</th><th>Label</th><th>Type</th><th>Flags</th><th>Roles</th></tr>
                </thead>
                <tbody>
                  {plainFields.map((f) => (
                    <tr key={f.key}>
                      <td><code className="vs-code">{f.key}</code></td>
                      <td>{f.label}</td>
                      <td><span className="vs-tag vs-tag-info" style={{ fontSize: 11 }}>{f.type}</span></td>
                      <td>
                        {f.required && <span className="vs-tag vs-tag-warn" style={{ fontSize: 10, marginRight: 3 }}>required</span>}
                        {f.read_only && <span className="vs-tag vs-tag-muted" style={{ fontSize: 10 }}>read-only</span>}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {f.read_roles.length > 0 && `r: ${f.read_roles.join(", ")}`}
                        {f.read_roles.length > 0 && f.write_roles.length > 0 && " · "}
                        {f.write_roles.length > 0 && `w: ${f.write_roles.join(", ")}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Relations */}
            <div className="vs-section-title">Relations ({totalRelations})</div>
            {totalRelations === 0 ? (
              <div className="vs-empty">No relations defined.</div>
            ) : (
              <table className="vs-table">
                <thead>
                  <tr><th>Label</th><th>Target</th><th>Via</th><th>Type</th></tr>
                </thead>
                <tbody>
                  {fkFields.map((f) => (
                    <tr
                      key={f.key}
                      style={onNavigate ? { cursor: "pointer" } : undefined}
                      onClick={onNavigate && f.reference ? () => onNavigate(f.reference!) : undefined}
                    >
                      <td style={{ color: onNavigate ? "var(--accent)" : "var(--text-secondary)" }}>
                        {f.label.replace(/ Id$/, "")}
                      </td>
                      <td><code className="vs-code">{f.reference}</code></td>
                      <td><code className="vs-code">{f.key}</code></td>
                      <td><span className="vs-tag vs-tag-muted" style={{ fontSize: 11 }}>many-to-one</span></td>
                    </tr>
                  ))}
                  {model.relations.map((r, i) => (
                    <tr
                      key={i}
                      style={onNavigate ? { cursor: "pointer" } : undefined}
                      onClick={onNavigate ? () => onNavigate(r.resource) : undefined}
                    >
                      <td style={{ color: onNavigate ? "var(--accent)" : undefined }}>{r.label}</td>
                      <td><code className="vs-code">{r.resource}</code></td>
                      <td><code className="vs-code">{r.target_key}</code></td>
                      <td>
                        <span className="vs-tag vs-tag-muted" style={{ fontSize: 11 }}>
                          {r.is_recursive ? "self-ref" : r.resource_path ? "many-to-many" : "one-to-many"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        );
      })()}

      {/* Meta */}
      <div className="vs-section-title">Meta</div>
      <div className="vs-kv-grid">
        <div className="vs-kv-row"><div className="vs-kv-key">Named query</div><div className="vs-kv-val">{model.is_named_query ? "yes" : "no"}</div></div>
        <div className="vs-kv-row"><div className="vs-kv-key">ReBac</div><div className="vs-kv-val">{model.has_rebac ? "yes" : "no"}</div></div>
        <div className="vs-kv-row">
          <div className="vs-kv-key">Custom pages</div>
          <div className="vs-kv-val">{model.custom_pages.length > 0 ? model.custom_pages.join(", ") : "(none)"}</div>
        </div>
        <div className="vs-kv-row">
          <div className="vs-kv-key">Referenced by</div>
          <div className="vs-kv-val">
            {model.referenced_by.length > 0
              ? model.referenced_by.map(([mn, fk]) => `${mn}.${fk}`).join(", ")
              : "(none)"}
          </div>
        </div>
        {model.models_path && (
          <div className="vs-kv-row">
            <div className="vs-kv-key">models.py</div>
            <div className="vs-kv-val"><code className="vs-code" style={{ wordBreak: "break-all" }}>{model.models_path}</code></div>
          </div>
        )}
      </div>

      {/* Relation graph */}
      <div className="vs-section-title" style={{ marginTop: 28 }}>Relation Graph</div>
      <RelationGraph model={model} onNavigate={onNavigate} />

      {/* Named queries */}
      {!model.is_named_query && (
        <>
          <div className="vs-section-title" style={{ marginTop: 28 }}>Named Queries</div>
          <NamedQueriesSection
            model={model}
            module={mod.name}
            allModelInfos={allModelInfos}
            devMode={devMode}
            onSuccess={onSuccess}
          />
        </>
      )}

      {/* Dev mode commands */}
      {devMode && (
        <>
          <div className="vs-section-title" style={{ marginTop: 28 }}>Add Field</div>
          <CommandCard
            def={addFieldDef(allResources)}
            prefill={{ resource: model.resource }}
            onSuccess={onSuccess}
          />
          <div className="vs-section-title" style={{ marginTop: 20 }}>Add Relation</div>
          <CommandCard
            def={addRelationDef(allModels)}
            prefill={{ model: model.name }}
            onSuccess={onSuccess}
          />
          <div className="vs-section-title" style={{ marginTop: 20 }}>Scaffold Page</div>
          <CommandCard
            def={scaffoldPageDef(allResources)}
            prefill={{ resource: model.resource }}
            onSuccess={onSuccess}
          />
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  schema: AppSchema | null;
  loadSchema: () => Promise<AppSchema>;
  devMode: boolean;
  onSuccess?: () => void;
}

type Selection =
  | { kind: "none" }
  | { kind: "module"; mod: ModuleInfo }
  | { kind: "model"; mod: ModuleInfo; model: ModelInfo };

export default function SchemaBrowser({ schema, loadSchema, devMode, onSuccess }: Props) {
  const [data, setData] = useState<AppSchema | null>(schema);
  const [loading, setLoading] = useState(!schema);
  const [error, setError] = useState("");
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>({ kind: "none" });

  // Sync local data when parent schema is invalidated or refreshed.
  useEffect(() => { setData(schema); }, [schema]);

  useEffect(() => {
    if (data) { setLoading(false); return; }
    setLoading(true);
    loadSchema()
      .then((s) => {
        setData(s);
        if (s.modules.length > 0) setOpenModules(new Set([s.modules[0].name]));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [data, loadSchema]);

  const toggleModule = (mod: ModuleInfo) => {
    const isOpen = openModules.has(mod.name);
    setOpenModules((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(mod.name) : next.add(mod.name);
      return next;
    });
    // Selecting the module header shows module detail
    setSelection((prev) =>
      prev.kind === "module" && prev.mod.name === mod.name
        ? { kind: "none" }
        : { kind: "module", mod }
    );
  };

  const selectModel = (mod: ModuleInfo, model: ModelInfo) => {
    setSelection({ kind: "model", mod, model });
  };

  if (loading) return <div className="vs-page"><p style={{ color: "var(--text-muted)" }}>Loading schema…</p></div>;
  if (error) return <div className="vs-page"><p style={{ color: "var(--error)" }}>{error}</p></div>;
  if (!data) return null;

  const allModules = data.modules.map((m) => m.name);
  const allModels = data.modules.flatMap((m) => m.models.map((mo) => mo.name));
  const allResources = data.modules.flatMap((m) => m.models.map((mo) => mo.resource));
  const allModelInfos = data.modules.flatMap((m) => m.models);

  return (
    <div className="vs-schema-layout">
      {/* Tree */}
      <div className="vs-tree">
        {data.modules.map((mod) => {
          const open = openModules.has(mod.name);
          const modSelected = selection.kind === "module" && selection.mod.name === mod.name;
          return (
            <div key={mod.name} className="vs-tree-module">
              <div
                className={`vs-tree-module-hdr${modSelected ? " active" : ""}`}
                onClick={() => toggleModule(mod)}
              >
                <span className={`vs-tree-chevron${open ? " open" : ""}`}>▶</span>
                {mod.name}
                <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>
                  {mod.models.length}
                </span>
              </div>
              {open && mod.models.map((m) => {
                const active = selection.kind === "model" && selection.model.resource === m.resource;
                return (
                  <div
                    key={m.resource}
                    className={`vs-tree-model${active ? " active" : ""}`}
                    onClick={() => selectModel(mod, m)}
                  >
                    <span className="vs-dot" />
                    {m.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Detail */}
      {selection.kind === "none" && (
        <div className="vs-detail">
          <div className="vs-empty" style={{ paddingTop: 48 }}>
            Select a module or model from the tree.
          </div>
        </div>
      )}

      {selection.kind === "module" && (
        <ModuleDetail
          mod={selection.mod}
          allModules={allModules}
          devMode={devMode}
          onSelectModel={(m) => selectModel(selection.mod, m)}
          onSuccess={onSuccess}
        />
      )}

      {selection.kind === "model" && (
        <ModelDetail
          model={selection.model}
          mod={selection.mod}
          allModelInfos={allModelInfos}
          allModels={allModels}
          allResources={allResources}
          devMode={devMode}
          onNavigate={(resource) => {
            for (const mod of data.modules) {
              const found = mod.models.find((m) => m.resource === resource || m.name === resource);
              if (found) {
                setOpenModules((prev) => { const n = new Set(prev); n.add(mod.name); return n; });
                setSelection({ kind: "model", mod, model: found });
                break;
              }
            }
          }}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}

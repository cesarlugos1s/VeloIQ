import { useState } from "react";
import { FieldInfo, ModelInfo, NamedQueryDef, NQField, NQFilter, NQJoin, NQSort } from "../types";
import { api } from "../api";

const FILTER_OPS = ["eq", "ne", "contains", "gt", "gte", "lt", "lte"];
const VIEW_TYPES = ["table", "gallery", "calendar"];

interface JoinCandidate {
  resource: string;
  label: string;
  relType: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function deriveCandidates(model: ModelInfo): JoinCandidate[] {
  const seen = new Set<string>();
  const out: JoinCandidate[] = [];
  for (const f of model.fields) {
    if (f.reference && !seen.has(f.reference)) {
      seen.add(f.reference);
      out.push({ resource: f.reference, label: f.label.replace(/ Id$/, ""), relType: "many-to-one" });
    }
  }
  for (const r of model.relations) {
    if (!seen.has(r.resource)) {
      seen.add(r.resource);
      const relType = r.is_recursive ? "self-ref" : r.resource_path ? "many-to-many" : "one-to-many";
      out.push({ resource: r.resource, label: r.label, relType });
    }
  }
  return out;
}

interface Props {
  rootModel: ModelInfo;
  module: string;
  allModels: ModelInfo[];
  existingDef?: NamedQueryDef;
  onSaved: () => void;
  onCancel: () => void;
}

export default function NamedQueryCreator({
  rootModel, module, allModels, existingDef, onSaved, onCancel,
}: Props) {
  const isEdit = !!existingDef;

  const pkFieldKey = rootModel.pk_field;

  const [name, setName] = useState(existingDef?.name ?? "");
  const [label, setLabel] = useState(existingDef?.label ?? "");
  const [joins, setJoins] = useState<NQJoin[]>(existingDef?.joins ?? []);
  const [fields, setFields] = useState<NQField[]>(() => {
    const base = existingDef?.fields ?? [];
    const hasPk = base.some((f) => f.from_alias === "root" && f.key === pkFieldKey);
    if (hasPk) return base;
    const pkInfo = rootModel.fields.find((f) => f.key === pkFieldKey);
    const pkEntry: NQField = {
      from_alias: "root",
      key: pkFieldKey,
      alias: pkFieldKey,
      label: pkInfo?.label ?? "ID",
      type: "number",
    };
    return [pkEntry, ...base];
  });
  const [filters, setFilters] = useState<NQFilter[]>(existingDef?.default_filters ?? []);
  const [sorts, setSorts] = useState<NQSort[]>(existingDef?.default_sort ?? []);
  const [viewType, setViewType] = useState(existingDef?.list_view_type ?? "table");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genLines, setGenLines] = useState<string[]>([]);
  const [error, setError] = useState("");

  const joinCandidates = deriveCandidates(rootModel);

  const modelByResource = (res: string): ModelInfo | undefined =>
    allModels.find((m) => m.resource === res);

  const availableFields = (): { alias: string; display: string }[] => {
    const out: { alias: string; display: string }[] = [];
    for (const f of rootModel.fields) {
      out.push({ alias: f.key, display: `${rootModel.label} › ${f.label}` });
    }
    for (const j of joins) {
      const jModel = modelByResource(j.resource);
      if (jModel) {
        for (const f of jModel.fields) {
          const alias = `${j.alias}_${f.key}`;
          out.push({ alias, display: `${j.alias} › ${f.label}` });
        }
      }
    }
    return out;
  };

  const toggleJoin = (candidate: JoinCandidate) => {
    const existing = joins.find((j) => j.resource === candidate.resource);
    if (existing) {
      setJoins(joins.filter((j) => j.resource !== candidate.resource));
      setFields(fields.filter((f) => f.from_alias !== existing.alias));
    } else {
      const newJoin: NQJoin = { resource: candidate.resource, alias: candidate.resource };
      setJoins([...joins, newJoin]);
    }
  };

  const updateJoinAlias = (resource: string, alias: string) => {
    const old = joins.find((j) => j.resource === resource);
    if (!old) return;
    const oldAlias = old.alias;
    setJoins(joins.map((j) => j.resource === resource ? { ...j, alias } : j));
    setFields(fields.map((f) => f.from_alias === oldAlias ? { ...f, from_alias: alias } : f));
  };

  const toggleField = (fromAlias: string, fieldInfo: FieldInfo, modelLabel: string) => {
    // The root pk field is always included — cannot be deselected.
    if (fromAlias === "root" && fieldInfo.key === pkFieldKey) return;
    const rawAlias = fromAlias === "root" ? fieldInfo.key : `${fromAlias}_${fieldInfo.key}`;
    const existing = fields.find((f) => f.from_alias === fromAlias && f.key === fieldInfo.key);
    if (existing) {
      setFields(fields.filter((f) => !(f.from_alias === fromAlias && f.key === fieldInfo.key)));
    } else {
      setFields([...fields, {
        from_alias: fromAlias,
        key: fieldInfo.key,
        alias: rawAlias,
        label: fromAlias === "root" ? fieldInfo.label : `${modelLabel} ${fieldInfo.label}`,
        type: fieldInfo.type === "number" ? "number"
          : fieldInfo.type === "boolean" ? "boolean"
          : fieldInfo.type === "date" ? "date"
          : fieldInfo.type === "datetime" ? "datetime"
          : "string",
      }]);
    }
  };

  const addFilter = () => {
    const first = availableFields()[0]?.alias ?? "";
    setFilters([...filters, { field: first, operator: "eq", value: "" }]);
  };

  const updateFilter = (i: number, patch: Partial<NQFilter>) => {
    setFilters(filters.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  };

  const removeFilter = (i: number) => setFilters(filters.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!label.trim()) { setError("Label is required"); return; }
    if (fields.length === 0) { setError("Select at least one field"); return; }
    setSaving(true);
    setError("");
    const def: NamedQueryDef = {
      name: name.trim(),
      label: label.trim(),
      module,
      root_resource: rootModel.resource,
      joins,
      fields,
      default_filters: filters.filter((f) => f.field),
      default_sort: sorts.filter((s) => s.field),
      list_view_type: viewType,
    };
    try {
      if (isEdit) {
        await api.updateNamedQuery(module, existingDef!.name, def);
      } else {
        await api.createNamedQuery(def);
      }
    } catch (e: unknown) {
      setError(String(e));
      setSaving(false);
      return;
    }
    setSaving(false);

    // Auto-run veloiq generate so the schema is immediately up to date.
    setGenerating(true);
    setGenLines([]);
    try {
      const { run_id } = await api.runCommand("veloiq generate");
      await api.streamCommand(
        run_id,
        (line) => setGenLines((prev) => [...prev, line]),
        (returncode) => {
          setGenerating(false);
          if (returncode === 0) {
            onSaved();
          } else {
            setError(`veloiq generate exited with code ${returncode}`);
          }
        },
        (err) => {
          setGenerating(false);
          setError(`Generate error: ${err}`);
        },
      );
    } catch (e: unknown) {
      setGenerating(false);
      setError(String(e));
    }
  };

  const af = availableFields();

  return (
    <div className="vs-nq-creator">
      <div className="vs-nq-title">{isEdit ? "Edit Named Query" : "Create Named Query"}</div>

      {/* Basic info */}
      <div className="vs-section-title">Basic Info</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="vs-inline-field">
          <label>Name (slug)</label>
          <input
            value={name}
            onChange={(e) => {
              const v = slugify(e.target.value);
              setName(v);
              if (!label) setLabel(v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
            }}
            placeholder="e.g. tasks_with_project"
            disabled={isEdit}
          />
        </div>
        <div className="vs-inline-field">
          <label>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Tasks with Project" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="vs-inline-field">
          <label>List view type</label>
          <select value={viewType} onChange={(e) => setViewType(e.target.value)}>
            {VIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Join picker */}
      <div className="vs-section-title">Joins <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>— select which related models to include</span></div>
      {joinCandidates.length === 0 ? (
        <div className="vs-empty" style={{ padding: "12px 0" }}>No relations defined on {rootModel.label}.</div>
      ) : (
        <div className="vs-nq-join-list">
          {joinCandidates.map((c) => {
            const selected = joins.find((j) => j.resource === c.resource);
            return (
              <div key={c.resource} className={`vs-nq-join-row${selected ? " selected" : ""}`}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                  <input type="checkbox" checked={!!selected} onChange={() => toggleJoin(c)} />
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span className="vs-tag vs-tag-muted" style={{ fontSize: 10 }}>{c.relType}</span>
                  <code className="vs-code" style={{ fontSize: 11 }}>{c.resource}</code>
                </label>
                {selected && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingLeft: 24 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>alias:</span>
                    <input
                      className="vs-nq-alias-input"
                      value={selected.alias}
                      onChange={(e) => updateJoinAlias(c.resource, slugify(e.target.value))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Field selector */}
      <div className="vs-section-title">Fields <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>— choose which columns appear in the query output</span></div>
      {[
        { alias: "root", model: rootModel },
        ...joins.map((j) => ({ alias: j.alias, model: modelByResource(j.resource) })),
      ].map(({ alias, model: m }) => {
        if (!m) return null;
        const plainFields = m.fields.filter((f) => !f.reference);
        return (
          <div key={alias} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
              {alias === "root" ? `${m.label} (root)` : `${alias} (${m.label})`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {plainFields.map((f) => {
                const isPk = alias === "root" && f.key === pkFieldKey;
                const checked = isPk || !!fields.find((sf) => sf.from_alias === alias && sf.key === f.key);
                return (
                  <label
                    key={f.key}
                    className={`vs-nq-field-chip${checked ? " selected" : ""}${isPk ? " locked" : ""}`}
                    style={{ cursor: isPk ? "default" : "pointer" }}
                    title={isPk ? "Primary key — always included" : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleField(alias, f, alias === "root" ? "" : alias)}
                      style={{ display: "none" }}
                    />
                    {f.label}
                    {isPk && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>[pk]</span>}
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{f.type}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Field label overrides */}
      {fields.length > 0 && (
        <>
          <div className="vs-section-title" style={{ marginTop: 8 }}>Field Labels</div>
          <table className="vs-table" style={{ marginBottom: 16 }}>
            <thead><tr><th>Alias</th><th>Type</th><th>Label</th></tr></thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i}>
                  <td><code className="vs-code">{f.alias}</code></td>
                  <td><span className="vs-tag vs-tag-muted" style={{ fontSize: 10 }}>{f.type}</span></td>
                  <td>
                    <input
                      style={{ width: "100%", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "var(--input-bg)", color: "var(--text-primary)" }}
                      value={f.label}
                      onChange={(e) => setFields(fields.map((sf, si) => si === i ? { ...sf, label: e.target.value } : sf))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Default filters */}
      <div className="vs-section-title">Default Filters <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>— always applied to this query</span></div>
      {filters.map((flt, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <select
            style={{ flex: 2, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}
            value={flt.field}
            onChange={(e) => updateFilter(i, { field: e.target.value })}
          >
            {af.map((f) => <option key={f.alias} value={f.alias}>{f.display}</option>)}
          </select>
          <select
            style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}
            value={flt.operator}
            onChange={(e) => updateFilter(i, { operator: e.target.value })}
          >
            {FILTER_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            style={{ flex: 2, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}
            value={String(flt.value ?? "")}
            onChange={(e) => updateFilter(i, { value: e.target.value })}
            placeholder="value"
          />
          <button
            onClick={() => removeFilter(i)}
            style={{ padding: "4px 8px", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--error)", fontSize: 12 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={addFilter}
        className="vs-nq-add-btn"
        disabled={af.length === 0}
      >+ Add Filter</button>

      {/* Default sort */}
      <div className="vs-section-title">Default Sort <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>— applied in listed order</span></div>
      {sorts.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 18, textAlign: "right" }}>{i + 1}.</span>
          <select
            style={{ flex: 2, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "var(--input-bg)", color: "var(--text-primary)" }}
            value={s.field}
            onChange={(e) => setSorts(sorts.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
          >
            {af.map((f) => <option key={f.alias} value={f.alias}>{f.display}</option>)}
          </select>
          <select
            style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "var(--input-bg)", color: "var(--text-primary)" }}
            value={s.order}
            onChange={(e) => setSorts(sorts.map((x, j) => j === i ? { ...x, order: e.target.value as "asc" | "desc" } : x))}
          >
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
          <button
            onClick={() => setSorts(sorts.filter((_, j) => j !== i))}
            style={{ padding: "4px 8px", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--error)", fontSize: 12 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={() => {
          const first = af.find((f) => !sorts.some((s) => s.field === f.alias));
          if (first) setSorts([...sorts, { field: first.alias, order: "asc" }]);
        }}
        className="vs-nq-add-btn"
        disabled={af.length === 0 || sorts.length >= af.length}
      >+ Add Sort Field</button>

      {/* Actions */}
      {error && <div className="vs-error-msg" style={{ marginTop: 16 }}>{error}</div>}

      {genLines.length > 0 && (
        <div className="vs-terminal" style={{ marginTop: 16 }}>
          <div className="vs-terminal-bar">
            {generating
              ? <span className="vs-terminal-running">veloiq generate</span>
              : <span className="vs-terminal-ok">veloiq generate — done</span>}
          </div>
          <div className="vs-terminal-output">
            {genLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button className="vs-btn-run" onClick={handleSave} disabled={saving || generating}>
          {saving ? "Saving…" : generating ? "Generating…" : isEdit ? "Update" : "Create"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving || generating}
          style={{ padding: "7px 16px", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer", color: "var(--text-secondary)", opacity: (saving || generating) ? 0.5 : 1 }}
        >Cancel</button>
      </div>
    </div>
  );
}

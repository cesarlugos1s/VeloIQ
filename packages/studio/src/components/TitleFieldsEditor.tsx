import { useState } from "react";
import { ModelInfo } from "../types";
import Terminal from "./Terminal";
import { executeCommand } from "../lib/commandRunner";

interface Props {
  model: ModelInfo;
  /** Called after the command (+ auto-generate) completes successfully. */
  onSuccess?: () => void;
}

/**
 * Friendly editor for a model's title fields: one dropdown row per field
 * (selectable from the model's own fields), reorderable, with a live preview.
 * Runs `veloiq set-title <resource> --fields …` (or `--clear` when empty).
 */
export default function TitleFieldsEditor({ model, onSuccess }: Props) {
  // Special selectable tokens (always available) followed by the model's fields.
  const SPECIAL_OPTIONS = [
    { value: "__model_name__", label: "Model name" },
    { value: "__pk__", label: "Primary key" },
  ];
  const fieldOptions = [
    ...SPECIAL_OPTIONS,
    ...model.fields.map((f) => ({ value: f.key, label: f.label })),
  ];
  const labelOf = (key: string) =>
    fieldOptions.find((o) => o.value === key)?.label ?? key;
  // How a token reads in the rendered title: special tokens are wrapped in brackets.
  const previewLabel = (key: string) =>
    key === "__model_name__" ? "[Model name]"
      : key === "__pk__" ? "[Primary key]"
      : labelOf(key);

  const [rows, setRows] = useState<string[]>(() => [...(model.title_fields ?? [])]);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [returncode, setReturncode] = useState<number | null>(null);
  const append = (line: string) => setLines((prev) => [...prev, line]);

  const usedElsewhere = (idx: number) =>
    new Set(rows.filter((_, i) => i !== idx));

  // Options for a given row: fields not chosen in other rows, plus this row's
  // own current value (kept selectable even if it is no longer a model field).
  const optionsFor = (idx: number) => {
    const blocked = usedElsewhere(idx);
    const opts = fieldOptions.filter(
      (o) => !blocked.has(o.value) || o.value === rows[idx]
    );
    if (rows[idx] && !opts.some((o) => o.value === rows[idx])) {
      opts.unshift({ value: rows[idx], label: `${rows[idx]} (not a field)` });
    }
    return opts;
  };

  const firstUnused = () =>
    fieldOptions.find((o) => !rows.includes(o.value))?.value ?? "";
  const canAdd = !running && rows.length < fieldOptions.length;

  const setRow = (idx: number, val: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? val : r)));
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () => {
    const next = firstUnused();
    if (next) setRows((prev) => [...prev, next]);
  };
  const moveRow = (idx: number, dir: -1 | 1) =>
    setRows((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });

  const fields = rows.filter(Boolean);
  const command = fields.length
    ? `veloiq set-title ${model.resource} --fields ${fields.join(",")} --no-generate`
    : `veloiq set-title ${model.resource} --clear --no-generate`;

  const handleSave = async () => {
    setLines([`$ ${command}`]);
    setReturncode(null);
    setRunning(true);
    await executeCommand({ command, append, setReturncode, setRunning, onSuccess });
  };

  return (
    <div className="vs-cmd-card">
      <div className="vs-cmd-card-hdr">
        <div className="vs-cmd-card-title">Set Title Fields</div>
        <div className="vs-cmd-card-desc">
          Pick the fields whose values compose this model's title (dc_title / __str__),
          in order. "Model name" and "Primary key" are special tokens rendered in
          [brackets]. Remove all rows to restore the automatic title.
        </div>
      </div>
      <div className="vs-cmd-card-body">
        {fieldOptions.length === 0 ? (
          <div className="vs-empty">
            No field data — run <code className="vs-code">veloiq generate</code> first.
          </div>
        ) : (
          <>
            {rows.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                No title fields — the title is derived automatically from the first text field.
              </div>
            ) : (
              rows.map((row, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)", width: 16, textAlign: "right" }}>
                    {idx + 1}
                  </span>
                  <div className="vs-inline-field" style={{ flex: 1, marginBottom: 0 }}>
                    <select
                      value={row}
                      disabled={running}
                      onChange={(e) => setRow(idx, e.target.value)}
                    >
                      {optionsFor(idx).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="vs-nq-action-btn"
                    disabled={running || idx === 0}
                    title="Move up"
                    onClick={() => moveRow(idx, -1)}
                  >↑</button>
                  <button
                    className="vs-nq-action-btn"
                    disabled={running || idx === rows.length - 1}
                    title="Move down"
                    onClick={() => moveRow(idx, 1)}
                  >↓</button>
                  <button
                    className="vs-nq-action-btn danger"
                    disabled={running}
                    title="Remove"
                    onClick={() => removeRow(idx)}
                  >✕</button>
                </div>
              ))
            )}

            <button className="vs-nq-add-btn" disabled={!canAdd} onClick={addRow}>
              + Add field
            </button>

            <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "12px 0" }}>
              Title preview:{" "}
              {fields.length ? (
                <strong style={{ color: "var(--text-primary)" }}>
                  {fields.map(previewLabel).join(" ")}
                </strong>
              ) : (
                <em>automatic (first text field)</em>
              )}
            </div>

            <button className="vs-btn-run" disabled={running} onClick={handleSave}>
              {running ? "Saving…" : fields.length ? "Save title fields" : "Clear title fields"}
            </button>
          </>
        )}
        {lines.length > 0 && (
          <Terminal lines={lines} running={running} returncode={returncode} />
        )}
      </div>
    </div>
  );
}

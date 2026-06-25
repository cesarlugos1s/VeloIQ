import { useState, useRef, useEffect } from "react";
import Terminal from "./Terminal";
import { executeCommand } from "../lib/commandRunner";

export interface InputDef {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  /** When true and type is "select" with options, renders a filterable combo-box instead of a plain <select>. */
  searchable?: boolean;
}

export interface CommandDef {
  id: string;
  label: string;
  description: string;
  inputs: InputDef[];
  build: (v: Record<string, string>) => string;
  note?: {
    text?: string;
    paragraphs?: Array<{ text: string; link?: { label: string; href: string } }>;
    link?: { label: string; href: string };
  };
}

interface Props {
  def: CommandDef;
  prefill?: Record<string, string>;
  /** Called after the command (+ auto-generate) completes successfully. */
  onSuccess?: () => void;
}

/** A searchable combo-box: text input that filters a dropdown list. */
function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(filter.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (val: string) => {
    onChange(val);
    setFilter("");
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
      setOpen(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightIdx >= 0 && highlightIdx < filtered.length) {
        select(filtered[highlightIdx]);
      } else if (filtered.length > 0) {
        select(filtered[0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  const display = value || placeholder || "";

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? filter : display}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setFilter(""); setHighlightIdx(-1); }}
        onChange={(e) => { setFilter(e.target.value); setOpen(true); setHighlightIdx(-1); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--bg-input, #fff)",
            border: "1px solid var(--border, #d1d5db)",
            borderRadius: "0 0 6px 6px",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.map((o, i) => (
            <div
              key={o}
              onClick={() => select(o)}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 13,
                background: i === highlightIdx ? "var(--accent-light, #e6f0ff)" : "transparent",
                color: i === highlightIdx ? "var(--accent, #1677ff)" : "var(--text-primary, #1f2937)",
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && filter && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text-muted)",
            background: "var(--bg-input, #fff)",
            border: "1px solid var(--border, #d1d5db)",
            borderRadius: "0 0 6px 6px",
            zIndex: 1000,
          }}
        >
          No matches
        </div>
      )}
    </div>
  );
}

export default function CommandCard({ def, prefill = {}, onSuccess }: Props) {
  const initial = Object.fromEntries(
    def.inputs.map((inp) => [inp.key, prefill[inp.key] ?? inp.options?.[0] ?? ""])
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [returncode, setReturncode] = useState<number | null>(null);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));
  const canRun = def.inputs.every((inp) => !inp.required || values[inp.key]?.trim());
  const append = (line: string) => setLines((prev) => [...prev, line]);

  const handleRun = async () => {
    const cmd = def.build(values);
    setLines([`$ ${cmd}`]);
    setReturncode(null);
    setRunning(true);
    await executeCommand({ command: cmd, append, setReturncode, setRunning, onSuccess });
  };

  return (
    <div className="vs-cmd-card">
      <div className="vs-cmd-card-hdr">
        <div className="vs-cmd-card-title">{def.label}</div>
        <div className="vs-cmd-card-desc">{def.description}</div>
      </div>
      <div className="vs-cmd-card-body">
        {def.inputs.map((inp) => {
          const locked = inp.key in prefill;
          return (
            <div key={inp.key} className="vs-inline-field">
              <label>{inp.label}</label>
              {inp.type === "select" && !locked ? (
                inp.searchable && inp.options ? (
                  <SearchableSelect
                    value={values[inp.key]}
                    options={inp.options}
                    placeholder={inp.placeholder}
                    onChange={(val) => set(inp.key, val)}
                  />
                ) : (
                  <select value={values[inp.key]} onChange={(e) => set(inp.key, e.target.value)}>
                    {inp.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )
              ) : (
                <input
                  type="text"
                  placeholder={inp.placeholder}
                  value={values[inp.key]}
                  disabled={locked}
                  style={locked ? { background: "#f8fafc", color: "var(--text-muted)", cursor: "default" } : undefined}
                  onChange={locked ? undefined : (e) => set(inp.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <button className="vs-btn-run" disabled={running || !canRun} onClick={handleRun}>
          {running ? "Running…" : "Run"}
        </button>
        {!canRun && !running && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Fill in the required fields above to enable Run.
          </div>
        )}
        {def.note && (
          <div className="vs-cmd-note">
            {def.note.paragraphs
              ? def.note.paragraphs.map((p, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
                    {p.text}
                    {p.link && (
                      <>
                        {" "}
                        <a href={p.link.href} target="_blank" rel="noreferrer"
                           style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {p.link.label} →
                        </a>
                      </>
                    )}
                  </p>
                ))
              : def.note.text}
            {def.note.link && (
              <>
                {" "}
                <a href={def.note.link.href} target="_blank" rel="noreferrer"
                   style={{ color: "var(--accent)", textDecoration: "none" }}>
                  {def.note.link.label} →
                </a>
              </>
            )}
          </div>
        )}
        {lines.length > 0 && (
          <Terminal lines={lines} running={running} returncode={returncode} />
        )}
      </div>
    </div>
  );
}

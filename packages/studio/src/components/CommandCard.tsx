import { useState } from "react";
import Terminal from "./Terminal";
import { executeCommand } from "../lib/commandRunner";

export interface InputDef {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
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
                <select value={values[inp.key]} onChange={(e) => set(inp.key, e.target.value)}>
                  {inp.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
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

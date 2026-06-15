import { useState } from "react";
import { api } from "../api";
import Terminal from "./Terminal";

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
}

interface Props {
  def: CommandDef;
  prefill?: Record<string, string>;
  /** Called after the command (+ auto-generate) completes successfully. */
  onSuccess?: () => void;
}

const SKIP_AUTO_GENERATE = new Set(["veloiq generate", "veloiq check", "veloiq build", "veloiq migrate", "veloiq db upgrade"]);

async function runAndStream(
  command: string,
  onLine: (l: string) => void,
  onDone: (rc: number) => void,
  onError: (e: string) => void
) {
  try {
    const { run_id } = await api.runCommand(command);
    await api.streamCommand(run_id, onLine, onDone, onError);
  } catch (e) {
    onError(String(e));
  }
}

async function waitForServer(maxWait = 15_000): Promise<boolean> {
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    try {
      await api.info();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
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

    let cmdRc: number | null = null;

    await runAndStream(
      cmd,
      append,
      (rc) => { cmdRc = rc; },
      (err) => { append(`error: ${err}`); cmdRc = 1; }
    );

    // cmdRc === null means the stream was cut without a done event (server reloaded).
    // The subprocess survives the reload; wait for the server to come back then continue.
    if (cmdRc === null) {
      append("⚠  Connection lost — waiting for server reload…");
      const recovered = await waitForServer();
      if (!recovered) {
        append("✗  Server did not recover within 15 s");
        setReturncode(1);
        setRunning(false);
        return;
      }
      append("✓  Server back online");
      cmdRc = 0;
    }

    if (cmdRc !== 0) {
      setReturncode(cmdRc);
      setRunning(false);
      return;
    }

    // Auto-run generate unless this command already is generate/check
    if (!SKIP_AUTO_GENERATE.has(cmd)) {
      append("");
      append("─── veloiq generate ───");
      let genRc: number | null = null;
      await runAndStream(
        "veloiq generate",
        append,
        (rc) => { genRc = rc; },
        (err) => { append(`error: ${err}`); genRc = 1; }
      );
      // If generate stream was also cut, assume it ran in the background and succeeded.
      if (genRc === null) {
        append("⚠  Generate connection lost — waiting for server…");
        const recovered = await waitForServer();
        genRc = recovered ? 0 : 1;
        if (recovered) append("✓  Schema updated in background");
      }
      setReturncode(genRc);
      setRunning(false);
      if (genRc === 0) onSuccess?.();
    } else {
      // veloiq generate itself — just finish
      setReturncode(cmdRc);
      setRunning(false);
      if (cmdRc === 0) onSuccess?.();
    }
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
        {lines.length > 0 && (
          <Terminal lines={lines} running={running} returncode={returncode} />
        )}
      </div>
    </div>
  );
}

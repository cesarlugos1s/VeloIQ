import { useEffect, useState } from "react";
import { ExtInfo, UpsellMessages } from "../types";
import { api } from "../api";

interface Props {
  devMode: boolean;
  onSuccess?: () => void;
}

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

export default function Extensions({ devMode, onSuccess }: Props) {
  const [extensions, setExtensions] = useState<ExtInfo[]>([]);
  const [upsells, setUpsells] = useState<UpsellMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<Record<string, string[]>>({});
  const [exitCodes, setExitCodes] = useState<Record<string, number>>({});

  useEffect(() => {
    api.extensions()
      .then((d) => setExtensions(d.extensions))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    api.upsells().then(setUpsells).catch(() => {});
  }, []);

  const appendTo = (name: string, line: string) =>
    setOutput((prev) => ({ ...prev, [name]: [...(prev[name] ?? []), line] }));

  const runToggle = async (ext: ExtInfo) => {
    const cmd = ext.enabled
      ? `veloiq remove-package ${ext.name}`
      : `veloiq extend-package ${ext.name}`;

    setRunning(ext.name);
    setOutput((prev) => ({ ...prev, [ext.name]: [`$ ${cmd}`] }));
    setExitCodes((prev) => { const n = { ...prev }; delete n[ext.name]; return n; });

    let cmdRc: number | null = null;
    await runAndStream(
      cmd,
      (l) => appendTo(ext.name, l),
      (rc) => { cmdRc = rc; },
      (e) => { appendTo(ext.name, `error: ${e}`); cmdRc = 1; }
    );

    if (cmdRc !== 0) {
      setExitCodes((prev) => ({ ...prev, [ext.name]: cmdRc! }));
      setRunning(null);
      return;
    }

    // Optimistically flip the enabled flag in the list.
    setExtensions((prev) =>
      prev.map((e) => e.name === ext.name ? { ...e, enabled: !e.enabled } : e)
    );

    // Auto-run generate.
    appendTo(ext.name, "");
    appendTo(ext.name, "─── veloiq generate ───");
    let genRc: number | null = null;
    await runAndStream(
      "veloiq generate",
      (l) => appendTo(ext.name, l),
      (rc) => { genRc = rc; },
      (e) => { appendTo(ext.name, `error: ${e}`); genRc = 1; }
    );

    setExitCodes((prev) => ({ ...prev, [ext.name]: genRc! }));
    setRunning(null);
    if (genRc === 0) onSuccess?.();
  };

  return (
    <div className="vs-page">
      <div className="vs-page-title">Extensions</div>
      <div className="vs-page-subtitle">
        Extensions installed in the current venv and their status in this app
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}

      {!loading && extensions.length === 0 && (
        <div className="vs-empty">
          No VeloIQ extensions installed. Use <code>pip install &lt;extension&gt;</code> to add one.
        </div>
      )}

      <div className="vs-ext-list">
        {extensions.map((ext) => (
          <div key={ext.name}>
            <div className="vs-ext-item">
              <span className="vs-ext-name">{ext.name}</span>
              <span className={`vs-tag ${ext.installed ? "vs-tag-ok" : "vs-tag-muted"}`}>
                {ext.installed ? "installed" : "not installed"}
              </span>
              <span className={`vs-tag ${ext.enabled ? "vs-tag-info" : "vs-tag-muted"}`}>
                {ext.enabled ? "enabled" : "disabled"}
              </span>
              {devMode && ext.installed && (
                <button
                  className="vs-btn-run"
                  style={{ marginTop: 0 }}
                  disabled={running === ext.name}
                  onClick={() => runToggle(ext)}
                >
                  {running === ext.name ? "…" : ext.enabled ? "Disable" : "Enable"}
                </button>
              )}
            </div>
            {output[ext.name] && (
              <div style={{ padding: "0 0 8px" }}>
                <div className="vs-terminal">
                  <div className="vs-terminal-bar">
                    {running === ext.name
                      ? <span className="vs-terminal-running">running</span>
                      : exitCodes[ext.name] !== undefined
                        ? <span className={exitCodes[ext.name] === 0 ? "vs-terminal-ok" : "vs-terminal-err"}>
                            exit {exitCodes[ext.name]}
                          </span>
                        : null}
                  </div>
                  <pre className="vs-terminal-output">
                    {output[ext.name].join("\n") || "(no output)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && upsells && upsells.extensions_advisory
        .filter((e) => !e.extension_name || !extensions.some((x) => x.name === e.extension_name && x.enabled))
        .map((e) => (
          <div className="vs-advisory-card" key={e.id}
               style={e.extension_name ? undefined : { borderColor: "var(--border-subtle)" }}>
            {e.title && <div className="vs-advisory-title">{e.title}</div>}
            <div className="vs-advisory-body">{e.text}</div>
            <div className="vs-advisory-cmd">
              {e.install_cmd && (
                <>
                  <code>{e.install_cmd}</code>
                  {e.link && <span style={{ margin: "0 10px", color: "var(--text-muted)" }}>·</span>}
                </>
              )}
              {e.link && (
                <a href={e.link.href} target="_blank" rel="noreferrer"
                   style={{ color: "var(--accent)", textDecoration: "none" }}>
                  {e.link.label} →
                </a>
              )}
            </div>
          </div>
        ))}

      {!loading && upsells && (
        <div className="vs-advisory-card" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="vs-advisory-title">{upsells.commercial_apps_advisory[0]?.title}</div>
          <div className="vs-advisory-body">
            {upsells.commercial_apps_advisory.map((e) => e.text).join(" ")}
          </div>
          <div className="vs-advisory-cmd">
            {upsells.commercial_apps_advisory.flatMap((e, i) => e.link ? [
              i > 0 ? <span key={`sep-${e.id}`} style={{ margin: "0 10px", color: "var(--text-muted)" }}>·</span> : null,
              <a key={e.id} href={e.link.href} target="_blank" rel="noreferrer"
                 style={{ color: "var(--accent)", textDecoration: "none" }}>
                {e.link.label} →
              </a>,
            ] : [])}
          </div>
        </div>
      )}
    </div>
  );
}

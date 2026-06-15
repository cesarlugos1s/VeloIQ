import { useEffect, useState } from "react";
import { AppInfo, AppSchema } from "../types";

interface Props {
  info: AppInfo;
  schema: AppSchema | null;
  loadSchema: () => Promise<AppSchema>;
}

export default function Summary({ info, schema, loadSchema }: Props) {
  const [loading, setLoading] = useState(!schema);
  const [error, setError] = useState("");
  const [data, setData] = useState<AppSchema | null>(schema);

  useEffect(() => {
    if (data) return;
    setLoading(true);
    loadSchema()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [data, loadSchema]);

  const totalModels = data?.modules.reduce((n, m) => n + m.models.length, 0) ?? 0;
  const dashCount = data?.modules.reduce(
    (n, m) => n + m.models.filter((mo) => mo.in_dashboard).length, 0
  ) ?? 0;
  const searchCount = data?.modules.reduce(
    (n, m) => n + m.models.filter((mo) => mo.in_search).length, 0
  ) ?? 0;
  const extEnabled = data?.extensions.filter((e) => e.enabled).length ?? 0;
  const extInstalled = data?.extensions.length ?? 0;

  return (
    <div className="vs-page">
      <div className="vs-page-title">Summary</div>
      <div className="vs-page-subtitle">Overview of {info.app_name}</div>

      {!data?.generate_run && data && (
        <div className="vs-warn-banner">
          ⚠ Run <code style={{ margin: "0 4px" }}>veloiq generate</code> to enable full
          field and relation introspection.
        </div>
      )}

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading schema…</p>}
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}

      {data && (
        <>
          <div className="vs-kv-grid">
            <div className="vs-kv-row">
              <div className="vs-kv-key">Project</div>
              <div className="vs-kv-val">{data.name}</div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Database</div>
              <div className="vs-kv-val">
                <code className="vs-code">{data.db_url_sanitized}</code>
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Auth</div>
              <div className="vs-kv-val">
                <span className={`vs-tag ${data.auth_disabled ? "vs-tag-err" : "vs-tag-ok"}`}>
                  {data.auth_disabled ? "disabled" : "enabled"}
                </span>
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Modules</div>
              <div className="vs-kv-val">
                {data.modules.length} &mdash;{" "}
                {data.modules.map((m) => m.name).join(", ") || "(none)"}
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Models</div>
              <div className="vs-kv-val">{totalModels}</div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Dashboard</div>
              <div className="vs-kv-val">{dashCount} model(s) configured</div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Search</div>
              <div className="vs-kv-val">
                {searchCount} model(s) &middot; {data.search_fields.length} field(s)
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Extensions</div>
              <div className="vs-kv-val">
                {extEnabled} enabled &middot; {extInstalled} installed
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Generate</div>
              <div className="vs-kv-val">
                <span className={`vs-tag ${data.generate_run ? "vs-tag-ok" : "vs-tag-warn"}`}>
                  {data.generate_run ? "run" : "not run yet"}
                </span>
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Dev mode</div>
              <div className="vs-kv-val">
                <span className={`vs-tag ${info.dev_mode ? "vs-tag-ok" : "vs-tag-muted"}`}>
                  {info.dev_mode ? "on" : "off"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

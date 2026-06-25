import { useEffect, useState } from "react";
import { DashboardModel, AppSchema } from "../types";
import { api } from "../api";
import CommandCard, { CommandDef } from "../components/CommandCard";

interface Props {
  devMode: boolean;
  schema: AppSchema | null;
  loadSchema: () => Promise<AppSchema>;
  refreshToken: number;
  onSuccess?: () => void;
}

function toggleDashboardDef(models: string[]): CommandDef {
  return {
    id: "toggle-dashboard",
    label: "Toggle Dashboard Model",
    description: "Add or remove a model from the dashboard",
    inputs: [
      { key: "name", label: "Model name", type: models.length ? "select" : "text", options: models, required: true, placeholder: "e.g. Task", searchable: true },
      { key: "action", label: "Action", type: "select", options: ["add", "remove"], required: true },
    ],
    build: (v) =>
      v.action === "remove"
        ? `veloiq add-dashboard --remove ${v.name}`
        : `veloiq add-dashboard ${v.name}`,
  };
}

export default function DashboardConfig({ devMode, schema, loadSchema, refreshToken, onSuccess }: Props) {
  const [models, setModels] = useState<DashboardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schemaData, setSchemaData] = useState<AppSchema | null>(schema);

  const fetchDashboard = () => {
    setLoading(true);
    api.dashboard()
      .then((d) => setModels(d.models))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Initial fetch + re-fetch when refreshToken changes (after a successful command).
  useEffect(() => { fetchDashboard(); }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync schema for command dropdowns.
  useEffect(() => { setSchemaData(schema); }, [schema]);

  useEffect(() => {
    if (devMode && !schemaData) {
      loadSchema().then(setSchemaData).catch(() => null);
    }
  }, [devMode, schemaData, loadSchema]);

  const allModels = schemaData?.modules.flatMap((m) => m.models.map((mo) => mo.name)) ?? [];

  const byTab = models.reduce<Record<string, DashboardModel[]>>((acc, m) => {
    const key = m.tab || "(no tab)";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="vs-page">
      <div className="vs-page-title">Dashboard</div>
      <div className="vs-page-subtitle">Models currently configured on the dashboard</div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}

      {!loading && models.length === 0 && (
        <div className="vs-empty" style={{ marginBottom: 24 }}>
          No models on the dashboard yet.
        </div>
      )}

      {Object.entries(byTab).map(([tab, items]) => (
        <div key={tab}>
          <div className="vs-section-title">{tab}</div>
          <table className="vs-table">
            <thead>
              <tr><th>Model</th><th>Resource</th><th>Module</th></tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.resource}>
                  <td>{m.label}</td>
                  <td><code className="vs-code">{m.resource}</code></td>
                  <td style={{ color: "var(--text-muted)" }}>{m.module}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {devMode && (
        <>
          <div className="vs-section-title" style={{ marginTop: 28 }}>Toggle Dashboard Model</div>
          <CommandCard def={toggleDashboardDef(allModels)} onSuccess={onSuccess} />
        </>
      )}
    </div>
  );
}

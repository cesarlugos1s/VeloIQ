import { useEffect, useState } from "react";
import { SearchConfig as SearchConfigType, AppSchema } from "../types";
import { api } from "../api";
import CommandCard, { CommandDef } from "../components/CommandCard";

interface Props {
  devMode: boolean;
  schema: AppSchema | null;
  loadSchema: () => Promise<AppSchema>;
  refreshToken: number;
  onSuccess?: () => void;
}

function toggleSearchModelDef(models: string[]): CommandDef {
  return {
    id: "toggle-search-model",
    label: "Toggle Search Model",
    description: "Add or remove a model from the search index",
    inputs: [
      { key: "name", label: "Model name", type: models.length ? "select" : "text", options: models, required: true },
      { key: "action", label: "Action", type: "select", options: ["add", "remove"], required: true },
    ],
    build: (v) =>
      v.action === "remove"
        ? `veloiq search remove-model ${v.name}`
        : `veloiq search add-model ${v.name}`,
  };
}

function toggleSearchFieldDef(fields: string[]): CommandDef {
  return {
    id: "toggle-search-field",
    label: "Toggle Search Field",
    description: "Add or remove a field from the search index",
    inputs: [
      {
        key: "name",
        label: "Field name",
        type: fields.length ? "select" : "text",
        options: fields,
        required: true,
        placeholder: "e.g. name",
      },
      { key: "action", label: "Action", type: "select", options: ["add", "remove"], required: true },
    ],
    build: (v) =>
      v.action === "remove"
        ? `veloiq search remove-field ${v.name}`
        : `veloiq search add-field ${v.name}`,
  };
}

export default function SearchConfig({ devMode, schema, loadSchema, refreshToken, onSuccess }: Props) {
  const [data, setData] = useState<SearchConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schemaData, setSchemaData] = useState<AppSchema | null>(schema);

  const fetchSearch = () => {
    setLoading(true);
    api.search()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Initial fetch + re-fetch when refreshToken changes.
  useEffect(() => { fetchSearch(); }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync schema for command dropdowns.
  useEffect(() => { setSchemaData(schema); }, [schema]);

  useEffect(() => {
    if (devMode && !schemaData) {
      loadSchema().then(setSchemaData).catch(() => null);
    }
  }, [devMode, schemaData, loadSchema]);

  const allModels = schemaData?.modules.flatMap((m) => m.models.map((mo) => mo.name)) ?? [];
  const indexedFields = data?.fields ?? [];

  return (
    <div className="vs-page">
      <div className="vs-page-title">Search</div>
      <div className="vs-page-subtitle">Models and fields indexed for search</div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}

      {data && (
        <>
          <div className="vs-section-title">Indexed models</div>
          {data.models.length === 0 ? (
            <div className="vs-empty">No models indexed yet.</div>
          ) : (
            <div className="vs-chip-list">
              {data.models.map((m) => <span key={m} className="vs-chip">{m}</span>)}
            </div>
          )}

          <div className="vs-section-title">Indexed fields</div>
          {data.fields.length === 0 ? (
            <div className="vs-empty">No fields indexed yet.</div>
          ) : (
            <div className="vs-chip-list">
              {data.fields.map((f) => <span key={f} className="vs-chip">{f}</span>)}
            </div>
          )}
        </>
      )}

      {devMode && (
        <>
          <div className="vs-section-title" style={{ marginTop: 28 }}>Toggle Search Model</div>
          <CommandCard def={toggleSearchModelDef(allModels)} onSuccess={onSuccess} />

          <div className="vs-section-title" style={{ marginTop: 20 }}>Toggle Search Field</div>
          <CommandCard def={toggleSearchFieldDef(indexedFields)} onSuccess={onSuccess} />
        </>
      )}
    </div>
  );
}

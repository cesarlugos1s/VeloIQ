import { useEffect, useState } from "react";
import { AppSchema } from "../types";
import CommandCard, { CommandDef } from "../components/CommandCard";

interface Props {
  schema: AppSchema | null;
  loadSchema: () => Promise<AppSchema>;
  onSuccess?: () => void;
}

function buildCommands(schema: AppSchema | null): CommandDef[] {
  const modules = schema?.modules.map((m) => m.name) ?? [];

  return [
    {
      id: "add-module",
      label: "Add Module",
      description: "Scaffold a new module directory under app/modules/",
      inputs: [
        { key: "name", label: "Module name", type: "text", required: true, placeholder: "e.g. inventory" },
      ],
      build: (v) => `veloiq add-module ${v.name}`,
    },
    {
      id: "add-model",
      label: "Add Model",
      description: "Scaffold a new model — or use the Schema Browser to add into a specific module",
      inputs: [
        { key: "name", label: "Model name", type: "text", required: true, placeholder: "e.g. Product" },
        { key: "module", label: "Module", type: modules.length ? "select" : "text", options: modules, required: true },
      ],
      build: (v) => `veloiq add-model ${v.name} --module ${v.module} --no-migrate`,
    },
    {
      id: "generate",
      label: "Generate",
      description: "Regenerate all frontend schemas and navigation from current module definitions",
      inputs: [],
      build: () => "veloiq generate",
    },
  ];
}

export default function CommandPanel({ schema, loadSchema, onSuccess }: Props) {
  const [data, setData] = useState<AppSchema | null>(schema);
  const [loading, setLoading] = useState(!schema);

  useEffect(() => {
    if (data) return;
    setLoading(true);
    loadSchema().then(setData).finally(() => setLoading(false));
  }, [data, loadSchema]);

  const commands = buildCommands(data);

  return (
    <div className="vs-page">
      <div className="vs-page-title">Command Panel</div>
      <div className="vs-page-subtitle">
        Global scaffolding commands. Field, relation, dashboard, and search commands are
        available directly on their respective pages.
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading schema…</p>}

      <div className="vs-cmd-grid">
        {commands.map((def) => (
          <CommandCard key={def.id} def={def} onSuccess={onSuccess} />
        ))}
      </div>
    </div>
  );
}

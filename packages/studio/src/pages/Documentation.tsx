import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { DocumentationAction, DocumentationGuide } from "../types";
import CommandCard, { CommandDef, InputDef } from "../components/CommandCard";

/** The command line for an action and the typed values. The server accepts only names and versions made of letters, digits, dots, hyphens and underscores, and plain web addresses. */
function buildDocumentationCommand(action: DocumentationAction, values: Record<string, string>): string {
  const fill = (template: string) => template.replace(/\{(\w+)\}/g, (_, key: string) => (values[key] ?? "").trim());
  const parts = [fill(action.command)];
  for (const [inputKey, template] of action.optional_argument_templates) {
    if ((values[inputKey] ?? "").trim()) parts.push(fill(template));
  }
  return parts.join(" ");
}

function buildCommandDefinition(action: DocumentationAction, guide: DocumentationGuide): CommandDef {
  const { status } = guide;
  const choicesBySource: Record<string, string[]> = {
    in_progress_changes: status.in_progress_changes,
    applied_changes: status.applied_changes,
  };
  const inputs: InputDef[] = action.inputs.map((input) => {
    const choices = choicesBySource[input.source] ?? [];
    const isChoice = input.source !== "text" && choices.length > 0;
    return {
      key: input.key,
      label: input.label,
      type: isChoice ? "select" : "text",
      options: isChoice ? choices : undefined,
      required: input.required,
      placeholder: input.placeholder || input.help_text,
    };
  });
  const needsMissingChange = action.inputs.some(
    (input) => input.source !== "text" && (choicesBySource[input.source] ?? []).length === 0
  );
  const notes: string[] = [`When to use it: ${action.when_to_use}`];
  action.inputs.filter((input) => input.help_text).forEach((input) => notes.push(`${input.label}: ${input.help_text}`));
  if (!status.installed && action.identifier !== "install") notes.push("Set up the documentation workflow first.");
  if (needsMissingChange) {
    notes.push(action.inputs.some((i) => i.source === "in_progress_changes")
      ? "There is no change in progress. Use \"Start a change\" first."
      : "There is no applied change yet. Apply a change first.");
  }
  return {
    id: `docs-${action.identifier}`,
    label: action.label,
    description: action.summary,
    inputs,
    build: (values) => buildDocumentationCommand(action, values),
    note: { paragraphs: notes.map((text) => ({ text })) },
  };
}

export default function Documentation() {
  const [guide, setGuide] = useState<DocumentationGuide | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.documentation().then(setGuide).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const status = guide?.status;

  return (
    <div className="vs-page">
      <div className="vs-page-title">Documentation workflow</div>
      <div className="vs-page-subtitle">
        Keep the change documents (epics, user stories, designs) and the Product Specification in sync, as files in this
        project's git repository under <code>openspec/</code>. Work through the cards from the top: set up, start a change,
        validate it, apply it, then generate the data model and the help drafts.
      </div>

      {error && <p style={{ color: "var(--error)" }}>{error}</p>}
      {!guide && !error && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {status && (
        <>
          <div className="vs-kv-grid">
            <div className="vs-kv-row">
              <div className="vs-kv-key">Set up</div>
              <div className="vs-kv-val">
                <span className={`vs-tag ${status.installed ? "vs-tag-ok" : "vs-tag-err"}`}>
                  {status.installed ? "yes" : "no"}
                </span>
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">In progress</div>
              <div className="vs-kv-val">{status.in_progress_changes.join(", ") || "no change in progress"}</div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Applied</div>
              <div className="vs-kv-val">{status.applied_changes.length} change(s)</div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Specification elements</div>
              <div className="vs-kv-val">
                {Object.entries(status.element_counts).map(([type, count]) => `${type}: ${count}`).join("   ") || "none yet"}
              </div>
            </div>
            <div className="vs-kv-row">
              <div className="vs-kv-key">Help drafts</div>
              <div className="vs-kv-val">{status.help_draft_count}</div>
            </div>
          </div>
          <div className="vs-warn-banner" style={{ marginTop: 12 }}>
            Next step: {status.next_step}
          </div>
        </>
      )}

      {guide && (
        <div className="vs-cmd-grid" style={{ marginTop: 16 }}>
          {guide.actions.map((action) => (
            <CommandCard key={action.identifier} def={buildCommandDefinition(action, guide)} onSuccess={load} />
          ))}
        </div>
      )}
    </div>
  );
}

"""Generate a ``user_guide.pdf`` from curated Help content.

Reads the already-generated ``frontend/src/navigation.config.json`` for
module -> model ordering, pulls only *curated* ``HelpDocument`` rows (body
edited away from the generic seed template — see ``help/seed.py``) filtered
by the current license pool, and renders them (with their ``HelpAction``
labels) into a PDF written to ``<host app root>/docs/user_manuals/user_guide.pdf``.

Deliberately has no dependency on the IQVigilant extension package or its
``documents_dir`` config — this is a core VeloIQ framework feature and must
work in host apps that never install IQVigilant.
"""
import json
from pathlib import Path

from veloiq_framework.help.seed import (
    DASHBOARD_MAIN_PAGE_KEY,
    DASHBOARD_MAIN_TEMPLATE,
    GENERIC_PAGE_TEMPLATES,
    PAGE_TYPES,
)

_OUTPUT_RELATIVE_PATH = Path("docs") / "user_manuals" / "user_guide.pdf"

_PDF_CSS = """
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; }
  h1 { font-size: 20pt; }
  h2 { font-size: 16pt; page-break-before: always; margin-top: 0; }
  h2:first-of-type { page-break-before: avoid; }
  h3 { font-size: 13pt; margin-top: 1.2em; }
  ul { margin-top: 0.2em; }
  li { margin-bottom: 0.2em; }
</style>
"""


def _load_navigation_entries(root: Path) -> list[dict]:
    nav_file = root / "frontend" / "src" / "navigation.config.json"
    if not nav_file.exists():
        return []
    try:
        return json.loads(nav_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def _group_by_module(nav_entries: list[dict]) -> list[tuple[str, str, list[dict]]]:
    """Return ``[(module_key, module_label, [model_entry, ...]), ...]``.

    ``nav_entries`` is already ordered ``module_index*10 + model_index`` by
    ``api_schema_gen.py``'s ``_update_nav_config``, so a single linear pass
    (bucketing each ``type: "model"`` entry under the preceding
    ``type: "module"`` entry) reconstructs the hierarchy. The synthetic
    ``dashboard`` pseudo-module is skipped — it has no ``model`` children.
    """
    groups: list[tuple[str, str, list[dict]]] = []
    current: tuple[str, str, list[dict]] | None = None
    for entry in nav_entries:
        if entry.get("type") == "module":
            key = entry.get("key", "")
            if key == "dashboard":
                current = None
                continue
            module_key = key[len("module:"):] if key.startswith("module:") else key
            current = (module_key, entry.get("label", module_key), [])
            groups.append(current)
        elif entry.get("type") == "model" and current is not None:
            current[2].append(entry)
    return groups


def _is_curated(body: str, page_type: str) -> bool:
    default = GENERIC_PAGE_TEMPLATES.get(page_type, "")
    return body.strip() != default.strip()


def _fetch_curated_docs(session, resource: str) -> list[tuple[str, str, list[str]]]:
    """Return ``[(page_type, body, [action_label, ...]), ...]`` for curated pages only."""
    from sqlmodel import select
    from veloiq_framework.help.models import HelpAction, HelpDocument

    results: list[tuple[str, str, list[str]]] = []
    for page_type in PAGE_TYPES:
        page_key = f"{resource}:{page_type}"
        doc = session.exec(select(HelpDocument).where(HelpDocument.page_key == page_key)).first()
        if doc is None or not _is_curated(doc.body, page_type):
            continue
        actions = session.exec(
            select(HelpAction).where(HelpAction.document_id == doc.id).order_by(HelpAction.order)
        ).all()
        results.append((page_type, doc.body, [a.label for a in actions if a.label]))
    return results


def _fetch_curated_dashboard_doc(session) -> tuple[str, list[str]] | None:
    from sqlmodel import select
    from veloiq_framework.help.models import HelpAction, HelpDocument

    doc = session.exec(select(HelpDocument).where(HelpDocument.page_key == DASHBOARD_MAIN_PAGE_KEY)).first()
    if doc is None or doc.body.strip() == DASHBOARD_MAIN_TEMPLATE.strip():
        return None
    actions = session.exec(
        select(HelpAction).where(HelpAction.document_id == doc.id).order_by(HelpAction.order)
    ).all()
    return doc.body, [a.label for a in actions if a.label]


def _build_markdown(engine, extensions: list, nav_entries: list[dict]) -> str:
    from sqlmodel import Session

    from veloiq_framework.licensing_utils import aggregate_license_pool, is_module_licensed

    pool = aggregate_license_pool(extensions)
    groups = _group_by_module(nav_entries)

    lines: list[str] = ["# User Guide\n"]

    with Session(engine) as session:
        dashboard_doc = _fetch_curated_dashboard_doc(session)
        if dashboard_doc is not None:
            body, action_labels = dashboard_doc
            lines.append("## Dashboard\n")
            lines.append(body.strip() + "\n")
            if action_labels:
                lines.append("**Actions:**\n")
                lines.extend(f"- {label}" for label in action_labels)
                lines.append("")

        for module_key, module_label, model_entries in groups:
            if not is_module_licensed(module_key, pool):
                continue

            module_sections: list[str] = []
            for model_entry in model_entries:
                resource = model_entry.get("key", "")
                if not resource:
                    continue
                curated = _fetch_curated_docs(session, resource)
                if not curated:
                    continue
                model_label = model_entry.get("label", resource)
                section = [f"### {model_label}\n"]
                for page_type, body, action_labels in curated:
                    section.append(f"**{page_type.replace('-', ' ').title()}**\n")
                    section.append(body.strip() + "\n")
                    if action_labels:
                        section.append("**Actions:**\n")
                        section.extend(f"- {label}" for label in action_labels)
                        section.append("")
                module_sections.append("\n".join(section))

            if not module_sections:
                continue
            lines.append(f"## {module_label}\n")
            lines.extend(module_sections)

    return "\n".join(lines)


def generate_user_guide(engine, extensions: list, root: Path) -> Path:
    """Generate/overwrite ``<root>/docs/user_manuals/user_guide.pdf`` and return its path."""
    import markdown as _markdown
    from xhtml2pdf import pisa as _pisa

    nav_entries = _load_navigation_entries(root)
    md_text = _build_markdown(engine, extensions, nav_entries)
    html_body = _markdown.markdown(md_text, extensions=["extra"])
    html = f"<html><head>{_PDF_CSS}</head><body>{html_body}</body></html>"

    output_path = root / _OUTPUT_RELATIVE_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "wb") as f:
        result = _pisa.CreatePDF(html, dest=f)
    if result.err:
        raise RuntimeError(f"PDF generation failed with {result.err} error(s).")

    return output_path

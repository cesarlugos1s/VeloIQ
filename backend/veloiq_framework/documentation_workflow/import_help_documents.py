"""Import reviewed help drafts into the application's help documents (`veloiq docs help import`)."""
from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

from veloiq_framework.documentation_workflow.help_document_contract import (
    HELP_STATUS_REVIEWED, managed_section, merge_managed_section, parse_help_draft,
)
from veloiq_framework.documentation_workflow.draft_help_documents_from_features import HELP_DRAFTS_FOLDER_NAME
from veloiq_framework.documentation_workflow.workflow_constants import OPENSPEC_FOLDER_NAME


@dataclass
class HelpImportReport:
    created_documents: list[str] = field(default_factory=list)
    updated_documents: list[str] = field(default_factory=list)
    added_actions: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)   # "<draft file>: reason"


@contextmanager
def _inside_backend_folder(project_root: Path):
    """Run with the backend folder as the working directory, so a relative sqlite DATABASE_URL resolves as the app does."""
    previous = Path.cwd()
    os.chdir(project_root / "backend")
    try:
        yield
    finally:
        os.chdir(previous)


def create_engine_for_project(project_root: Path):
    """Return a SQLAlchemy engine for the project's DATABASE_URL (read from the environment or backend/.env)."""
    from dotenv import load_dotenv
    from sqlalchemy import create_engine
    env_file = project_root / "backend" / ".env"
    if env_file.exists():
        load_dotenv(env_file, override=False)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set; set it or add it to backend/.env.")
    return create_engine(database_url)


def import_help_documents(project_root: Path, include_unreviewed: bool = False, dry_run: bool = False, engine=None) -> HelpImportReport:
    """Write each importable draft into its help documents; return what was created, updated, added and skipped."""
    from sqlmodel import Session, select
    from veloiq_framework.help.models import HelpAction, HelpDocument

    report = HelpImportReport()
    drafts_folder = project_root / OPENSPEC_FOLDER_NAME / HELP_DRAFTS_FOLDER_NAME
    draft_files = sorted(drafts_folder.glob("*.md")) if drafts_folder.exists() else []
    importable = []
    for draft_file in draft_files:
        draft = parse_help_draft(draft_file.read_text(encoding="utf-8"))
        if draft.status != HELP_STATUS_REVIEWED and not include_unreviewed:
            report.skipped.append(f"{draft_file.name}: status is {draft.status}; set `status: reviewed` once the text is approved")
        elif draft.problems:
            report.skipped.append(f"{draft_file.name}: " + "; ".join(draft.problems))
        else:
            importable.append((draft_file, draft))
    if not importable:
        return report

    with _inside_backend_folder(project_root):
        engine = engine or create_engine_for_project(project_root)
        with Session(engine) as session:
            for draft_file, draft in importable:
                section = managed_section(draft.source_element, draft)
                for page_key in draft.page_keys:
                    document = session.exec(select(HelpDocument).where(HelpDocument.page_key == page_key)).first()
                    if document is None:
                        document = HelpDocument(page_key=page_key, title=draft.title, body=merge_managed_section("", draft.source_element, section))
                        session.add(document)
                        session.flush()
                        report.created_documents.append(page_key)
                    else:
                        document.body = merge_managed_section(document.body or "", draft.source_element, section)
                        session.add(document)
                        report.updated_documents.append(page_key)
                    existing_actions = session.exec(select(HelpAction).where(HelpAction.document_id == document.id)).all()
                    known_keys = {action.action_key for action in existing_actions}
                    next_order = max([action.order for action in existing_actions], default=-1) + 1
                    for action_key, label in draft.actions:
                        if action_key not in known_keys:
                            session.add(HelpAction(document_id=document.id, label=label, action_key=action_key, order=next_order))
                            next_order += 1
                            report.added_actions.append(f"{page_key}: {action_key}")
            if dry_run:
                session.rollback()
            else:
                session.commit()
    return report

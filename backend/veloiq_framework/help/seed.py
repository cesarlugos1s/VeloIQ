"""Seed generic per-page-type help content for every host-app resource.

Unlike ``seed_roles`` (which refreshes ``allowed_methods``/``is_preset`` on
every boot but preserves user-edited ``description``), this seed is strictly
insert-if-missing: a HelpDocument row is only ever created once per
``page_key``. Once a row exists — whether it was seeded here or written by
hand — it becomes the admin's own content, and this function must never
overwrite it again on a later restart.
"""

PAGE_TYPES: list[str] = ["list", "show", "edit", "create", "dashboard-cell"]

# Fixed sentinel page_key describing the Dashboard page itself — not looped
# per resource, since it isn't about any one model.
DASHBOARD_MAIN_PAGE_KEY = "_dashboard:main"

# Tables that are framework-internal, not host-app CRUD resources — excluded
# from auto-seeding. If these ever need help content, it should be
# framework-authored specifically, not generic-templated.
_INTERNAL_TABLE_PREFIX = "veloiq_"

GENERIC_PAGE_TEMPLATES: dict[str, str] = {
    "list": (
        "# Using this list page\n\n"
        "- **Switch views** — use the view switcher above the table to see records "
        "as a table, gallery, or calendar, depending on what this page supports.\n"
        "- **Select multiple rows** — check the boxes on the left of any rows, then "
        "use the action bar that appears above the table to apply a bulk action "
        "(edit a field, delete, export to CSV, or a custom action) to all selected "
        "rows at once.\n"
        "- **Open a record** — click a row to open it. If you're already viewing a "
        "record in a side panel, the new one opens as an additional panel alongside "
        "it; use the panel's toolbar to close, minimize, maximize, or open it as its "
        "own full page in a new tab.\n"
    ),
    "show": (
        "# Viewing this record\n\n"
        "- **Related records** — sections below the main fields show records "
        "related to this one. Click a related record to open it in a new side "
        "panel next to this one, without losing your place here.\n"
        "- **Panels** — each open panel has its own toolbar (top-right of the "
        "panel) to close it, minimize it, maximize it, or pop it out to its own "
        "full-page tab.\n"
        "- **Buttons** — actions available for this specific record appear at the "
        "top of the page.\n"
    ),
    "edit": (
        "# Editing this record\n\n"
        "- **Field types** — each field uses the input appropriate to its data "
        "(text, numbers, dates, dropdowns, related-record pickers, etc.).\n"
        "- **Related lists** — some sections let you add, remove, or edit related "
        "records directly from this page.\n"
        "- **Save or cancel** — your changes are only applied when you save; "
        "navigating away without saving discards them.\n"
    ),
    "create": (
        "# Creating a new record\n\n"
        "- **Required fields** — fields marked as required must be filled in "
        "before you can save.\n"
        "- **Defaults** — some fields are pre-filled with sensible defaults; you "
        "can change them before saving.\n"
        "- **Related records** — you can link this new record to existing related "
        "records, or in some cases create them inline.\n"
    ),
    "dashboard-cell": (
        "# This Dashboard cell\n\n"
        "- **Mirrors the list** — shows the same records as this resource's List "
        "page, using whichever view (table, gallery, calendar) is configured for "
        "this cell.\n"
        "- **Configure** — use the cell's toolbar to resize, move, or reconfigure "
        "what it shows.\n"
        "- **Open full page** — click the link icon to open this resource's own "
        "List page in a new tab.\n"
    ),
}

# Seeded once (not per resource) — describes the Dashboard page itself.
DASHBOARD_MAIN_TEMPLATE = (
    "# Using the Dashboard\n\n"
    "- **Tabs** group related cells together — switch tabs to see a different "
    "set of cells.\n"
    "- **Cells** each mirror one resource's List page (or a chart/named query), "
    "configurable independently.\n"
    "- **Pinned records** — records pinned from any Show page (via \"Pin to "
    "Dashboard\") appear in the Pinned Records tab.\n"
)


# Default runnable actions per page type, seeded onto every generic
# page-type doc. Only actions that are safely generic for literally any
# resource are auto-seeded here — view-type-switch actions (gallery/
# calendar) are NOT included because the backend has no visibility into
# which view types a specific resource's frontend ModelDef actually
# supports; those are for a content author to add by hand only where
# relevant. Destructive/live-form-state actions (Delete, Save, Duplicate)
# and the Actions-preferences gear are never included — see the Phase-2
# plan's action inventory for the full reasoning.
GENERIC_PAGE_ACTIONS: dict[str, list[tuple[str, str]]] = {
    "list": [
        ("Create New", "create_new"),
        ("Export to CSV", "export_csv"),
        ("Import CSV", "open_import"),
        ("Metadata", "open_metadata"),
        ("View Configuration", "open_view_config"),
    ],
    "show": [
        ("Go to Edit", "go_to_edit"),
        ("Back to List", "go_to_list"),
        ("Pin to Dashboard", "pin_to_dashboard"),
        ("Explore", "open_explore"),
    ],
    "edit": [
        ("Go to Show", "go_to_show"),
    ],
    "create": [],
    "dashboard-cell": [],
}


def seed_help_documents(engine) -> None:
    """Insert a generic page-type help doc (+ default actions) for every host-app resource.

    Enumerates ``SQLModel.metadata.sorted_tables`` (populated once all host
    app + extension modules have been loaded) and, for every non-framework
    table, ensures a HelpDocument exists for each of ``list``/``show``/
    ``edit``/``create`` — pre-filled with the matching generic template.

    Every resource gets all 4 page_keys unconditionally, even if a given
    model doesn't actually expose e.g. a Create page — the unused row is
    harmless. This never updates an existing HelpDocument row (see module
    docstring), but it does backfill GENERIC_PAGE_ACTIONS onto a document
    that has zero HelpAction rows yet — safe because no document could have
    ever had one of these auto-seeded actions manually removed before this
    function started seeding them.
    """
    from sqlmodel import SQLModel, Session, select
    from veloiq_framework.help.models import HelpDocument, HelpAction

    def _ensure_doc(session, page_key: str, title: str, body: str, actions: list[tuple[str, str]]) -> None:
        doc = session.exec(select(HelpDocument).where(HelpDocument.page_key == page_key)).first()
        if doc is None:
            doc = HelpDocument(page_key=page_key, title=title, body=body)
            session.add(doc)
            session.flush()  # assigns doc.id for the actions below

        has_actions = session.exec(
            select(HelpAction).where(HelpAction.document_id == doc.id)
        ).first() is not None
        if not has_actions:
            for order, (label, action_key) in enumerate(actions):
                session.add(HelpAction(
                    document_id=doc.id,
                    label=label,
                    action_key=action_key,
                    order=order,
                ))

    with Session(engine) as session:
        table_names = [
            table.name
            for table in SQLModel.metadata.sorted_tables
            if not table.name.startswith(_INTERNAL_TABLE_PREFIX)
        ]
        for resource in table_names:
            for page_type in PAGE_TYPES:
                _ensure_doc(
                    session,
                    page_key=f"{resource}:{page_type}",
                    title=f"{resource} — {page_type}",
                    body=GENERIC_PAGE_TEMPLATES[page_type],
                    actions=GENERIC_PAGE_ACTIONS[page_type],
                )

        # Single fixed row describing the Dashboard page itself — not looped
        # per resource, since it isn't about any one model.
        _ensure_doc(
            session,
            page_key=DASHBOARD_MAIN_PAGE_KEY,
            title="Dashboard",
            body=DASHBOARD_MAIN_TEMPLATE,
            actions=[],
        )

        session.commit()

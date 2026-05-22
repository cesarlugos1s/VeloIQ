"""Named query definitions for VeloIQ apps.

A NamedQuery lets developers expose a cross-model ORM join as a first-class
framework resource — with a sidebar entry, schema-driven list/edit views, and
automatic injection as a relation tab on the primary model's show page.

Usage (in ``app/modules/<module>/queries.py``)::

    from veloiq_framework import NamedQuery, NamedQueryField
    from sqlmodel import select
    from .models import Project
    from ..tasks.models import Task
    from ..team.models import TeamMember

    projects_with_tasks_and_members = NamedQuery(
        name="projects_with_tasks_and_members",
        label="Projects with Tasks and Members",
        module="projects",
        primary_model=Project,
        participating_models=[Project, Task, TeamMember],
        list_view_type="table",
        default_sort=("due_date", "asc"),
        fields=[
            NamedQueryField(key="project_name", label="Project",
                            source_model=Project, source_attr="name"),
            NamedQueryField(key="task_title", label="Task",
                            source_model=Task, source_attr="title", read_only=True),
            ...
        ],
        query_factory=lambda session, user: (
            select(Project.id, Project.name.label("project_name"), ...)
            .select_from(Project)
            .join(Project.tasks)
            .join(Task.assignee, isouter=True)
        ),
    )

The framework auto-discovers all ``NamedQuery`` instances exported from each
module's ``queries.py`` — no manual registration step.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class NamedQueryField:
    """Describes one column in a NamedQuery result set.

    Parameters
    ----------
    key:
        Column name as it appears in the result dict (may be an alias).
    label:
        Human-readable display label.  Auto-derived from *key* if empty.
    type:
        TypeScript display type: ``"string"``, ``"number"``, ``"boolean"``,
        ``"date"``, or ``"datetime"``.
    source_model:
        The SQLModel class this field originates from.  Used for RBAC
        enforcement and write-field routing (only primary-model fields are
        written on PUT/PATCH).  Defaults to the query's ``primary_model``.
    source_attr:
        Attribute name on *source_model*.  Defaults to *key* when empty.
    read_only:
        When ``True`` the field is rendered as non-editable in the edit form.
        Fields whose ``source_model`` differs from the primary model should
        set this to ``True``.
    reference:
        Tablename of the FK target (e.g. ``"project"``).  When set the UI
        renders a link/dropdown for this field and the framework uses it to
        infer which show pages should receive a named-query relation tab.
    """

    key: str
    label: str = ""
    type: str = "string"
    source_model: Any = None
    source_attr: str = ""
    read_only: bool = False
    reference: str = ""

    def __post_init__(self) -> None:
        if not self.label:
            self.label = self.key.replace("_", " ").title()
        if not self.source_attr:
            self.source_attr = self.key


@dataclass
class NamedQuery:
    """A developer-defined cross-model ORM query exposed as a framework resource.

    The framework registers a FastAPI router at ``/{name}``, generates a
    TypeScript schema entry, adds a sidebar menu item, and injects a relation
    tab on the primary model's show page — all automatically.

    Parameters
    ----------
    name:
        URL-safe slug used as the endpoint prefix (e.g. ``"projects_with_tasks"``).
    label:
        Display name shown in the sidebar.
    primary_model:
        The SQLModel class that owns editable fields and drives show/edit
        navigation.  Its PK is used as ``pkField`` and as the ``eid`` in API
        responses.
    fields:
        Ordered list of columns to expose.  Fields whose ``source_model``
        differs from ``primary_model`` should have ``read_only=True``.
    module:
        Module folder name (determines sidebar grouping and schema file).
    query_factory:
        ``(session, user: dict | None) -> sqlalchemy.Select`` — called on
        every request to produce the base SELECT.  The framework appends
        WHERE / ORDER BY / LIMIT on top.  Do not hard-code pagination or
        user-specific filters here; use the ``user`` argument for ReBAC-style
        scoping if needed.
    list_view_type:
        Default view type for the list page (``"table"``, ``"gallery"``, …).
    default_sort:
        ``(field_key, "asc" | "desc")`` — applied when no user preference
        exists.  ``field_key`` must match one of the *fields* keys.
    participating_models:
        All SQLModel classes involved in the join.  The framework checks RBAC
        permissions for every model in this list before serving any request.
    """

    name: str
    label: str
    primary_model: Any
    fields: list[NamedQueryField]
    module: str
    query_factory: Callable
    list_view_type: str = "table"
    default_sort: tuple[str, str] | None = None
    participating_models: list[Any] = field(default_factory=list)

    def __post_init__(self) -> None:
        # Ensure primary_model is always in participating_models.
        if self.primary_model not in self.participating_models:
            self.participating_models = [self.primary_model, *self.participating_models]
        # Back-fill source_model on fields that omit it.
        for f in self.fields:
            if f.source_model is None:
                f.source_model = self.primary_model

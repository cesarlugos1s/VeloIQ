from typing import TYPE_CHECKING, List, Optional
from safemantiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:
    from app.modules.projects.models import Project
    from app.modules.tasks.models import Task


class TeamMember(TimestampedModel, table=True):
    __tablename__ = "team_member"

    name: str
    email: str
    role: str = "member"  # admin | member | viewer

    owned_projects: List["Project"] = jm_relationship(back_populates="owner")
    assigned_tasks: List["Task"] = jm_relationship(back_populates="assignee")

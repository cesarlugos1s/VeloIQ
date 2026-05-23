from typing import TYPE_CHECKING, ClassVar, Dict, List, Optional
from veloiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:
    from app.modules.projects.models import Project
    from app.modules.tasks.models import Task


class TeamMember(TimestampedModel, table=True):
    __tablename__ = "team_member"
    __veloiq_ui__: ClassVar[Dict] = {"listViewType": "gallery"}

    name: str
    email: str
    role: str = "member"  # admin | member | viewer
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

    owned_projects: List["Project"] = jm_relationship(back_populates="owner")
    assigned_tasks: List["Task"] = jm_relationship(back_populates="assignee")

from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:
    from app.modules.team.models import TeamMember
    from app.modules.tasks.models import Task


class Project(TimestampedModel, table=True):
    __tablename__ = "project"

    name: str
    description: Optional[str] = None
    status: str = "active"  # active | completed | archived

    owner_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    owner: Optional["TeamMember"] = jm_relationship(back_populates="owned_projects")
    tasks: List["Task"] = jm_relationship(back_populates="project")

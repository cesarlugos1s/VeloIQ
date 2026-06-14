from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship, veloiq_field

if TYPE_CHECKING:
    from app.modules.team.models import TeamMember
    from app.modules.tasks.models import Task


class Project(TimestampedModel, table=True):
    """A container for related tasks with an owner and a lifecycle status."""

    __tablename__ = "project"

    name: str = Field(description="Project name")
    description: Optional[str] = Field(default=None, description="Goals, scope, and background")
    status: str = veloiq_field(default="active", options=["planning", "active", "on_hold", "completed", "archived"], description="Current lifecycle phase")

    owner_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    owner: Optional["TeamMember"] = jm_relationship(back_populates="owned_projects")
    tasks: List["Task"] = jm_relationship(back_populates="project")

import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:
    from app.modules.projects.models import Project
    from app.modules.team.models import TeamMember


class Task(TimestampedModel, table=True):
    __tablename__ = "task"

    title: str
    description: Optional[str] = None
    status: str = "todo"        # todo | in_progress | done
    priority: str = "medium"    # low | medium | high | critical
    due_date: Optional[datetime.date] = None
    planned_work_hours: Optional[float] = None
    actual_work_hours: Optional[float] = None

    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    project: Optional["Project"] = jm_relationship(back_populates="tasks")

    assignee_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    assignee: Optional["TeamMember"] = jm_relationship(back_populates="assigned_tasks")

    # Self-referential: a task can have sub-tasks (enables Miller columns tree view)
    parent_task_id: Optional[int] = Field(default=None, foreign_key="task.id")
    subtasks: List["Task"] = jm_relationship(
        back_populates="parent_task",
        sa_relationship_kwargs={"foreign_keys": "[Task.parent_task_id]"},
    )
    parent_task: Optional["Task"] = jm_relationship(
        back_populates="subtasks",
        sa_relationship_kwargs={
            "foreign_keys": "[Task.parent_task_id]",
            "remote_side": "[Task.id]",
        },
    )

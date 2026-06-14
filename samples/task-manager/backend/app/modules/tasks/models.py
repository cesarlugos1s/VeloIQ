import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship, veloiq_field

if TYPE_CHECKING:
    from app.modules.projects.models import Project
    from app.modules.team.models import TeamMember


class Task(TimestampedModel, table=True):
    """A unit of work that belongs to a project and can be assigned to a team member."""

    __tablename__ = "task"

    title: str = Field(description="Short summary of the work to be done")
    description: Optional[str] = Field(default=None, description="Full details and acceptance criteria")
    status: str = veloiq_field(default="todo", options=["todo", "in_progress", "done", "cancelled"], description="Current workflow state")
    priority: str = veloiq_field(default="medium", options=["low", "medium", "high", "critical"], description="Urgency level")
    due_date: Optional[datetime.date] = Field(default=None, description="Target completion date")
    planned_work_hours: Optional[float] = Field(default=None, description="Estimated effort in hours")
    actual_work_hours: Optional[float] = Field(default=None, description="Actual hours spent")
    planned_cost: Optional[float] = Field(default=None, description="Budgeted cost for this task")
    actual_cost: Optional[float] = Field(default=None, description="Cost incurred so far")
    actual_progress: Optional[int] = Field(default=None, description="Completion percentage (0–100)")
    rating: Optional[int] = Field(default=None, description="Quality rating on completion (1–5)")

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

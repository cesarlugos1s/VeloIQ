"""Named queries for the projects module."""
from sqlmodel import select

from veloiq_framework import NamedQuery, NamedQueryField

from .models import Project
from app.modules.tasks.models import Task
from app.modules.team.models import TeamMember

# "Projects with Tasks and Team Members"
# Join path: Project (root) → Task (ONETOMANY via Project.tasks relationship)
#            → TeamMember (MANYTOONE via Task.assignee relationship).
# All joins use ORM relationship attributes — no explicit foreign-key conditions.
#
# Primary model is Project: show/edit navigation targets the Project record.
# Each result row represents one (Project × Task) pair; Project.id is the eid.
# Multiple rows for the same project are expected for projects with multiple tasks.
#
# This query automatically appears as a relation tab on the Project show page
# (Pattern A: primary model IS Project → scoped by ?id={projectId}).
projects_with_tasks_and_members = NamedQuery(
    name="projects_with_tasks_and_members",
    label="Projects with Tasks and Members",
    module="projects",
    primary_model=Project,
    participating_models=[Project, Task, TeamMember],
    list_view_type="table",
    default_sort=("due_date", "asc"),
    fields=[
        NamedQueryField(
            key="project_name",
            label="Project",
            type="string",
            source_model=Project,
            source_attr="name",
        ),
        NamedQueryField(
            key="project_status",
            label="Project Status",
            type="string",
            source_model=Project,
            source_attr="status",
        ),
        NamedQueryField(
            key="task_title",
            label="Task",
            type="string",
            source_model=Task,
            source_attr="title",
            read_only=True,
        ),
        NamedQueryField(
            key="task_status",
            label="Task Status",
            type="string",
            source_model=Task,
            source_attr="status",
            read_only=True,
        ),
        NamedQueryField(
            key="due_date",
            label="Due Date",
            type="date",
            source_model=Task,
            read_only=True,
        ),
        NamedQueryField(
            key="planned_work_hours",
            label="Planned Hours",
            type="number",
            source_model=Task,
            read_only=True,
        ),
        NamedQueryField(
            key="actual_work_hours",
            label="Actual Hours",
            type="number",
            source_model=Task,
            read_only=True,
        ),
        NamedQueryField(
            key="assignee_name",
            label="Assignee",
            type="string",
            source_model=TeamMember,
            source_attr="name",
            read_only=True,
        ),
    ],
    query_factory=lambda session, user: (
        select(
            Project.id,
            Project.name.label("project_name"),
            Project.status.label("project_status"),
            Task.title.label("task_title"),
            Task.status.label("task_status"),
            Task.due_date,
            Task.planned_work_hours,
            Task.actual_work_hours,
            TeamMember.name.label("assignee_name"),
        )
        .select_from(Project)               # root: Project
        .join(Project.tasks)                # Project → Task  (ONETOMANY relationship)
        .join(Task.assignee, isouter=True)  # Task   → TeamMember (MANYTOONE, left outer)
    ),
)

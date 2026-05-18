from sqladmin import ModelView
from app.modules.projects.models import Project


class ProjectAdmin(ModelView, model=Project):
    column_list = [Project.id, Project.name, Project.status, Project.owner_id]
    column_searchable_list = [Project.name]
    icon = "fa-solid fa-diagram-project"

from sqladmin import ModelView
from app.modules.tasks.models import Task


class TaskAdmin(ModelView, model=Task):
    column_list = [Task.id, Task.title, Task.status, Task.priority, Task.due_date, Task.assignee_id]
    column_searchable_list = [Task.title]
    column_sortable_list = [Task.priority, Task.due_date, Task.status]
    icon = "fa-solid fa-list-check"

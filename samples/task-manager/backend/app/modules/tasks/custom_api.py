"""Custom endpoints for the tasks module.

Demonstrates the custom_api.py pattern: import the generated router from
api.py and add domain-specific endpoints on top.  The loader picks up both
api.py and custom_api.py automatically.
"""
from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from veloiq_framework import get_session

from .api import router
from .models import Task


@router.post("/{task_id}/complete", summary="Mark a task as done")
def complete_task(task_id: int, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    task.status = "done"
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"id": task.id, "status": task.status}


@router.get("/by-project/{project_id}", summary="List tasks for a project")
def tasks_by_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    tasks = session.exec(
        select(Task).where(Task.project_id == project_id)
    ).all()
    return [t.model_dump() for t in tasks]

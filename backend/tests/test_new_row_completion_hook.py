"""A model's ``veloiq_complete_new_row`` completes a new row before the generic create validates it."""
import pytest
from fastapi import HTTPException

from veloiq_framework.crud import NEW_ROW_COMPLETION_HOOK


@pytest.fixture
def project_model_with_completion_hook(client):
    """The task-manager Project model with a hook naming nameless projects (removed afterwards)."""
    from app.modules.projects.models import Project

    received = {}

    def complete_new_row(cls, payload, user, session):
        received.update(payload=dict(payload), roles=list(user.get("roles") or []), session=session)
        if payload.get("status") == "refused":
            raise HTTPException(status_code=403, detail="refused by the model")
        payload.setdefault("name", f"Project of {user.get('username')}")
        return payload

    setattr(Project, NEW_ROW_COMPLETION_HOOK, classmethod(complete_new_row))
    yield received
    delattr(Project, NEW_ROW_COMPLETION_HOOK)


def test_the_hook_completes_a_new_row_before_validation(client, auth, project_model_with_completion_hook):
    response = client.post("/api/project", json={"status": "active"}, headers=auth)
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Project of admin"
    received = project_model_with_completion_hook
    assert received["payload"] == {"status": "active"} and "Admin" in received["roles"]
    assert received["session"] is not None


def test_the_hook_can_refuse_a_row(client, auth, project_model_with_completion_hook):
    response = client.post("/api/project", json={"name": "X", "status": "refused"}, headers=auth)
    assert response.status_code == 403


def test_models_without_the_hook_are_unchanged(client, auth):
    response = client.post("/api/project", json={"status": "active"}, headers=auth)
    assert response.status_code == 422

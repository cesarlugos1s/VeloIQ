"""``GET /api/model-relations``: which model each reference field of a record points to.

A record the API returns carries the id of its many-to-one relations (a store's region) as a field, but the field alone does not say which
model the id belongs to. This endpoint lists, for each model that has such fields, the field name, the model it refers to and that model's REST
resource (its table name, the path under ``/api``). An integration tool reads it through the application's REST API to link a child record to its
parent without being told. Only the Admin role may call it; it reads no records.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from veloiq_framework.utils.i18n_utils import _


def read_model_relation_metadata() -> list[dict]:
    """The reference fields of every model of the application: model, resource and, for each field, the model and resource it points to."""
    from sqlmodel import SQLModel

    from veloiq_framework.crud import reference_models_for

    found: dict[str, dict] = {}
    for mapper in SQLModel._sa_registry.mappers:
        model_class = mapper.class_
        table_name = getattr(model_class, "__tablename__", None)
        if not table_name:
            continue
        references = reference_models_for(model_class)
        if not references:
            continue
        found[table_name] = {
            "model": model_class.__name__,
            "resource": table_name,
            "references": sorted(
                (
                    {"field": field, "related_model": target.__name__, "related_resource": getattr(target, "__tablename__", None)}
                    for field, target in references.items()
                ),
                key=lambda reference: reference["field"],
            ),
        }
    return [found[name] for name in sorted(found)]


def make_model_relation_metadata_router(cfg) -> APIRouter:
    """Return the router of the endpoint (mounted under ``/api``)."""
    from veloiq_framework.access.decision import ADMIN_ROLE
    from veloiq_framework.auth.utils import get_current_user
    from veloiq_framework.db import get_engine

    router = APIRouter(tags=["model-relation-metadata"])

    @router.get("/model-relations")
    def list_model_relations(request: Request):
        """The reference fields of the models and the models they point to (Admin only)."""
        user = get_current_user(request, get_engine(), cfg.auth_secret)
        if ADMIN_ROLE not in (user.get("roles") or []):
            raise HTTPException(status_code=403, detail=_("You do not have permission to perform this action."))
        return read_model_relation_metadata()

    return router

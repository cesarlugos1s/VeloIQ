"""What an external portal's roles can read, decided from the model code.

``veloiq generate`` writes each portal's page schemas with only the models and
fields its roles can read, so the portal's pages match what the server returns
to them. It uses the two rules declared in code, which the server also applies:

- ``@model_access(<Role>=[…])`` on a model: a listed role reads the model only
  when its actions include a read action (``list``, ``show``…); unlisted roles
  keep their global permissions;
- ``veloiq_field(read_roles=[…])`` on a field: only those roles read it
  (``crud.py`` drops it from every response for other roles).

Role access policies edited at runtime (Access Control → Roles) are not known
when generating; the server still applies them, and a page they deny shows the
standard "no access" page.
"""
from __future__ import annotations


def tablename_readable_by_roles(tablename: str, roles: list[str]) -> bool:
    """Whether any of *roles* may read the model of table *tablename* per ``@model_access``."""
    from veloiq_framework.access.decision import ACTION_READ, ACTION_REFINE
    from veloiq_framework.auth.permissions import _MODEL_PERMISSIONS

    role_actions = _MODEL_PERMISSIONS.get(tablename)
    if not role_actions:
        return True
    read_refine_actions = ACTION_REFINE[ACTION_READ]
    return any(
        role not in role_actions or bool(read_refine_actions.intersection(role_actions[role]))
        for role in roles
    )


def model_readable_by_roles(model_class: type, roles: list[str]) -> bool:
    """Whether any of *roles* may read *model_class* per ``@model_access``."""
    tablename = getattr(model_class, "__tablename__", None) or model_class.__name__.lower()
    return tablename_readable_by_roles(tablename, roles)


def field_readable_by_roles(model_class: type, field_key: str, roles: list[str]) -> bool:
    """Whether any of *roles* may read *model_class*'s field *field_key* per ``veloiq_field(read_roles=…)``."""
    from veloiq_framework.crud import _get_field_permissions

    field_permissions = _get_field_permissions(model_class).get(field_key) or {}
    if "read_roles" not in field_permissions:
        return True
    return any(role in field_permissions["read_roles"] for role in roles)

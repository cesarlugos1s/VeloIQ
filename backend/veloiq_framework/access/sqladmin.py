"""Apply the shared access decision to SQLAdmin (``/admin``) views (AC-D5).

Each registered ``ModelView`` is patched so that:

* ``is_accessible(request)`` also asks :func:`can_access_model` for the
  action the admin page performs (``create``/``edit``/``delete`` pages map to
  Create/Update/Delete, everything else to Read);
* ``is_visible(request)`` hides the view when Read is denied;
* ``can_create`` / ``can_edit`` / ``can_delete`` follow the decision for the
  current request, so the admin UI hides buttons the user can't use.

The existing per-extension license patchers stay in place; this patch runs
on top of them and goes through the same function as every other check.
SQLAdmin only signs in Admin users today, so for them only licensing and the
role's methods can deny (Admin is exempt from policies and ``@model_access``).
"""
from __future__ import annotations

from contextvars import ContextVar

from veloiq_framework.access.decision import (
    ACTION_CREATE,
    ACTION_DELETE,
    ACTION_READ,
    ACTION_UPDATE,
    ACTIONS,
    can_access_model,
)

# Per-request decisions: {id(view): {action: allowed}}. Set by is_accessible,
# read by the can_* properties while the same request renders.
_view_decisions: ContextVar[dict | None] = ContextVar("veloiq_admin_access", default=None)

#: SQLAdmin page segment (after the view identity) → action.
_PAGE_ACTIONS = {"create": ACTION_CREATE, "edit": ACTION_UPDATE, "delete": ACTION_DELETE}

#: ModelView flags driven by the decision.
_FLAG_ACTIONS = (("can_create", ACTION_CREATE), ("can_edit", ACTION_UPDATE), ("can_delete", ACTION_DELETE))


def _admin_user(request, cfg) -> dict | None:
    """Return the user dict from the SQLAdmin session token, or ``None``."""
    token = getattr(request, "session", {}).get("admin_token") if hasattr(request, "session") else None
    if not token:
        return None
    try:
        from veloiq_framework.auth.utils import decode_access_token
        payload = decode_access_token(token, cfg.auth_secret)
    except Exception:
        return None
    payload["eid"] = int(payload.get("sub", 0) or 0)
    return payload


def _page_action(request) -> str:
    """Return the action of the SQLAdmin page being requested."""
    identity = (getattr(request, "path_params", None) or {}).get("identity")
    parts = [p for p in request.url.path.split("/") if p]
    if identity and identity in parts:
        idx = parts.index(identity)
        if idx + 1 < len(parts):
            return _PAGE_ACTIONS.get(parts[idx + 1], ACTION_READ)
    return ACTION_READ


def _decisions_for(view, request, cfg) -> dict | None:
    """Evaluate every action for *view*'s model and remember them for this request."""
    user = _admin_user(request, cfg)
    if user is None:
        return None
    decisions = {a: can_access_model(user, view.model, a).allowed for a in ACTIONS}
    current = dict(_view_decisions.get() or {})
    current[id(view)] = decisions
    _view_decisions.set(current)
    return decisions


def _flag_property(original, action: str) -> property:
    """Return a property that ANDs the view's own flag with this request's decision."""

    def _get(self):
        if not original:
            return False
        decisions = (_view_decisions.get() or {}).get(id(self))
        return True if decisions is None else bool(decisions.get(action, True))

    return property(_get)


def patch_view(view, cfg) -> None:
    """Patch one SQLAdmin ``ModelView`` instance's class with the access checks."""
    cls = type(view)
    if getattr(cls, "__veloiq_access_patched__", False) or getattr(view, "model", None) is None:
        return
    original_accessible = cls.is_accessible
    original_visible = cls.is_visible

    def is_accessible(self, request) -> bool:
        if not original_accessible(self, request):
            return False
        decisions = _decisions_for(self, request, cfg)
        return True if decisions is None else decisions[_page_action(request)]

    def is_visible(self, request) -> bool:
        if not original_visible(self, request):
            return False
        decisions = _decisions_for(self, request, cfg)
        return True if decisions is None else decisions[ACTION_READ]

    cls.is_accessible = is_accessible
    cls.is_visible = is_visible
    for attr, action in _FLAG_ACTIONS:
        setattr(cls, attr, _flag_property(getattr(cls, attr, True), action))
    cls.__veloiq_access_patched__ = True


def patch_admin_views(admin, cfg) -> None:
    """Patch every model view registered on *admin* (call after all modules load)."""
    from sqladmin import ModelView

    for view in list(getattr(admin, "views", [])):
        if isinstance(view, ModelView):
            patch_view(view, cfg)

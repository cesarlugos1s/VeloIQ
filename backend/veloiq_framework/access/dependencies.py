"""FastAPI dependencies that apply the shared access decision to module routes.

``loader.py`` adds :func:`make_module_access_dependency` to every module
router, next to the extension's license dependency. It checks the module as
a whole, with the action taken from the HTTP method (AC-D2). Two kinds of
route opt out of that default:

* generic CRUD and named-query routes, marked with :func:`mark_model_checked`:
  they check the module *and* the model inside the handler, where a model
  entry can override its module's entry (AC-B5);
* custom endpoints that declare their action with :func:`requires_action`,
  e.g. a search sent as POST that only reads::

      @router.post("/search", dependencies=[Depends(requires_action("read"))])
      def search(...): ...

"""
from __future__ import annotations

from typing import Callable

from fastapi import Request

from veloiq_framework.access.decision import ACTIONS, http_method_to_action, require_access

_MODEL_CHECKED_ATTR = "__veloiq_model_checked__"
_ACTION_ATTR = "__veloiq_action__"


def mark_model_checked(endpoint: Callable) -> Callable:
    """Mark *endpoint* as checking access per model itself (skip the module check)."""
    setattr(endpoint, _MODEL_CHECKED_ATTR, True)
    return endpoint


def requires_action(action: str) -> Callable[[], None]:
    """Declare the action a custom endpoint performs, overriding its HTTP method.

    Use it as a route dependency: ``dependencies=[Depends(requires_action("read"))]``.
    The module dependency finds the declaration on the matched route before
    it decides; the dependency itself does nothing at request time.
    """
    if action not in ACTIONS:
        raise ValueError(f"requires_action: unknown action {action!r}; expected one of {ACTIONS}")

    def _declared() -> None:
        return None

    setattr(_declared, _ACTION_ATTR, action)
    return _declared


def _declared_action(request: Request) -> str | None:
    """Return the action the matched route declares through requires_action."""
    endpoint = request.scope.get("endpoint")
    action = getattr(endpoint, _ACTION_ATTR, None)
    if action:
        return action
    route = request.scope.get("route")
    dependant = getattr(route, "dependant", None)
    for dep in getattr(dependant, "dependencies", None) or []:
        action = getattr(getattr(dep, "call", None), _ACTION_ATTR, None)
        if action:
            return action
    return None


def make_module_access_dependency(module_key: str | None) -> Callable:
    """Return a router dependency that checks *module_key* for each request.

    ``None`` (an excluded or unregistered module) gives a dependency that
    only applies licensing and role methods through the same function.
    """

    def _module_access(request: Request) -> None:
        endpoint = request.scope.get("endpoint")
        if getattr(endpoint, _MODEL_CHECKED_ATTR, False):
            return
        user = getattr(request.state, "user", None)
        if user is None:
            return  # auth_middleware decides about unauthenticated requests.
        action = _declared_action(request) or http_method_to_action(request.method)
        if action is None:
            return  # OPTIONS is never subject to policies.
        require_access(user, module_key, None, action)

    _module_access.__veloiq_module_key__ = module_key  # type: ignore[attr-defined]
    return _module_access

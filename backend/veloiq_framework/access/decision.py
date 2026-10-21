"""The shared access decision: may this user perform this action on this resource?

Every backend check (CRUD and named-query routes, custom module endpoints,
SQLAdmin views, indirect read paths) goes through :func:`can_access`, which
runs evaluation steps 2–5 in order and stops at the first deny:

2. licensing — the module is licensed and, for writes, outside its grace
   period (read through :func:`~veloiq_framework.licensing_utils.aggregate_license_pool`);
3. the role's global HTTP methods (``Role.allowed_methods``);
4. the role's access policy (allowlist or blocklist);
5. ``@model_access`` (developer rules in code).

Steps 3–5 are evaluated per role and a user gets the action when **any** of
their roles allows it (AC-C4), the same way ``check_rbac`` and
``_check_model_permissions`` combine roles. The Admin role skips steps 4 and
5 but is still subject to licensing and its methods (AC-A3, AC-C2).

Features (registered capabilities such as an extension's answering methods)
are decided by :func:`can_use_feature`: the role's feature policy, with the
same any-role-wins rule and the same Admin exemption. :func:`feature_is_enabled`
is what feature code calls: the feature's configuration switch is on *and*
:func:`can_use_feature` allows it for the user whose request is served
(:func:`set_feature_user`).

The algorithm itself lives in :func:`evaluate_access`, a pure function over
plain data. The frontend implements the same function in
``@juicemantics/veloiq-ui`` (``evaluateAccess``) and both are checked against
the shared cases in ``test-fixtures/access.json``.
"""
from __future__ import annotations

import contextvars
from dataclasses import dataclass
from typing import Any, Mapping

from veloiq_framework.auth.permissions import HTTP_TO_REFINE

# ── Actions ───────────────────────────────────────────────────────────────────

ACTION_CREATE = "create"
ACTION_READ = "read"
ACTION_UPDATE = "update"
ACTION_DELETE = "delete"
ACTIONS = (ACTION_CREATE, ACTION_READ, ACTION_UPDATE, ACTION_DELETE)

#: HTTP methods that carry each action (spec: HTTP method → action table).
ACTION_METHODS: dict[str, tuple[str, ...]] = {
    ACTION_READ: ("GET", "HEAD"),
    ACTION_CREATE: ("POST",),
    ACTION_UPDATE: ("PUT", "PATCH"),
    ACTION_DELETE: ("DELETE",),
}

#: Reverse of :data:`ACTION_METHODS`. OPTIONS (CORS preflight) has no action.
METHOD_ACTION: dict[str, str] = {
    method: action for action, methods in ACTION_METHODS.items() for method in methods
}

#: Refine actions (as used by ``@model_access``) that count as each action.
#: Derived from the framework's existing ``HTTP_TO_REFINE`` mapping.
ACTION_REFINE: dict[str, frozenset[str]] = {
    action: frozenset().union(*(HTTP_TO_REFINE.get(m, set()) for m in methods))
    for action, methods in ACTION_METHODS.items()
}

#: Entry column holding each action's flag.
ACTION_FLAG: dict[str, str] = {action: f"can_{action}" for action in ACTIONS}

#: The role exempt from policies and ``@model_access`` (AC-A3).
ADMIN_ROLE = "Admin"

# ── Reason codes (never shown to the user; AC-D6) ────────────────────────────

REASON_UNKNOWN_ACTION = "unknown_action"
REASON_NO_ROLE = "no_role"
REASON_NOT_LICENSED = "not_licensed"
REASON_LICENSE_READ_ONLY = "license_read_only"
REASON_ROLE_METHOD = "role_method"
REASON_POLICY = "policy"
REASON_MODEL_ACCESS = "model_access"
REASON_FEATURE_POLICY = "feature_policy"


@dataclass(frozen=True)
class AccessDecision:
    """Result of an access check: ``allowed`` plus a reason code when denied."""
    allowed: bool
    reason: str | None = None

    def __bool__(self) -> bool:
        return self.allowed


ALLOW = AccessDecision(True)


def http_method_to_action(method: str) -> str | None:
    """Map an HTTP method to its action; ``None`` for OPTIONS and unknown methods."""
    return METHOD_ACTION.get((method or "").upper())


# ── Pure evaluation (mirrored by the frontend's evaluateAccess) ─────────────

def _policy_allows(policy: Mapping[str, Any], module_key: str, model_key: str | None, action: str) -> bool:
    """Apply one role's policy to (module, model, action).

    A model entry overrides its module's entry for that model only (AC-B5).
    Allowlist: only flagged actions of listed resources pass (AC-B3).
    Blocklist: everything passes except flagged actions of listed resources (AC-B4).
    """
    entries = policy.get("entries") or []
    entry = None
    if model_key:
        entry = next(
            (e for e in entries if e.get("module_key") == module_key and e.get("model_key") == model_key),
            None,
        )
    if entry is None:
        entry = next(
            (e for e in entries if e.get("module_key") == module_key and not e.get("model_key")),
            None,
        )
    flag = ACTION_FLAG[action]
    if policy.get("mode") == "allow":
        return entry is not None and bool(entry.get(flag))
    return entry is None or not bool(entry.get(flag))


def _evaluate_role(ctx: Mapping[str, Any], role: str, module_key: str | None,
                   model_key: str | None, action: str) -> str | None:
    """Run steps 3–5 for one role; return ``None`` if allowed, else a reason code."""
    methods = set((ctx.get("role_methods") or {}).get(role) or [])
    if not methods.intersection(ACTION_METHODS[action]):
        return REASON_ROLE_METHOD
    if role == ctx.get("admin_role", ADMIN_ROLE):
        return None

    registered_modules = (ctx.get("registry") or {}).get("modules") or {}
    if module_key and module_key in registered_modules:
        policy = (ctx.get("policies") or {}).get(role)
        if policy and not _policy_allows(policy, module_key, model_key, action):
            return REASON_POLICY

    if model_key:
        role_rules = ((ctx.get("model_access") or {}).get(model_key) or {}).get(role)
        if role_rules is not None and not ACTION_REFINE[action].intersection(role_rules):
            return REASON_MODEL_ACCESS
    return None


def evaluate_access(ctx: Mapping[str, Any], module_key: str | None,
                    model_key: str | None, action: str) -> AccessDecision:
    """Decide (module, model, action) for the user described by *ctx*.

    *ctx* is plain data, the same shape the frontend receives from
    ``/auth/resource-permissions``::

        {
          "roles": ["Manager"],
          "admin_role": "Admin",
          "role_methods": {"Manager": ["GET", "POST", ...]},
          "policies": {"Manager": {"mode": "allow"|"block", "entries": [...]}},
          "model_access": {"<table>": {"<Role>": ["list", "show", ...]}},
          "license": <aggregate_license_pool() result> | None,
          "registry": {"modules": {"<source>:<module>": {...}}, "models": {"<table>": "<module key>"}},
        }

    When *module_key* is ``None`` and *model_key* is given, the module is
    looked up in the registry. ``license`` set to ``None`` skips licensing.
    """
    from veloiq_framework.licensing_utils import is_module_licensed, is_module_write_allowed
    from veloiq_framework.access.registry import split_module_key

    if action not in ACTIONS:
        return AccessDecision(False, REASON_UNKNOWN_ACTION)
    registry = ctx.get("registry") or {}
    if module_key is None and model_key:
        module_key = (registry.get("models") or {}).get(model_key)

    # Step 2 — licensing.
    pool = ctx.get("license")
    if module_key and pool is not None:
        module_name = split_module_key(module_key)[1]
        if not is_module_licensed(module_name, pool):
            return AccessDecision(False, REASON_NOT_LICENSED)
        if action != ACTION_READ and not is_module_write_allowed(module_name, pool):
            return AccessDecision(False, REASON_LICENSE_READ_ONLY)

    # Steps 3–5 — per role, any role allowing wins.
    roles = list(ctx.get("roles") or [])
    if not roles:
        return AccessDecision(False, REASON_NO_ROLE)
    first_reason: str | None = None
    for role in roles:
        reason = _evaluate_role(ctx, role, module_key, model_key, action)
        if reason is None:
            return ALLOW
        first_reason = first_reason or reason
    return AccessDecision(False, first_reason)


def _feature_policy_allows(policy: Mapping[str, Any], feature_key: str) -> bool:
    """Apply one role's feature policy to *feature_key*.

    Allowlist: only listed features pass. Blocklist: every feature passes
    except the listed ones.
    """
    listed = any(e.get("feature_key") == feature_key for e in policy.get("entries") or [])
    if policy.get("mode") == "allow":
        return listed
    return not listed


def evaluate_feature_access(ctx: Mapping[str, Any], feature_key: str) -> AccessDecision:
    """Decide whether the user described by *ctx* may use *feature_key*.

    *ctx* holds ``roles``, ``admin_role``, ``feature_policies`` (role →
    ``{"mode", "entries": [{"feature_key"}]}``) and ``features`` (the
    registered feature keys). A user gets the feature when any of their roles
    allows it: the Admin role always does, a role with no feature policy
    does, and so does any role when the feature isn't registered (a policy
    can only name registered features).
    """
    roles = list(ctx.get("roles") or [])
    if not roles:
        return AccessDecision(False, REASON_NO_ROLE)
    if feature_key not in (ctx.get("features") or {}):
        return ALLOW
    policies = ctx.get("feature_policies") or {}
    for role in roles:
        if role == ctx.get("admin_role", ADMIN_ROLE):
            return ALLOW
        policy = policies.get(role)
        if policy is None or _feature_policy_allows(policy, feature_key):
            return ALLOW
    return AccessDecision(False, REASON_FEATURE_POLICY)


# ── Live evaluation ──────────────────────────────────────────────────────────

def _feature_policies_for(roles: list[str]) -> dict:
    """Return ``{role: feature policy}`` for the *roles* that have one (cached)."""
    from veloiq_framework.access.store import get_role_feature_policy
    return {r: p for r in roles if (p := get_role_feature_policy(r)) is not None}

def build_context(user: Mapping[str, Any] | None, *, include_license: bool = True) -> dict:
    """Assemble the evaluation context for *user* from the live sources.

    Reads role methods through the RBAC cache, policies through the policy
    cache, ``@model_access`` from its registry and licensing through
    :func:`~veloiq_framework.licensing_utils.aggregate_license_pool`.
    """
    from veloiq_framework.access.registry import get_extensions, registry_lookup
    from veloiq_framework.access.store import get_role_policy
    from veloiq_framework.auth.permissions import _MODEL_PERMISSIONS
    from veloiq_framework.auth.utils import get_role_methods_cached

    roles = list((user or {}).get("roles") or [])
    pool = None
    if include_license:
        from veloiq_framework.licensing_utils import aggregate_license_pool
        pool = aggregate_license_pool(get_extensions())
    return {
        "roles": roles,
        "admin_role": ADMIN_ROLE,
        "role_methods": {r: sorted(get_role_methods_cached(r)) for r in roles},
        "policies": {r: p for r in roles if (p := get_role_policy(r)) is not None},
        "model_access": _MODEL_PERMISSIONS,
        "license": pool,
        "registry": registry_lookup(),
    }


def can_access(user: Mapping[str, Any] | None, module_key: str | None,
               model_key: str | None, action: str) -> AccessDecision:
    """The shared decision function (steps 2–5) for a signed-in *user*.

    *user* is the request user dict set by the auth middleware (``roles``
    is what matters). Pass *module_key* for a module-level check (custom
    endpoints), *model_key* for a model (its module is looked up), or both.
    """
    return evaluate_access(build_context(user), module_key, model_key, action)


def can_access_model(user: Mapping[str, Any] | None, model_class: type, action: str) -> AccessDecision:
    """:func:`can_access` for a SQLModel table class."""
    tablename = getattr(model_class, "__tablename__", None) or model_class.__name__.lower()
    return can_access(user, None, tablename, action)


def denied_exception():
    """Return the 403 raised for any denied request.

    The message is translatable and names neither the policy nor the role,
    so nothing about the access configuration leaks (AC-D6).
    """
    from fastapi import HTTPException

    from veloiq_framework.utils.i18n_utils import _
    return HTTPException(status_code=403, detail=_("You do not have permission to perform this action."))


def require_access(user: Mapping[str, Any] | None, module_key: str | None,
                   model_key: str | None, action: str) -> None:
    """Raise the 403 from :func:`denied_exception` unless :func:`can_access` allows."""
    if not can_access(user, module_key, model_key, action):
        raise denied_exception()


def can_use_feature(user: Mapping[str, Any] | None, feature_key: str) -> AccessDecision:
    """The shared decision function for features, for a signed-in *user*.

    *user* is the request user dict (``roles`` is what matters); a user with
    no role is denied. Only the roles' feature policies are read, so the call
    is cheap enough for answering code to make once per decision.
    """
    from veloiq_framework.access.registry import get_features

    roles = list((user or {}).get("roles") or [])
    ctx = {
        "roles": roles,
        "admin_role": ADMIN_ROLE,
        "feature_policies": _feature_policies_for(roles),
        "features": get_features(),
    }
    return evaluate_feature_access(ctx, feature_key)


# ── Feature switches: configuration + role access ───────────────────────────

# The signed-in user (the request user dict, with its ``roles``) whose request
# the feature code in this context serves; None when there is none (a
# scheduled job, a background task).
_feature_user: contextvars.ContextVar = contextvars.ContextVar("veloiq_feature_user", default=None)

#: Default of :func:`feature_is_enabled`'s *user*: the one set by :func:`set_feature_user`.
CURRENT_USER = object()


def set_feature_user(user: Mapping[str, Any] | None):
    """Set the user whose request the feature code in this context serves.

    Call it where the request is received (an endpoint), so code deep in the
    call chain can call :func:`feature_is_enabled` without passing the user
    along. Returns the ContextVar token, for ``reset_feature_user``.
    """
    return _feature_user.set(dict(user) if isinstance(user, Mapping) else None)


def reset_feature_user(token) -> None:
    """Restore the feature user that was set before :func:`set_feature_user` returned *token*."""
    _feature_user.reset(token)


def current_feature_user() -> dict | None:
    """Return the user set by :func:`set_feature_user` in this context, or ``None``."""
    return _feature_user.get()


def feature_is_enabled(feature_key: str, *, config_section: str | None = None,
                       config_key: str | None = None, fallback: bool = False,
                       jm_config=None, user: Any = CURRENT_USER) -> bool:
    """Return whether the feature *feature_key* may be used now.

    Both must hold:

    1. its configuration switch, ``[config_section] config_key`` of
       ``jm_config.ini`` (read with :func:`jm_obtain_config` unless
       *jm_config* is given; *fallback* when the key is missing), is on --
       skipped when the feature has no switch (no *config_key*);
    2. :func:`can_use_feature` allows it for *user*, by default the one set
       by :func:`set_feature_user`. With no user there is no role to
       restrict, so only the switch applies.

    This is the one place that decides whether a feature is used, so feature
    code calls it instead of reading its switch itself.
    """
    if config_key:
        if jm_config is None:
            from veloiq_framework.utils.data_mgmt_utils import jm_obtain_config
            jm_config = jm_obtain_config()
        if not jm_config.getboolean(config_section, config_key, fallback=fallback):
            return False
    if user is CURRENT_USER:
        user = current_feature_user()
    if user is None:
        return True
    if not can_use_feature(user, feature_key):
        from veloiq_framework.utils.data_mgmt_utils import jm_log
        jm_log(1, f"🚫 Feature '{feature_key}' is not allowed for user '{user.get('username', '')}' "
                  f"by the access control of their roles.", text_color='YELLOW')
        return False
    return True

"""Reading, validating and saving role access policies.

Policies are read through an in-process cache that follows the RBAC cache
pattern in ``veloiq_framework.auth.utils`` (same 30 s TTL); every save or
delete clears it, so the backend applies a change at once in this process and
within the TTL in any other worker (AC-E4).
"""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import HTTPException

from veloiq_framework.access.decision import ACTION_FLAG, ACTION_READ, ACTIONS, ADMIN_ROLE
from veloiq_framework.access.models import (
    POLICY_MODES,
    RoleAccessAudit,
    RoleAccessEntry,
    RoleAccessPolicy,
)
from veloiq_framework.utils.data_mgmt_utils import jm_log
from veloiq_framework.utils.i18n_utils import _

# role_name → (policy dict | None, expires_at)
_policy_cache: dict[str, tuple[dict | None, float]] = {}

#: Audit event codes.
EVENT_SAVE = "save"
EVENT_DELETE = "delete"
EVENT_ROLE_DELETED = "role_deleted"
EVENT_ROLE_GET_MIGRATION = "role_get_migration"


def invalidate_access_cache() -> None:
    """Clear the policy cache (call after a policy or a role changes)."""
    _policy_cache.clear()


def _cache_ttl() -> float:
    """Return the RBAC cache TTL, so both caches expire together."""
    from veloiq_framework.auth.utils import _RBAC_CACHE_TTL
    return _RBAC_CACHE_TTL


def _entry_to_dict(entry: RoleAccessEntry) -> dict:
    """Serialize one entry to the plain shape used by the decision function."""
    data = {"module_key": entry.module_key, "model_key": entry.model_key or None}
    for action in ACTIONS:
        data[ACTION_FLAG[action]] = bool(getattr(entry, ACTION_FLAG[action]))
    return data


def policy_to_dict(policy: RoleAccessPolicy | None, entries: list[RoleAccessEntry]) -> dict | None:
    """Serialize a policy and its entries (``None`` when there is no policy)."""
    if policy is None:
        return None
    ordered = sorted(entries, key=lambda e: (e.module_key, e.model_key or ""))
    return {"mode": policy.mode, "entries": [_entry_to_dict(e) for e in ordered]}


def _load_policy(session, role_id: int) -> tuple[RoleAccessPolicy | None, list[RoleAccessEntry]]:
    """Load a role's policy row and entries."""
    from sqlmodel import select

    policy = session.exec(select(RoleAccessPolicy).where(RoleAccessPolicy.role_id == role_id)).first()
    if policy is None:
        return None, []
    entries = list(session.exec(select(RoleAccessEntry).where(RoleAccessEntry.policy_id == policy.id)).all())
    return policy, entries


def get_role_policy(role_name: str, engine=None) -> dict | None:
    """Return *role_name*'s policy as plain data, or ``None`` (cached 30 s).

    A database without the policy tables yet (e.g. an Alembic-managed app
    that hasn't run its migration) is treated as having no policies, which
    keeps today's behaviour (AC-B2).
    """
    now = time.monotonic()
    cached = _policy_cache.get(role_name)
    if cached and now < cached[1]:
        return cached[0]

    from sqlmodel import Session, select

    from veloiq_framework.auth.models import Role

    if engine is None:
        from veloiq_framework.db import get_engine
        engine = get_engine()
    result: dict | None = None
    try:
        with Session(engine) as session:
            role = session.exec(select(Role).where(Role.name == role_name)).first()
            if role is not None:
                policy, entries = _load_policy(session, role.id)
                result = policy_to_dict(policy, entries)
    except Exception as exc:
        jm_log(1, f"Access policies could not be read for role '{role_name}': {exc}")
        result = None
    _policy_cache[role_name] = (result, now + _cache_ttl())
    return result


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _unprocessable(message: str) -> HTTPException:
    """Return a 422 with a translated message."""
    return HTTPException(status_code=422, detail=message)


def validate_policy_payload(payload: Any, role_name: str, existing: dict | None) -> tuple[str, list[dict]]:
    """Validate a policy sent by the Access Policies screen.

    Returns ``(mode, entries)`` ready to save, or raises 422 when:

    * the role is the Admin role (AC-A3);
    * the mode isn't ``allow`` or ``block``;
    * an entry names an unknown or excluded module, or a model that isn't in
      that module (AC-A4) — except entries already saved on this policy whose
      extension has been removed, which are kept inactive (AC-B8);
    * an entry grants Create, Update or Delete without Read (AC-B6);
    * the same resource is listed twice.
    """
    from veloiq_framework.access.registry import is_registered_module, model_belongs_to

    if role_name == ADMIN_ROLE:
        raise _unprocessable(_("The Admin role can't be given an access policy."))
    if not isinstance(payload, dict):
        raise _unprocessable(_("Invalid access policy."))
    mode = payload.get("mode")
    if mode not in POLICY_MODES:
        raise _unprocessable(_("The policy mode must be allowlist or blocklist."))
    raw_entries = payload.get("entries") or []
    if not isinstance(raw_entries, list):
        raise _unprocessable(_("Invalid access policy."))

    kept_inactive = {
        (e["module_key"], e.get("model_key") or None) for e in (existing or {}).get("entries", [])
    }
    seen: set[tuple[str, str | None]] = set()
    entries: list[dict] = []
    for raw in raw_entries:
        if not isinstance(raw, dict) or not isinstance(raw.get("module_key"), str):
            raise _unprocessable(_("Invalid access policy."))
        module_key = raw["module_key"]
        model_key = raw.get("model_key") or None
        if model_key is not None and not isinstance(model_key, str):
            raise _unprocessable(_("Invalid access policy."))
        resource = (module_key, model_key)
        if resource in seen:
            raise _unprocessable(_("Each module or model can appear only once in a policy."))
        seen.add(resource)

        if is_registered_module(module_key):
            if model_key is not None and not model_belongs_to(module_key, model_key):
                raise _unprocessable(_("Unknown module or model in the access policy."))
        elif resource not in kept_inactive:
            raise _unprocessable(_("Unknown module or model in the access policy."))

        flags = {ACTION_FLAG[a]: bool(raw.get(ACTION_FLAG[a])) for a in ACTIONS}
        if not flags[ACTION_FLAG[ACTION_READ]] and any(
            flags[ACTION_FLAG[a]] for a in ACTIONS if a != ACTION_READ
        ):
            # In a blocklist a flag denies, so the rule reads the other way
            # round: blocking Read while leaving Create/Update/Delete open
            # would let a user change records they can't read.
            if mode == "allow":
                raise _unprocessable(_("Create, Update or Delete can't be granted without Read."))
        if mode == "block" and flags[ACTION_FLAG[ACTION_READ]] and not all(flags.values()):
            raise _unprocessable(_("Blocking Read also requires blocking Create, Update and Delete."))
        entries.append({"module_key": module_key, "model_key": model_key, **flags})
    return mode, entries


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

def _write_audit(session, event: str, role_id: int | None, role_name: str,
                 actor: dict | None, before: dict | None, after: dict | None) -> None:
    """Add one audit row to *session* (committed by the caller)."""
    session.add(RoleAccessAudit(
        event=event,
        role_id=role_id,
        role_name=role_name,
        actor_id=(actor or {}).get("eid"),
        actor_username=(actor or {}).get("username") or "",
        before=json.dumps(before),
        after=json.dumps(after),
    ))


def save_policy(engine, role_id: int, payload: Any, actor: dict | None) -> dict:
    """Validate and save *role_id*'s policy, audit the change, clear the cache.

    Returns the saved policy as plain data.
    """
    from datetime import datetime, timezone

    from sqlmodel import Session

    from veloiq_framework.auth.models import Role

    with Session(engine) as session:
        role = session.get(Role, role_id)
        if role is None:
            raise HTTPException(status_code=404, detail=_("Role not found"))
        policy, old_entries = _load_policy(session, role.id)
        before = policy_to_dict(policy, old_entries)
        mode, entries = validate_policy_payload(payload, role.name, before)

        if policy is None:
            policy = RoleAccessPolicy(role_id=role.id, mode=mode)
            session.add(policy)
            session.flush()
        else:
            policy.mode = mode
            policy.updated_at = datetime.now(timezone.utc)
            session.add(policy)
            for old in old_entries:
                session.delete(old)
            session.flush()
        new_entries = [RoleAccessEntry(policy_id=policy.id, **e) for e in entries]
        session.add_all(new_entries)
        after = policy_to_dict(policy, new_entries)
        role_name = role.name
        _write_audit(session, EVENT_SAVE, role.id, role_name, actor, before, after)
        session.commit()
    invalidate_access_cache()
    jm_log(2, f"Access policy saved for role '{role_name}' ({mode}, {len(entries)} entries)")
    return after


def delete_policy(engine, role_id: int, actor: dict | None, *, event: str = EVENT_DELETE) -> bool:
    """Delete *role_id*'s policy (if any), audit it and clear the cache.

    Returns ``True`` when a policy was deleted. Also called when a role is
    deleted (AC-B8), since SQLite doesn't enforce the foreign-key cascade
    unless foreign keys are switched on.
    """
    from sqlmodel import Session

    from veloiq_framework.auth.models import Role

    with Session(engine) as session:
        policy, entries = _load_policy(session, role_id)
        if policy is None:
            return False
        role = session.get(Role, role_id)
        before = policy_to_dict(policy, entries)
        for entry in entries:
            session.delete(entry)
        session.delete(policy)
        _write_audit(session, event, role_id, role.name if role else "", actor, before, None)
        session.commit()
    invalidate_access_cache()
    return True


def list_audit(engine, role_id: int | None = None, limit: int = 200) -> list[dict]:
    """Return the newest audit rows first, optionally for one role."""
    from sqlmodel import Session, select

    with Session(engine) as session:
        stmt = select(RoleAccessAudit)
        if role_id is not None:
            stmt = stmt.where(RoleAccessAudit.role_id == role_id)
        stmt = stmt.order_by(RoleAccessAudit.created_at.desc(), RoleAccessAudit.id.desc()).limit(limit)
        rows = session.exec(stmt).all()
        return [
            {
                "id": r.id,
                "event": r.event,
                "role_id": r.role_id,
                "role_name": r.role_name,
                "actor_id": r.actor_id,
                "actor_username": r.actor_username,
                "before": json.loads(r.before or "null"),
                "after": json.loads(r.after or "null"),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


# ---------------------------------------------------------------------------
# One-time upgrade: GET for roles that never had it
# ---------------------------------------------------------------------------

def migrate_role_read_methods(engine) -> None:
    """Give GET and HEAD, once, to every role whose methods lack GET.

    Before access policies, ``rbac_middleware`` never checked GET, so a role
    without GET could still read everything. Now that GET is checked, this
    keeps those roles' behaviour (AC-B2). It runs once per database: the
    migration is recorded as a ``role_get_migration`` audit row, and later
    edits to a role's methods are respected.
    """
    from sqlmodel import Session, select

    from veloiq_framework.auth.models import Role
    from veloiq_framework.auth.utils import _invalidate_rbac_cache

    try:
        with Session(engine) as session:
            done = session.exec(
                select(RoleAccessAudit).where(RoleAccessAudit.event == EVENT_ROLE_GET_MIGRATION)
            ).first()
            if done is not None:
                return
            changed: list[str] = []
            for role in session.exec(select(Role)).all():
                try:
                    methods = set(json.loads(role.allowed_methods or "[]"))
                except Exception:
                    methods = set()
                if "GET" in methods:
                    continue
                before = sorted(methods)
                methods.update(("GET", "HEAD"))
                role.allowed_methods = json.dumps(sorted(methods))
                session.add(role)
                changed.append(role.name)
                _write_audit(
                    session, EVENT_ROLE_GET_MIGRATION, role.id, role.name, None,
                    {"allowed_methods": before}, {"allowed_methods": sorted(methods)},
                )
            if not changed:
                # Record the run even when nothing changed, so it never repeats.
                _write_audit(session, EVENT_ROLE_GET_MIGRATION, None, "", None, None, None)
            session.commit()
    except Exception as exc:
        jm_log(1, f"Role read-method upgrade skipped: {exc}")
        return
    _invalidate_rbac_cache()
    if changed:
        jm_log(1, f"Added GET/HEAD to roles that had no read method: {', '.join(changed)}")

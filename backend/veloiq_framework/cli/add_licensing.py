"""``veloiq add-licensing`` — scaffold a fully functional license module into a host app."""
from __future__ import annotations

from pathlib import Path

import click


@click.command("add-licensing")
@click.option("--project-root", default=None,
              help="Project root directory (auto-detected if omitted).")
def add_licensing(project_root: str | None) -> None:
    """Scaffold a fully functional license module into this host app.

    Creates ``app/modules/license/`` with complete license enforcement
    (models, service, registry, API endpoints, SQLAdmin views) and
    ``frontend/src/pages/license/`` with a React management page.
    Also creates ``licensing/generate_license.py`` for issuing JWT keys.

    The generated code is fully functional out of the box. Edit
    ``license_registry.py`` to declare your module groups, then run
    ``veloiq generate`` to regenerate schemas.
    """
    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        raise click.ClickException(
            "Cannot find project root. Run from inside a VeloIQ project directory, "
            "or pass --project-root."
        )

    modules_dir = root / "backend" / "app" / "modules"
    license_dir = modules_dir / "license"
    frontend_license_dir = root / "frontend" / "src" / "pages" / "license"
    licensing_dir = root / "licensing"

    if license_dir.exists():
        raise click.ClickException(
            f"License module already exists at {license_dir}. "
            "Delete it first if you want to re-scaffold."
        )

    click.echo(f"\n🔧 Scaffolding license module into {root}…\n")

    # ── Backend: app/modules/license/ ─────────────────────────────────────────
    _write(license_dir / "__init__.py", "")
    _write(license_dir / "models.py", _MODELS_PY)
    _write(license_dir / "license_service.py", _LICENSE_SERVICE_PY)
    _write(license_dir / "license_registry.py", _LICENSE_REGISTRY_PY)
    _write(license_dir / "custom_api.py", _CUSTOM_API_PY)
    _write(license_dir / "admin" / "__init__.py", "")
    _write(license_dir / "admin" / "admin_views.py", _ADMIN_VIEWS_PY)

    # ── Frontend: frontend/src/pages/license/ ─────────────────────────────────
    _write(frontend_license_dir / "LicenseManagement.tsx", _LICENSE_MANAGEMENT_TSX)
    _write(frontend_license_dir / "LicenseContext.tsx", _LICENSE_CONTEXT_TSX)

    # ── Licensing CLI: licensing/ ─────────────────────────────────────────────
    if not licensing_dir.exists():
        _write(licensing_dir / "generate_license.py", _GENERATE_LICENSE_PY)
        _write(licensing_dir / "requirements.txt",
               "python-jose[cryptography]>=3.3.0\ncryptography>=41.0.0\n")
        _write(licensing_dir / "README.md", _LICENSING_README)

    # ── Keys directory in backend ─────────────────────────────────────────────
    keys_dir = root / "backend" / "config"
    keys_dir.mkdir(parents=True, exist_ok=True)
    _write(keys_dir / "license_public_key.pem.example",
           "# Replace this file with your actual RSA public key (PEM format).\n"
           "# Generate with: cd licensing && python generate_license.py keygen\n")

    click.echo(f"""
✅ License module scaffolded.

Next steps:

  1. Generate a key pair:
       cd {licensing_dir}
       pip install -r requirements.txt
       python generate_license.py keygen --out-dir ./keys

  2. Copy the public key:
       cp {licensing_dir}/keys/public_key.pem {root}/backend/config/license_public_key.pem

  3. Declare your module groups in:
       {license_dir}/license_registry.py

  4. Run veloiq generate to include the license module in schemas.

  5. Register LicenseContext in your frontend App.tsx — see:
       {frontend_license_dir}/LicenseContext.tsx
""")


# ---------------------------------------------------------------------------
# Backend templates
# ---------------------------------------------------------------------------

_MODELS_PY = '''\
"""License module models — InstallationConfig and LicenseKey."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class InstallationConfig(SQLModel, table=True):
    """Singleton table storing the unique installation UUID."""

    __tablename__ = "veloiq_installation_config"

    id: Optional[int] = Field(default=None, primary_key=True)
    installation_id: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LicenseKey(SQLModel, table=True):
    """Stores verified license JWT tokens and their computed status."""

    __tablename__ = "veloiq_license_key"

    id: Optional[int] = Field(default=None, primary_key=True)
    jwt_token: str
    module_group: str = Field(index=True)

    # Standard time bounds
    start_date: date
    end_date: date

    # ── Quantity limits ────────────────────────────────────────────────────
    # Add your module-group-specific quantity limit fields here.
    # Example:
    #   max_items: Optional[int] = Field(default=None)
    #
    # For each limit you add, implement the corresponding enforcement logic
    # in license_registry.py (see _check_cap_exceeded).

    installation_id: str
    status: str = Field(default="Active")  # Active | Grace Period | Expired | Deactivated
    added_at: datetime = Field(default_factory=datetime.utcnow)
    kid: Optional[str] = Field(default=None)
'''

_LICENSE_SERVICE_PY = '''\
"""License service — JWT verification, pool loading, installation ID management."""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session

# In-memory state populated by load_license_pool().
_installation_id: str | None = None


# ---------------------------------------------------------------------------
# Installation ID
# ---------------------------------------------------------------------------

def init_installation_id(session: "Session") -> None:
    """Create a singleton installation UUID on first boot."""
    global _installation_id
    import uuid
    from sqlmodel import select
    from .models import InstallationConfig

    cfg = session.exec(select(InstallationConfig)).first()
    if cfg is None:
        cfg = InstallationConfig(installation_id=str(uuid.uuid4()))
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    _installation_id = cfg.installation_id


def get_installation_id() -> str:
    if _installation_id is None:
        raise RuntimeError("Installation ID not initialised — call init_installation_id() first.")
    return _installation_id


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------

def _load_public_key() -> str:
    """Load RSA public key from env var or config file."""
    key = os.environ.get("LICENSE_PUBLIC_KEY")
    if key:
        return key
    candidates = [
        Path("config") / "license_public_key.pem",
        Path("..") / "config" / "license_public_key.pem",
        Path("backend") / "config" / "license_public_key.pem",
    ]
    for p in candidates:
        if p.exists():
            return p.read_text()
    raise FileNotFoundError(
        "License public key not found. Set LICENSE_PUBLIC_KEY env var or place "
        "the key at config/license_public_key.pem."
    )


def verify_license_jwt(token: str) -> dict:
    """Decode and verify a license JWT. Returns the payload dict."""
    from jose import jwt as jose_jwt, JWTError

    pub_key = _load_public_key()
    try:
        payload = jose_jwt.decode(token, pub_key, algorithms=["RS256"],
                                  options={"verify_exp": False})
    except JWTError as exc:
        raise ValueError(f"Invalid license token: {exc}") from exc

    required = {"installation_id", "module_group", "start_date", "end_date"}
    missing = required - set(payload.keys())
    if missing:
        raise ValueError(f"License token is missing required claims: {missing}")

    return payload


# ---------------------------------------------------------------------------
# Adding a license key
# ---------------------------------------------------------------------------

def add_license_key(session: "Session", token: str) -> None:
    """Verify, bind, and persist a license JWT, then reload the pool."""
    from .models import LicenseKey
    from . import license_registry

    payload = verify_license_jwt(token)

    inst_id = get_installation_id()
    if payload["installation_id"] != inst_id:
        raise ValueError(
            f"License key is bound to installation {payload[\'installation_id\']!r}, "
            f"but this installation is {inst_id!r}."
        )

    group = payload["module_group"]
    if group not in license_registry.MODULE_GROUPS:
        raise ValueError(
            f"Unknown module group {group!r}. "
            f"Known groups: {list(license_registry.MODULE_GROUPS)}"
        )

    from datetime import date as _date
    key = LicenseKey(
        jwt_token=token,
        module_group=group,
        start_date=_date.fromisoformat(payload["start_date"]),
        end_date=_date.fromisoformat(payload["end_date"]),
        installation_id=inst_id,
        kid=payload.get("kid"),
        # ── Quantity limits ─────────────────────────────────────────────────
        # Extract any custom quantity limit claims from the JWT here.
        # Example:
        #   max_items=payload.get("max_items"),
    )
    session.add(key)
    session.commit()
    session.refresh(key)

    load_license_pool(session)


# ---------------------------------------------------------------------------
# Pool loading
# ---------------------------------------------------------------------------

def load_license_pool(session: "Session") -> None:
    """Recompute the in-memory license registry from the database."""
    from datetime import date as _date
    from sqlmodel import select
    from .models import LicenseKey
    from . import license_registry

    today = _date.today()
    grace_cutoff = today - timedelta(days=30)

    keys = session.exec(
        select(LicenseKey).where(LicenseKey.status != "Deactivated")
    ).all()

    governing: dict[str, LicenseKey] = {}
    statuses: dict[str, str] = {}

    for group in license_registry.MODULE_GROUPS:
        group_keys = [k for k in keys if k.module_group == group
                      and k.end_date >= grace_cutoff]
        if not group_keys:
            statuses[group] = "blocked"
            continue

        # Prefer keys still valid over grace-period keys; newest start_date wins.
        valid = [k for k in group_keys if k.end_date >= today]
        pool = valid if valid else group_keys
        governing_key = sorted(pool, key=lambda k: (k.start_date, k.added_at), reverse=True)[0]

        governing[group] = governing_key
        statuses[group] = "active" if governing_key.end_date >= today else "grace_period"

    license_registry._set_registry_state(governing, statuses)

    # Update persisted status column for admin visibility.
    for k in keys:
        group = k.module_group
        if k.status == "Deactivated":
            continue
        if group not in governing or governing[group].id != k.id:
            new_status = "Superseded" if k.end_date >= today else "Expired"
        else:
            new_status = "Active" if statuses[group] == "active" else "Grace Period"
        if k.status != new_status:
            k.status = new_status
            session.add(k)
    session.commit()
'''

_LICENSE_REGISTRY_PY = '''\
"""License registry — in-memory state and FastAPI enforcement helpers.

Edit MODULE_GROUPS to declare your app\'s licensable module groups.
Each key is the group name (must match the JWT \'module_group\' claim).
Each value is the list of module folder names gated by that group.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import LicenseKey

# ── Define your module groups here ────────────────────────────────────────────
# Format: { "Group Name": ["module_folder_a", "module_folder_b"], ... }
#
# Example:
#   MODULE_GROUPS: dict[str, list[str]] = {
#       "Basic": ["products", "orders"],
#       "Premium": ["analytics", "reports"],
#   }
MODULE_GROUPS: dict[str, list[str]] = {
    # TODO: declare your module groups
}

# Modules that are always accessible regardless of licensing.
# The "license" module itself must always be exempt.
LICENSE_EXEMPT_MODULES: frozenset[str] = frozenset({"license"})

# ── In-memory registry state (populated by load_license_pool) ─────────────────
_governing_keys: dict[str, "LicenseKey"] = {}
_group_statuses: dict[str, str] = {}  # group → "active" | "grace_period" | "blocked"


def _set_registry_state(
    governing: dict[str, "LicenseKey"],
    statuses: dict[str, str],
) -> None:
    global _governing_keys, _group_statuses
    _governing_keys = governing
    _group_statuses = statuses


# ── Module-level accessors ────────────────────────────────────────────────────

def _group_for_module(module_name: str) -> str | None:
    for group, modules in MODULE_GROUPS.items():
        if module_name in modules:
            return group
    return None


def is_module_accessible(module_name: str) -> bool:
    """True if the module can be read (active or grace-period)."""
    if module_name in LICENSE_EXEMPT_MODULES:
        return True
    group = _group_for_module(module_name)
    if group is None:
        return True  # Not in any licensed group → always accessible
    return _group_statuses.get(group, "blocked") in ("active", "grace_period")


def is_module_write_allowed(module_name: str) -> bool:
    """True if the module allows create/update/delete (active only)."""
    if module_name in LICENSE_EXEMPT_MODULES:
        return True
    group = _group_for_module(module_name)
    if group is None:
        return True
    return _group_statuses.get(group, "blocked") == "active"


def get_licensed_modules() -> list[str]:
    return [
        m for group, modules in MODULE_GROUPS.items()
        if _group_statuses.get(group) in ("active", "grace_period")
        for m in modules
    ]


def get_write_allowed_modules() -> list[str]:
    return [
        m for group, modules in MODULE_GROUPS.items()
        if _group_statuses.get(group) == "active"
        for m in modules
    ]


# ── FastAPI dependency factory ────────────────────────────────────────────────

def make_license_dependency(module_name: str):
    """Return an async FastAPI dependency that enforces license for module_name."""
    from fastapi import HTTPException, Request

    async def _check(request: Request) -> None:
        if not is_module_accessible(module_name):
            raise HTTPException(status_code=403, detail=f"Module \'{module_name}\' is not licensed.")
        if request.method.upper() not in ("GET", "HEAD", "OPTIONS"):
            if not is_module_write_allowed(module_name):
                raise HTTPException(
                    status_code=403,
                    detail=f"Module \'{module_name}\' is in grace period — read-only access only.",
                )

    return _check


# ── SQLAdmin view patching ────────────────────────────────────────────────────

def patch_admin_view_with_license(view_class, module_name: str) -> None:
    """Inject license checks into a SQLAdmin ModelView class."""

    original_is_accessible = getattr(view_class, "is_accessible", None)
    original_is_visible = getattr(view_class, "is_visible", None)

    def is_accessible(self) -> bool:
        if original_is_accessible and not original_is_accessible(self):
            return False
        return is_module_accessible(module_name)

    def is_visible(self) -> bool:
        if original_is_visible and not original_is_visible(self):
            return False
        return is_module_accessible(module_name)

    view_class.is_accessible = is_accessible
    view_class.is_visible = is_visible
    view_class.can_create = property(lambda self: is_module_write_allowed(module_name))

    original_check_edit = getattr(view_class, "check_can_edit", None)
    original_check_delete = getattr(view_class, "check_can_delete", None)

    def check_can_edit(self, item) -> bool:
        return is_module_write_allowed(module_name) and (
            original_check_edit(self, item) if original_check_edit else True
        )

    def check_can_delete(self, item) -> bool:
        return is_module_write_allowed(module_name) and (
            original_check_delete(self, item) if original_check_delete else True
        )

    view_class.check_can_edit = check_can_edit
    view_class.check_can_delete = check_can_delete
'''

_CUSTOM_API_PY = '''\
"""License module REST API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from veloiq_framework.db import get_session
from veloiq_framework.auth.permissions import require_role

from .models import InstallationConfig, LicenseKey
from . import license_service, license_registry

router = APIRouter(prefix="/api/license", tags=["LICENSE"])


@router.get("/pool")
def get_license_pool(request: Request):
    """Return the current license pool — consumed by the frontend LicenseContext."""
    user = getattr(request.state, "user", None)
    is_admin = bool(user and "admin" in (user.get("roles") or []))

    warnings = []
    if is_admin:
        from datetime import date, timedelta
        today = date.today()
        for group, key in license_registry._governing_keys.items():
            days_left = (key.end_date - today).days
            status = license_registry._group_statuses.get(group, "blocked")
            if status == "grace_period":
                warnings.append({
                    "type": "grace_period",
                    "group": group,
                    "days_remaining": max(0, 30 - (today - key.end_date).days),
                })
            elif status == "active" and days_left <= 30:
                warnings.append({
                    "type": "expiry_approaching",
                    "group": group,
                    "days_remaining": days_left,
                })

    return {
        "installation_id": license_service.get_installation_id(),
        "licensed_modules": license_registry.get_licensed_modules(),
        "write_allowed_modules": license_registry.get_write_allowed_modules(),
        "group_statuses": dict(license_registry._group_statuses),
        "module_groups": {
            g: mods for g, mods in license_registry.MODULE_GROUPS.items()
        },
        "warnings": warnings,
    }


@router.get("/installation-id")
def get_installation_id():
    """Return this installation\'s UUID (shown in the License Management page)."""
    return {"installation_id": license_service.get_installation_id()}


@router.get("/keys")
def list_license_keys(
    _admin=Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    """List all license keys (admin only)."""
    keys = session.exec(select(LicenseKey)).all()
    return [
        {
            "id": k.id,
            "module_group": k.module_group,
            "start_date": str(k.start_date),
            "end_date": str(k.end_date),
            "status": k.status,
            "kid": k.kid,
            "added_at": k.added_at.isoformat(),
        }
        for k in keys
    ]


@router.post("/keys", status_code=201)
def add_license_key(
    request_body: dict,
    _admin=Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    """Submit a new license JWT (admin only)."""
    token = (request_body or {}).get("token", "")
    if not token:
        raise HTTPException(status_code=400, detail="\'token\' field is required.")
    try:
        license_service.add_license_key(session, token)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"status": "ok", "message": "License key added and pool reloaded."}


@router.patch("/keys/{key_id}/deactivate")
def deactivate_license_key(
    key_id: int,
    _admin=Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    """Deactivate a license key (admin only)."""
    key = session.get(LicenseKey, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="License key not found.")
    key.status = "Deactivated"
    session.add(key)
    session.commit()
    license_service.load_license_pool(session)
    return {"status": "ok"}
'''

_ADMIN_VIEWS_PY = '''\
"""SQLAdmin views for the license module (raw data access)."""
from sqladmin import ModelView

from ..models import InstallationConfig, LicenseKey


class InstallationConfigAdmin(ModelView, model=InstallationConfig):
    name = "Installation Config"
    name_plural = "Installation Config"
    column_list = [InstallationConfig.id, InstallationConfig.installation_id,
                   InstallationConfig.created_at]
    can_create = False
    can_delete = False


class LicenseKeyAdmin(ModelView, model=LicenseKey):
    name = "License Key"
    name_plural = "License Keys"
    column_list = [LicenseKey.id, LicenseKey.module_group, LicenseKey.start_date,
                   LicenseKey.end_date, LicenseKey.status, LicenseKey.kid,
                   LicenseKey.added_at]
    can_create = False


license_admin_views = [InstallationConfigAdmin, LicenseKeyAdmin]
'''


# ---------------------------------------------------------------------------
# Frontend templates
# ---------------------------------------------------------------------------

_LICENSE_CONTEXT_TSX = '''\
/**
 * LicenseContext — fetches the license pool from the backend and exposes
 * isModuleLicensed() / isModuleWriteAllowed() to the rest of the frontend.
 *
 * Wrap your app root with <LicenseProvider> and use useLicense() in components.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useApiUrl } from '@refinedev/core';

interface LicensePool {
  installation_id: string;
  licensed_modules: string[];
  write_allowed_modules: string[];
  group_statuses: Record<string, string>;
  module_groups: Record<string, string[]>;
  warnings: Array<{ type: string; group: string; days_remaining: number }>;
}

interface LicenseContextValue {
  pool: LicensePool | null;
  isModuleLicensed: (moduleName: string) => boolean;
  isModuleWriteAllowed: (moduleName: string) => boolean;
  reload: () => void;
}

const ALWAYS_LICENSED = new Set(['license']);

const LicenseContext = createContext<LicenseContextValue>({
  pool: null,
  isModuleLicensed: () => true,
  isModuleWriteAllowed: () => true,
  reload: () => {},
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = useApiUrl();
  const [pool, setPool] = useState<LicensePool | null>(null);

  const fetchPool = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/license/pool`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      });
      if (res.ok) setPool(await res.json());
    } catch {
      // silently ignore — app still works, just shows all modules
    }
  };

  useEffect(() => { fetchPool(); }, []);

  const isModuleLicensed = (m: string) =>
    ALWAYS_LICENSED.has(m) || !pool || pool.licensed_modules.includes(m);

  const isModuleWriteAllowed = (m: string) =>
    ALWAYS_LICENSED.has(m) || !pool || pool.write_allowed_modules.includes(m);

  return (
    <LicenseContext.Provider value={{ pool, isModuleLicensed, isModuleWriteAllowed, reload: fetchPool }}>
      {children}
    </LicenseContext.Provider>
  );
}

export const useLicense = () => useContext(LicenseContext);
'''

_LICENSE_MANAGEMENT_TSX = '''\
/**
 * LicenseManagement — admin page for registering and managing license keys.
 *
 * Add this page to your App.tsx routes and navigation.config.json.
 * Only users with the "admin" role should have access.
 */
import React, { useEffect, useState } from 'react';
import { useApiUrl } from '@refinedev/core';

interface LicenseKey {
  id: number;
  module_group: string;
  start_date: string;
  end_date: string;
  status: string;
  kid: string | null;
  added_at: string;
}

interface LicensePool {
  installation_id: string;
  group_statuses: Record<string, string>;
  warnings: Array<{ type: string; group: string; days_remaining: number }>;
}

export default function LicenseManagement() {
  const apiUrl = useApiUrl();
  const [pool, setPool] = useState<LicensePool | null>(null);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  };

  const fetchData = async () => {
    const [poolRes, keysRes] = await Promise.all([
      fetch(`${apiUrl}/api/license/pool`, { headers }),
      fetch(`${apiUrl}/api/license/keys`, { headers }),
    ]);
    if (poolRes.ok) setPool(await poolRes.json());
    if (keysRes.ok) setKeys(await keysRes.json());
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    setMessage(''); setError('');
    const res = await fetch(`${apiUrl}/api/license/keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(data.message ?? 'License key added.');
      setToken('');
      fetchData();
    } else {
      setError(data.detail ?? 'Failed to add license key.');
    }
  };

  const handleDeactivate = async (id: number) => {
    await fetch(`${apiUrl}/api/license/keys/${id}/deactivate`, { method: 'PATCH', headers });
    fetchData();
  };

  const statusColor = (s: string) =>
    s === 'Active' ? '#52c41a' : s === 'Grace Period' ? '#faad14' : '#ff4d4f';

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>License Management</h2>

      {pool && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <strong>Installation ID:</strong>{' '}
          <code>{pool.installation_id}</code>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#888', fontSize: 12 }}>
            Share this ID when requesting a license key.
          </p>
        </div>
      )}

      {pool?.warnings?.map((w, i) => (
        <div key={i} style={{ padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f',
                              borderRadius: 6, marginBottom: 8 }}>
          ⚠️ {w.group}: {w.type === 'grace_period'
            ? `Grace period — read-only. Expires in ${w.days_remaining} day(s).`
            : `License expires in ${w.days_remaining} day(s).`}
        </div>
      ))}

      <h3>Add License Key</h3>
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        rows={4}
        placeholder="Paste your license JWT here…"
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8 }}
      />
      <button onClick={handleAdd} style={{ marginTop: 8 }}>Add Key</button>
      {message && <p style={{ color: '#52c41a' }}>{message}</p>}
      {error && <p style={{ color: '#ff4d4f' }}>{error}</p>}

      <h3>Active Keys</h3>
      {keys.length === 0 ? (
        <p style={{ color: '#888' }}>No license keys registered.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Module Group</th>
              <th style={{ padding: '6px 8px' }}>Start</th>
              <th style={{ padding: '6px 8px' }}>End</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
              <th style={{ padding: '6px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px' }}>{k.module_group}</td>
                <td style={{ padding: '6px 8px' }}>{k.start_date}</td>
                <td style={{ padding: '6px 8px' }}>{k.end_date}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ color: statusColor(k.status), fontWeight: 600 }}>{k.status}</span>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {k.status !== 'Deactivated' && (
                    <button onClick={() => handleDeactivate(k.id)}
                            style={{ color: '#ff4d4f', background: 'none', border: 'none',
                                     cursor: 'pointer', padding: 0 }}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
'''


# ---------------------------------------------------------------------------
# Licensing CLI template
# ---------------------------------------------------------------------------

_GENERATE_LICENSE_PY = '''\
#!/usr/bin/env python3
"""License key generator for this app.

Usage
-----
# One-time setup — generate RSA key pair:
python generate_license.py keygen --out-dir ./keys

# Issue a license key for a customer:
python generate_license.py generate \\
    --private-key ./keys/private_key.pem \\
    --installation-id <UUID from the running app> \\
    --module-group "My Module Group" \\
    --start-date 2026-01-01 \\
    --end-date 2026-12-31
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


def cmd_keygen(args: argparse.Namespace) -> None:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    priv_path = out_dir / "private_key.pem"
    priv_path.write_bytes(private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))
    priv_path.chmod(0o600)

    pub_path = out_dir / "public_key.pem"
    pub_path.write_bytes(private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ))

    print(f"✅ Private key → {priv_path}")
    print(f"✅ Public key  → {pub_path}")
    print()
    print("Deploy public_key.pem to your backend:")
    print(f"  cp {pub_path} ../backend/config/license_public_key.pem")
    print()
    print("⚠️  Keep private_key.pem secret — never commit it or share it.")


def cmd_generate(args: argparse.Namespace) -> None:
    from jose import jwt as jose_jwt

    priv_pem = Path(args.private_key).read_text()

    payload = {
        "jti": str(uuid.uuid4()),
        "iat": int(datetime.now(tz=timezone.utc).timestamp()),
        "installation_id": args.installation_id,
        "module_group": args.module_group,
        "start_date": args.start_date,
        "end_date": args.end_date,
    }
    # ── Add custom quantity limit claims here ─────────────────────────────────
    # Example:
    #   if args.max_items is not None:
    #       payload["max_items"] = args.max_items

    headers = {"alg": "RS256"}
    if args.kid:
        headers["kid"] = args.kid

    token = jose_jwt.encode(payload, priv_pem, algorithm="RS256", headers=headers)
    print(token)

    audit_path = Path("license_audit.jsonl")
    entry = {**payload, "issued_at": datetime.now(tz=timezone.utc).isoformat()}
    with audit_path.open("a") as f:
        f.write(json.dumps(entry) + "\\n")
    print(f"\\n📋 Logged to {audit_path}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="License key generator")
    sub = parser.add_subparsers(dest="command", required=True)

    p_keygen = sub.add_parser("keygen", help="Generate RSA key pair")
    p_keygen.add_argument("--out-dir", default="./keys")

    p_gen = sub.add_parser("generate", help="Issue a license JWT")
    p_gen.add_argument("--private-key", required=True)
    p_gen.add_argument("--installation-id", required=True)
    p_gen.add_argument("--module-group", required=True)
    p_gen.add_argument("--start-date", required=True, help="YYYY-MM-DD")
    p_gen.add_argument("--end-date", required=True, help="YYYY-MM-DD")
    p_gen.add_argument("--kid", default="v1")
    # Add custom quantity limit arguments here:
    # p_gen.add_argument("--max-items", type=int, default=None)

    args = parser.parse_args()
    if args.command == "keygen":
        cmd_keygen(args)
    elif args.command == "generate":
        cmd_generate(args)


if __name__ == "__main__":
    main()
'''

_LICENSING_README = '''\
# Licensing

## Setup

```bash
pip install -r requirements.txt
python generate_license.py keygen --out-dir ./keys
cp keys/public_key.pem ../backend/config/license_public_key.pem
```

**Never commit `keys/private_key.pem`.**

## Issue a key

1. Get the Installation ID from the running app\'s License Management page.

2. Run:
```bash
python generate_license.py generate \\
    --private-key ./keys/private_key.pem \\
    --installation-id <UUID> \\
    --module-group "My Module Group" \\
    --start-date 2026-01-01 \\
    --end-date 2026-12-31
```

3. Give the printed JWT token to the customer.
'''


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_project_root() -> Path | None:
    """Walk up looking for backend/app/modules."""
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if (parent / "backend" / "app" / "modules").exists():
            return parent
        if (parent / "app" / "modules").exists():
            return parent
    return None


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    click.echo(f"  created  {path}")

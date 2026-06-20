"""veloiq migrate — upgrade a VeloIQ host app to the current framework version.

Each step is idempotent: safe to run multiple times and on already-current
projects.  New migration steps are added here as the framework evolves so
developers always run a single command to stay current.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Optional

import click

# ---------------------------------------------------------------------------
# Step 1 – legacy views_configuration.json → views_preferences.json
# ---------------------------------------------------------------------------

_DASHBOARD_KEY = "__dashboard__"
_USER_KEY = "user:all"
_PREFS_FILE = Path("views_preferences.json")
_LEGACY_FILE = Path("config") / "views_configuration.json"


def _migrate_views(root: Path, dry_run: bool) -> bool:
    """Consolidate legacy dashboard config into views_preferences.json.

    Returns True if a migration was performed (or would be in dry-run).
    """
    backend = root / "backend"
    legacy_path = backend / _LEGACY_FILE
    prefs_path = backend / _PREFS_FILE

    if not legacy_path.exists():
        return False

    try:
        legacy_data = json.loads(legacy_path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        click.echo(f"  ❌  Could not read {legacy_path}: {exc}", err=True)
        return False

    dashboard = legacy_data.get(_USER_KEY, {}).get(_DASHBOARD_KEY)
    if not dashboard:
        return False

    prefs_data: dict = {}
    if prefs_path.exists():
        try:
            prefs_data = json.loads(prefs_path.read_text(encoding="utf-8")) or {}
        except Exception as exc:
            click.echo(f"  ❌  Could not read {prefs_path}: {exc}", err=True)
            return False

    if _USER_KEY in prefs_data and _DASHBOARD_KEY in prefs_data[_USER_KEY]:
        click.echo("  ✅  views_preferences.json: dashboard already migrated — skipping")
        return False

    tab_count = len(dashboard.get("tabs", []))
    cell_count = sum(len(t.get("cells", [])) for t in dashboard.get("tabs", []))

    if dry_run:
        click.echo(
            f"  • views_preferences.json: import dashboard config from\n"
            f"    config/views_configuration.json ({tab_count} tab(s), {cell_count} cell(s))"
        )
        return True

    prefs_data.setdefault(_USER_KEY, {})[_DASHBOARD_KEY] = dashboard
    _write_json(prefs_path, prefs_data)
    bak_path = legacy_path.with_suffix(".json.bak")
    legacy_path.rename(bak_path)
    click.echo(
        f"  ✅  views_preferences.json: imported dashboard config "
        f"({tab_count} tab(s), {cell_count} cell(s))\n"
        f"      legacy file backed up → config/views_configuration.json.bak"
    )
    return True


# ---------------------------------------------------------------------------
# Step 2 – vite.config.ts proxy upgrade
#           Removes legacy rewrite functions that stripped the /api prefix.
#           The framework now serves all routes under /api/ natively so the
#           proxy must forward the path unchanged.
# ---------------------------------------------------------------------------

# Proxy keys that the canonical scaffold declares.
_CANONICAL_PROXY_KEYS = ["/api", "/auth", "/admin", "/i18n"]


def _needs_vite_migration(content: str) -> bool:
    """Return True if vite.config.ts has any old-style proxy patterns."""
    return (
        bool(re.search(r'\brewrite\s*:', content))
        or '"/api/"' in content
        or '"/api-tools/"' in content
    )


def _apply_vite_migration(content: str) -> tuple[str, list[str]]:
    """Remove legacy proxy patterns. Returns (new_content, list_of_changes)."""
    changes: list[str] = []
    lines = content.splitlines(keepends=True)

    # Remove the obsolete /api-tools/ proxy entry (entire line).
    filtered = [l for l in lines if '"/api-tools/"' not in l]
    if len(filtered) != len(lines):
        changes.append('removed obsolete "/api-tools/" proxy entry')
        lines = filtered

    content = "".join(lines)

    # Remove rewrite: property — two forms:
    #   (a) standalone line:  "  rewrite: (path) => ...,\n"
    #   (b) inline property:  "..., rewrite: (path) => ... }" (before closing brace)
    rewrite_found = bool(re.search(r'\brewrite\s*:', content))
    if rewrite_found:
        # (a) standalone — line that contains only the rewrite property
        content = re.sub(r'^[ \t]*rewrite[ \t]*:[^\n]+\n?', '', content, flags=re.MULTILINE)
        # (b) inline — ", rewrite: <expr>" immediately before the closing "}"
        content = re.sub(r',[ \t]*rewrite[ \t]*:[^}]*(?=[ \t]*\})', '', content)
        changes.append('removed proxy rewrite functions (API prefix stripping is no longer needed)')

    # Fix trailing slashes in proxy keys: "/api/" → "/api".
    for key in _CANONICAL_PROXY_KEYS:
        old = f'"{key}/"'
        if old in content:
            content = content.replace(old, f'"{key}"')
            changes.append(f'fixed proxy key: "{key}/" → "{key}"')

    return content, changes


def _migrate_vite_config(root: Path, dry_run: bool) -> bool:
    """Upgrade frontend/vite.config.ts to the current proxy format.

    Returns True if a migration was performed (or would be in dry-run).
    """
    vite_cfg = root / "frontend" / "vite.config.ts"
    if not vite_cfg.exists():
        return False

    content = vite_cfg.read_text(encoding="utf-8")
    if not _needs_vite_migration(content):
        return False

    _, changes = _apply_vite_migration(content)
    if not changes:
        return False

    if dry_run:
        for c in changes:
            click.echo(f"  • frontend/vite.config.ts: {c}")
        return True

    new_content, _ = _apply_vite_migration(content)
    bak = vite_cfg.with_suffix(".ts.bak")
    shutil.copy(vite_cfg, bak)
    vite_cfg.write_text(new_content, encoding="utf-8")
    for c in changes:
        click.echo(f"  ✅  frontend/vite.config.ts: {c}")
    click.echo(f"      original backed up → frontend/vite.config.ts.bak")
    return True


# ---------------------------------------------------------------------------
# Step 3 – frontend/package.json: ensure @juicemantics/veloiq-ui is recent
#           enough to understand newer optional ModelDef props (e.g. the
#           `titleFields` emitted by `veloiq set-title`). Existing apps pinned
#           to an older minor would otherwise fail `tsc`/`vite build` with a
#           TS2353 "unknown property" error once they adopt the feature.
# ---------------------------------------------------------------------------

_UI_PACKAGE = "@juicemantics/veloiq-ui"
# Fallback when the framework distribution version cannot be resolved. Keep in
# sync with packages/ui/package.json (framework + UI ship in lockstep).
_FALLBACK_UI_VERSION = "0.8.5"


def _current_ui_version() -> str:
    """The UI package version the current framework expects (lockstep release)."""
    try:
        import importlib.metadata as _md
        return _md.version("veloiq-framework")
    except Exception:
        return _FALLBACK_UI_VERSION


def _parse_ver(s: str) -> Optional[tuple[int, int, int]]:
    m = re.match(r"\s*v?(\d+)\.(\d+)\.(\d+)", s)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def _range_admits(spec: str, target: str) -> bool:
    """Best-effort: does the npm version range ``spec`` allow ``target``?

    Conservative — when the spec can't be parsed we return True so migrate
    never rewrites unfamiliar/dev specs (``file:``, ``workspace:``, git URLs…).
    """
    target_v = _parse_ver(target)
    if target_v is None:
        return True
    spec = spec.strip()
    if spec[:1] in "^~":
        op, base = spec[0], spec[1:]
    elif spec.startswith(">="):
        op, base = ">=", spec[2:]
    elif spec.startswith("="):
        op, base = "=", spec[1:]
    else:
        op, base = "=", spec
    base_v = _parse_ver(base)
    if base_v is None:
        return True  # not a plain version (file:/link:/workspace:/git/*) → leave it
    if target_v < base_v:
        return True  # app is already ahead of the framework — don't downgrade
    if op == ">=":
        return True
    if op == "^":
        if base_v[0] > 0:
            return target_v[0] == base_v[0]
        if base_v[1] > 0:
            return target_v[:2] == base_v[:2]
        return target_v == base_v
    if op == "~":
        return target_v[:2] == base_v[:2]
    return base_v == target_v  # exact pin


def _migrate_ui_package_version(root: Path, dry_run: bool) -> bool:
    """Bump frontend/package.json's veloiq-ui floor when it predates the
    current framework, so newer optional ModelDef props type-check.

    Returns True if a migration was performed (or would be in dry-run).
    """
    pkg_path = root / "frontend" / "package.json"
    if not pkg_path.exists():
        return False
    try:
        data = json.loads(pkg_path.read_text(encoding="utf-8"))
    except Exception as exc:
        click.echo(f"  ❌  Could not read {pkg_path}: {exc}", err=True)
        return False

    deps = data.get("dependencies")
    if not isinstance(deps, dict) or _UI_PACKAGE not in deps:
        return False

    current_spec = str(deps[_UI_PACKAGE])
    target = _current_ui_version()
    if _range_admits(current_spec, target):
        return False  # already compatible (or a dev/file: link we must not touch)

    new_spec = f"^{target}"

    if dry_run:
        click.echo(
            f"  • frontend/package.json: bump {_UI_PACKAGE} "
            f"{current_spec!r} → {new_spec!r}"
        )
        return True

    deps[_UI_PACKAGE] = new_spec
    bak = pkg_path.with_suffix(".json.bak")
    shutil.copy(pkg_path, bak)
    pkg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    click.echo(
        f"  ✅  frontend/package.json: {_UI_PACKAGE} {current_spec} → {new_spec}\n"
        f"      original backed up → frontend/package.json.bak\n"
        f"      run `npm install` in frontend/ to pick up the new version"
    )
    return True


# ---------------------------------------------------------------------------
# Step 4 – Remove VELOIQ_AUTH_DISABLED from .env and auth_enabled=False from main.py
#           Authentication can no longer be disabled. This step comments out any
#           VELOIQ_AUTH_DISABLED setting and removes auth_enabled=False kwargs.
# ---------------------------------------------------------------------------

_AUTH_DISABLED_RE = re.compile(
    r'^(VELOIQ_AUTH_DISABLED\s*=\s*(?:1|true|yes).*)$',
    re.IGNORECASE | re.MULTILINE,
)
_AUTH_ENABLED_FALSE_RE = re.compile(
    r',?\s*auth_enabled\s*=\s*False\s*,?',
)


def _migrate_remove_auth_disabled(root: Path, dry_run: bool) -> bool:
    """Remove auth-disable settings from .env and main.py.

    Returns True if a migration was performed (or would be in dry-run).
    """
    changed = False

    # ── backend/.env ─────────────────────────────────────────────────────────
    env_path = root / "backend" / ".env"
    if env_path.exists():
        try:
            content = env_path.read_text(encoding="utf-8")
            if _AUTH_DISABLED_RE.search(content):
                new_content = _AUTH_DISABLED_RE.sub(
                    r'# \1  ← removed: authentication cannot be disabled (veloiq migrate)',
                    content,
                )
                if dry_run:
                    click.echo("  • backend/.env: comment out VELOIQ_AUTH_DISABLED setting")
                else:
                    bak = env_path.with_suffix(".env.bak")
                    shutil.copy(env_path, bak)
                    env_path.write_text(new_content, encoding="utf-8")
                    click.echo(
                        "  ✅  backend/.env: commented out VELOIQ_AUTH_DISABLED\n"
                        f"      original backed up → backend/.env.bak"
                    )
                changed = True
        except Exception as exc:
            click.echo(f"  ❌  Could not process {env_path}: {exc}", err=True)

    # ── backend/app/main.py (or backend/main.py) ──────────────────────────────
    for candidate in ("backend/app/main.py", "backend/main.py"):
        main_path = root / candidate
        if not main_path.exists():
            continue
        try:
            content = main_path.read_text(encoding="utf-8")
            if _AUTH_ENABLED_FALSE_RE.search(content):
                new_content = _AUTH_ENABLED_FALSE_RE.sub("", content)
                if dry_run:
                    click.echo(f"  • {candidate}: remove auth_enabled=False from VeloIQConfig")
                else:
                    bak = main_path.with_suffix(".py.bak")
                    shutil.copy(main_path, bak)
                    main_path.write_text(new_content, encoding="utf-8")
                    click.echo(
                        f"  ✅  {candidate}: removed auth_enabled=False\n"
                        f"      original backed up → {candidate}.bak"
                    )
                changed = True
        except Exception as exc:
            click.echo(f"  ❌  Could not process {main_path}: {exc}", err=True)
        break

    return changed


# ---------------------------------------------------------------------------
# Step 5 – Detect <img src="…/api/file/…"> that need AuthenticatedImage
#           File content endpoints now require a Bearer token. Plain <img> tags
#           don't send auth headers, so they silently return 401 after the
#           auth security update.  This step finds affected files and reports
#           the exact lines so the developer can apply the fix manually.
# ---------------------------------------------------------------------------

# Any line containing /api/file/ and an img src attribute reference.
_IMG_FILE_LINE_RE = re.compile(r'/api/file/')


def _migrate_authenticated_images(root: Path, dry_run: bool) -> bool:
    """Detect <img> tags referencing /api/file/ endpoints in custom frontend files.

    Scans all non-generated .tsx / .ts files under frontend/src and reports
    lines that need to be converted to <AuthenticatedImage url={…}> from
    @juicemantics/veloiq-ui.

    Returns True if any affected files were found.
    """
    frontend_src = root / "frontend" / "src"
    if not frontend_src.exists():
        return False

    tsx_files = [
        p for p in sorted(frontend_src.rglob("*.tsx"))
        if not p.name.endswith(".gen.ts") and "node_modules" not in p.parts
           and "AuthenticatedImage" not in p.name
    ]

    hits: list[tuple[Path, list[tuple[int, str]]]] = []

    for fpath in tsx_files:
        try:
            lines = fpath.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        if "AuthenticatedImage" in "".join(lines):
            continue  # already migrated
        matches = [
            (i + 1, ln.strip())
            for i, ln in enumerate(lines)
            if _IMG_FILE_LINE_RE.search(ln) and ("<img" in ln or "src=" in ln)
        ]
        if matches:
            hits.append((fpath, matches))

    if not hits:
        return False

    rel_prefix = root
    click.echo(
        "  ⚠️   frontend/src: found <img> tags referencing /api/file/ endpoints.\n"
        "      File content now requires a Bearer token — plain <img src=…> tags\n"
        "      return 401.  Replace each with <AuthenticatedImage url={…}> from\n"
        "      @juicemantics/veloiq-ui (no other code changes needed).\n"
    )
    for fpath, matches in hits:
        rel = fpath.relative_to(rel_prefix)
        click.echo(f"      {rel}:")
        for lineno, snippet in matches:
            click.echo(f"        line {lineno}: {snippet[:100]}")
    click.echo(
        "\n      Fix pattern:\n"
        "        Before:  <img src={url} alt={label} style={…} />\n"
        "        After:   <AuthenticatedImage url={url} alt={label} style={…} />\n"
        "        Import:  import { AuthenticatedImage } from '@juicemantics/veloiq-ui';"
    )
    return True


# ---------------------------------------------------------------------------
# Main command
# ---------------------------------------------------------------------------

@click.command("migrate")
@click.option(
    "--project-root", default=None,
    help="Project root directory (default: auto-detected from CWD).",
)
@click.option(
    "--dry-run", is_flag=True, default=False,
    help="Show what would change without writing any files.",
)
def migrate(project_root: Optional[str], dry_run: bool) -> None:
    """Upgrade this VeloIQ host app to the current framework version.

    Runs all migration steps in order; each step is skipped automatically
    when the project is already current.  Safe to run multiple times.

    \b
    Steps performed:
      1. views_preferences.json  — import legacy dashboard config
      2. frontend/vite.config.ts — remove obsolete proxy rewrites
      3. frontend/package.json   — bump @juicemantics/veloiq-ui floor so newer
                                   optional ModelDef props (e.g. titleFields) type-check
      4. backend/.env / main.py  — remove VELOIQ_AUTH_DISABLED and auth_enabled=False
      5. frontend/src/**/*.tsx   — replace <img src="/api/file/…"> with
                                   <AuthenticatedImage url={…}> (file endpoints now
                                   require Bearer auth; plain <img> tags do not send it)

    Use --dry-run to preview changes without writing files.
    """
    root = _find_project_root(project_root)
    if root is None:
        click.echo(
            "❌  Could not locate a VeloIQ project from the current directory.\n"
            "    Run this command from inside a project, or pass --project-root.",
            err=True,
        )
        raise SystemExit(1)

    if dry_run:
        click.echo(f"\n🔍  Dry run — no files will be written  (project: {root})\n")
    else:
        click.echo(f"\n🚀  Migrating project: {root}\n")

    ran: list[str] = []

    if _migrate_views(root, dry_run):
        ran.append("views_preferences.json")

    if _migrate_vite_config(root, dry_run):
        ran.append("frontend/vite.config.ts")

    if _migrate_ui_package_version(root, dry_run):
        ran.append("frontend/package.json")

    if _migrate_remove_auth_disabled(root, dry_run):
        ran.append("auth-disable settings")

    if _migrate_authenticated_images(root, dry_run):
        ran.append("frontend/src (AuthenticatedImage)")

    if not ran:
        click.echo("✅  Nothing to migrate — project is already current.")
    elif dry_run:
        click.echo(f"\n  Run without --dry-run to apply these changes.")
    else:
        click.echo(f"\n✅  Migration complete.  Rebuild the frontend to pick up config changes:")
        click.echo(f"      veloiq build")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def _find_project_root(project_root_override: Optional[str] = None) -> Optional[Path]:
    if project_root_override:
        return Path(project_root_override).resolve()
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            if (parent / "backend").exists():
                return parent
    return None

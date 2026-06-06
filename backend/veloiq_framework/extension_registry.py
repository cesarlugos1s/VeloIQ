"""Per-app extension allowlist — explicit opt-in for VeloIQ extensions.

VeloIQ extensions declare a ``veloiq.extensions`` entry point, which makes them
discoverable to *every* application installed in the same virtualenv. To keep an
app's surface explicit (and avoid an extension leaking into an unrelated app
just because it is pip-installed), each app opts in through a ``veloiq.toml``
file at its **project root**::

    [extensions]
    enabled = ["iqvigilant"]

Only the listed extensions are loaded — both at app startup
(``create_veloiq_app``) and during ``veloiq generate``. With no ``veloiq.toml``
(and no ``VELOIQ_EXTENSIONS`` override) an app loads **no** extensions.

Resolution precedence for the enabled list:
    1. ``VELOIQ_EXTENSIONS`` env var (comma-separated) — overrides the file.
    2. ``[extensions].enabled`` in the nearest ``veloiq.toml``.
    3. ``[]`` (strict default — nothing loads).

Manage the file with the CLI: ``veloiq extend-package``, ``remove-package``,
``list-extensions`` (or the interactive ``veloiq`` explorer).
"""
from __future__ import annotations

import os
from pathlib import Path

CONFIG_FILENAME = "veloiq.toml"
ENV_VAR = "VELOIQ_EXTENSIONS"
ENTRY_POINT_GROUP = "veloiq.extensions"


# ---------------------------------------------------------------------------
# TOML read (stdlib tomllib on 3.11+, tomli on 3.10)
# ---------------------------------------------------------------------------

def _load_toml(path: Path) -> dict:
    try:
        import tomllib  # type: ignore
    except ModuleNotFoundError:  # pragma: no cover - py3.10
        import tomli as tomllib  # type: ignore
    with open(path, "rb") as fh:
        return tomllib.load(fh)


# ---------------------------------------------------------------------------
# Discovery of what is installed vs. what is enabled
# ---------------------------------------------------------------------------

def installed_extensions() -> list[str]:
    """Entry-point names of every VeloIQ extension installed in this venv."""
    from importlib.metadata import entry_points

    return sorted(ep.name for ep in entry_points(group=ENTRY_POINT_GROUP))


def find_config_file(start: Path | str | None = None) -> Path | None:
    """Return the nearest ``veloiq.toml`` at or above *start* (default CWD)."""
    base = Path(start or Path.cwd()).resolve()
    for directory in (base, *base.parents):
        candidate = directory / CONFIG_FILENAME
        if candidate.is_file():
            return candidate
    return None


def find_project_root(start: Path | str | None = None) -> Path | None:
    """Best-effort project root.

    Prefers the directory that holds ``veloiq.toml``; otherwise the directory
    that contains ``backend/app/modules`` (or its parent when run from inside
    ``backend/``).
    """
    cfg = find_config_file(start)
    if cfg is not None:
        return cfg.parent
    base = Path(start or Path.cwd()).resolve()
    for directory in (base, *base.parents):
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            return parent if (parent / "backend").exists() else directory
    return None


def _file_enabled(root: Path) -> list[str]:
    """The ``[extensions].enabled`` list as stored in ``root/veloiq.toml``."""
    cfg = root / CONFIG_FILENAME
    if not cfg.is_file():
        return []
    try:
        data = _load_toml(cfg)
    except Exception:
        return []
    enabled = (data.get("extensions") or {}).get("enabled", [])
    return [str(x) for x in enabled] if isinstance(enabled, list) else []


def read_enabled_extensions(start: Path | str | None = None) -> list[str]:
    """Resolve the enabled-extension allowlist for the app at *start* (or CWD).

    Honours ``VELOIQ_EXTENSIONS`` first, then ``veloiq.toml``, then ``[]``.
    """
    env = os.environ.get(ENV_VAR)
    if env is not None:
        return [name.strip() for name in env.split(",") if name.strip()]

    cfg = find_config_file(start)
    if cfg is None:
        return []
    return _file_enabled(cfg.parent)


# ---------------------------------------------------------------------------
# Global UI view settings ([views] table in veloiq.toml)
# ---------------------------------------------------------------------------

# Maps the snake_case keys a developer writes in the ``[views]`` table of
# ``veloiq.toml`` to the camelCase keys the frontend ViewSettings consumer
# (packages/ui DynamicResource) expects, plus a coercer used as a safety net.
# These knobs were configurable in the original JuiceMantics ``jm_config.ini``
# ``[views]`` section and are restored here so each host app can tune them.
_VIEWS_KEY_MAP: dict[str, tuple[str, type]] = {
    "modules_color_schema": ("modulesColorSchema", str),
    "models_color_schema": ("modelsColorSchema", str),
    "plain_color_base_hex": ("plainColorBaseHex", str),
    "show_view_type": ("showViewType", str),
    "edit_view_type": ("editViewType", str),
    "list_view_type": ("listViewType", str),
    "file_list_view_type": ("fileListViewType", str),
    "gallery_image_width": ("galleryImageWidth", int),
    "gallery_image_height": ("galleryImageHeight", int),
    "relations_max_rows_to_load": ("relationsMaxRowsToLoad", int),
    "max_distinct_column_filter_values_to_ranges": ("maxDistinctColumnFilterValuesToRanges", int),
    "general_actions_button_position": ("generalActionsButtonPosition", str),
    "add_tabs_for_non_configured_relations": ("addTabsForNonConfiguredRelations", bool),
}


def read_views_config(start: Path | str | None = None) -> dict:
    """Return the ``[views]`` table from the nearest ``veloiq.toml``.

    Keys are mapped from the developer-facing snake_case names to the camelCase
    keys the frontend expects. Only keys actually present in the file are
    returned, so anything left unset falls back to the frontend's built-in
    defaults. Missing file / table / parse error → ``{}``.
    """
    cfg = find_config_file(start)
    if cfg is None:
        return {}
    try:
        data = _load_toml(cfg)
    except Exception:
        return {}
    views = data.get("views")
    if not isinstance(views, dict):
        return {}
    out: dict = {}
    for toml_key, (frontend_key, coerce) in _VIEWS_KEY_MAP.items():
        if toml_key not in views or views[toml_key] is None:
            continue
        try:
            out[frontend_key] = coerce(views[toml_key])
        except (TypeError, ValueError):
            continue
    return out


# ---------------------------------------------------------------------------
# Mutating the allowlist (used by the CLI)
# ---------------------------------------------------------------------------

def _dedup(names: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _dump_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    if isinstance(value, list):
        if not value:
            return "[]"
        inner = ",\n".join("    " + _dump_scalar(item) for item in value)
        return "[\n" + inner + ",\n]"
    raise TypeError(f"unsupported TOML value: {type(value)!r}")


def _render(enabled: list[str], preserved: dict) -> str:
    header = (
        "# VeloIQ project configuration.\n"
        "#\n"
        "# Extensions explicitly enabled for THIS app. Only the extensions listed\n"
        "# here load — at startup and during `veloiq generate` — regardless of what\n"
        "# is pip-installed in the virtualenv. Manage with:\n"
        "#   veloiq extend-package <name>     veloiq remove-package <name>\n"
        "#   veloiq list-extensions\n"
        "\n"
        "[extensions]\n"
        f"enabled = {_dump_scalar(enabled)}\n"
    )
    if not preserved:
        return header
    # Best-effort re-emit of any non-extensions tables already in the file.
    extra_lines: list[str] = []
    for key, val in preserved.items():
        if isinstance(val, dict):
            extra_lines.append(f"\n[{key}]")
            for k, v in val.items():
                extra_lines.append(f"{k} = {_dump_scalar(v)}")
        else:
            extra_lines.append(f"{key} = {_dump_scalar(val)}")
    return header + "\n".join(extra_lines) + "\n"


def write_enabled_extensions(root: Path | str, enabled: list[str]) -> Path:
    """Write the enabled list to ``root/veloiq.toml`` (preserving other tables)."""
    root = Path(root).resolve()
    path = root / CONFIG_FILENAME
    preserved: dict = {}
    if path.is_file():
        try:
            data = _load_toml(path)
            preserved = {k: v for k, v in data.items() if k != "extensions"}
        except Exception:
            preserved = {}
    try:
        text = _render(_dedup(enabled), preserved)
    except TypeError:
        # Unserializable preserved content — fall back to extensions-only.
        text = _render(_dedup(enabled), {})
    path.write_text(text, encoding="utf-8")
    return path


def add_extension(name: str, start: Path | str | None = None) -> tuple[Path, list[str]]:
    """Add *name* to the project's enabled list. Returns (config_path, enabled)."""
    root = find_project_root(start)
    if root is None:
        raise FileNotFoundError(
            "Not inside a VeloIQ project (no veloiq.toml or backend/app/modules found)."
        )
    enabled = _dedup([*_file_enabled(root), name])
    path = write_enabled_extensions(root, enabled)
    return path, enabled


def remove_extension(name: str, start: Path | str | None = None) -> tuple[Path, list[str]]:
    """Remove *name* from the project's enabled list. Returns (config_path, enabled)."""
    root = find_project_root(start)
    if root is None:
        raise FileNotFoundError(
            "Not inside a VeloIQ project (no veloiq.toml or backend/app/modules found)."
        )
    enabled = [n for n in _file_enabled(root) if n != name]
    path = write_enabled_extensions(root, enabled)
    return path, enabled

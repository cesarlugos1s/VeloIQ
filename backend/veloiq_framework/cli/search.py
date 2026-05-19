"""veloiq search — manage which models appear in the global search bar."""
from __future__ import annotations

import json
from pathlib import Path

import click


_CONFIG_FILE = Path("config") / "search.json"


def _find_config_path() -> Path:
    """Return the search.json path, resolved relative to the project root."""
    # Walk up from CWD looking for the canonical project layout
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory / "config" / "search.json"
        if (directory / "app" / "modules").exists():
            root = directory.parent if (directory.parent / "backend").exists() else directory
            return root / "config" / "search.json"
    return cwd / "config" / "search.json"


def _load() -> dict:
    path = _find_config_path()
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("models", [])
                data.setdefault("fields", [])
                return data
        except Exception:
            pass
    return {"models": [], "fields": []}


def _save(data: dict) -> None:
    path = _find_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    click.echo(f"  💾 Saved: {path}")


@click.group()
def search():
    """Manage which models and fields are included in global search.

    \b
    Quick start:
      veloiq search add-model Task --fields title,description
      veloiq search add-model Project --fields name,description
      veloiq search list
    """


@search.command("add-model")
@click.argument("model_name")
@click.option(
    "--fields", default=None,
    help="Comma-separated field names to also add, e.g. name,title,description.",
)
def add_model(model_name: str, fields: str | None) -> None:
    """Add MODEL_NAME to the global search index.

    \b
    Examples:
      veloiq search add-model Task
      veloiq search add-model Task --fields title,description
      veloiq search add-model TeamMember --fields name,email
    """
    data = _load()
    models: list = data["models"]
    if model_name in models:
        click.echo(f"  ⚠️  Already configured: {model_name}")
    else:
        models.append(model_name)
        click.echo(f"  ✅ Model added:  {model_name}")

    if fields:
        field_list: list = data["fields"]
        for field in [f.strip() for f in fields.split(",") if f.strip()]:
            if field not in field_list:
                field_list.append(field)
                click.echo(f"  ✅ Field added:  {field}")
            else:
                click.echo(f"  ⚠️  Already configured: {field}")
    elif not data["fields"]:
        click.echo(
            "  ℹ️  No fields configured yet — all string fields of each model will be\n"
            "     searched until you add specific fields with --fields or add-field.\n"
            "     Example:  veloiq search add-field title"
        )

    _save(data)


@search.command("remove-model")
@click.argument("model_name")
def remove_model(model_name: str) -> None:
    """Remove MODEL_NAME from the global search index."""
    data = _load()
    if model_name in data["models"]:
        data["models"].remove(model_name)
        _save(data)
        click.echo(f"  ✅ Model removed: {model_name}")
    else:
        click.echo(f"  ⚠️  Not found: {model_name}")


@search.command("add-field")
@click.argument("field_name")
def add_field(field_name: str) -> None:
    """Add FIELD_NAME to the list of attributes searched across all models.

    \b
    Example:
      veloiq search add-field name
      veloiq search add-field description
    """
    data = _load()
    if field_name in data["fields"]:
        click.echo(f"  ⚠️  Already configured: {field_name}")
    else:
        data["fields"].append(field_name)
        _save(data)
        click.echo(f"  ✅ Field added: {field_name}")


@search.command("remove-field")
@click.argument("field_name")
def remove_field(field_name: str) -> None:
    """Remove FIELD_NAME from the searchable attributes list."""
    data = _load()
    if field_name in data["fields"]:
        data["fields"].remove(field_name)
        _save(data)
        click.echo(f"  ✅ Field removed: {field_name}")
    else:
        click.echo(f"  ⚠️  Not found: {field_name}")


@search.command("list")
def list_config() -> None:
    """Show the current search configuration."""
    data = _load()
    path = _find_config_path()
    click.echo(f"\nConfig file: {path}" + (" (not yet created)" if not path.exists() else ""))
    click.echo("\nSearchable models:")
    for m in data["models"] or ["  (none)"]:
        click.echo(f"  • {m}")
    click.echo("\nSearchable fields (searched in all models above):")
    for f in data["fields"] or ["  (none)"]:
        click.echo(f"  • {f}")
    click.echo()

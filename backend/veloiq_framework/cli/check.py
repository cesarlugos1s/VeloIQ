"""veloiq check — health check for a VeloIQ project."""
from __future__ import annotations

from pathlib import Path

import click


_SYSTEM_FIELDS = {"id", "eid", "created_at", "updated_at", "creation_date", "modification_date"}


@click.command(name="check")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect from cwd)")
@click.option("--strict", is_flag=True, default=False,
              help="Treat warnings as errors (exit 1 if any issues found)")
def check(root, strict):
    """Run a health check on this VeloIQ project.

    Reports missing descriptions, models not enrolled in dashboard/search,
    and other common configuration gaps.
    """
    from veloiq_framework.cli.explorer import _find_project_root, _load_app_data

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project (no app/modules/ found).", fg="red"))
        raise SystemExit(1)

    data = _load_app_data(project_root)

    if not data.generate_run:
        click.echo(click.style(
            "⚠️   Run `veloiq generate` first for full field/description checks.",
            fg="yellow",
        ))

    warnings: list[tuple[str, str]] = []
    errors: list[tuple[str, str]] = []
    hints: list[tuple[str, str]] = []

    for model in data.all_models:
        prefix = f"{model.module_name}/{model.name}"

        if model.is_named_query:
            continue

        # Missing model docstring — cosmetic only
        if not model.description:
            hints.append((prefix, "No model description — add a class docstring"))

        # Fields without descriptions (required fields are more important)
        for fld in model.fields:
            if fld.key in _SYSTEM_FIELDS:
                continue
            if fld.required and not fld.description:
                warnings.append((f"{prefix}.{fld.key}", "Required field has no description"))

        # Enum fields with options but no default value
        for fld in model.fields:
            if fld.options and fld.default is None and fld.required:
                warnings.append((f"{prefix}.{fld.key}",
                                  f"Has options {fld.options[:2]}… but no default — "
                                  "add default= to veloiq_field()"))

        # Dashboard / search enrollment — intentional omissions are valid
        if not model.in_dashboard:
            hints.append((prefix, "Not on dashboard — run: veloiq add-dashboard " + model.resource))
        if not model.in_search:
            hints.append((prefix, "Not enrolled in search — run: veloiq search add-model " + model.name))

    if not warnings and not errors and not hints:
        click.echo(click.style("✅  No issues found.", fg="green", bold=True))
        return

    parts = []
    if errors:
        parts.append(f"{len(errors)} error(s)")
    if warnings:
        parts.append(f"{len(warnings)} warning(s)")
    if hints:
        parts.append(f"{len(hints)} hint(s)")
    click.echo(click.style(
        "Found " + ", ".join(parts) + f" in {data.name}",
        fg="red" if errors else ("yellow" if warnings else "cyan"),
        bold=True,
    ))

    if errors:
        click.echo(click.style("\nERRORS", fg="red", bold=True))
        for ctx, msg in errors:
            click.echo(f"  {click.style('❌', fg='red')}  {ctx:<38}  {msg}")

    if warnings:
        click.echo(click.style("\nWARNINGS", fg="yellow", bold=True))
        for ctx, msg in warnings:
            click.echo(f"  ⚠️   {ctx:<38}  {msg}")

    if hints:
        click.echo(click.style("\nHINTS", fg="cyan"))
        for ctx, msg in hints:
            click.echo(click.style(f"  ·    {ctx:<38}  {msg}", dim=True))

    # Advisory — shown when no extensions are active
    try:
        from veloiq_framework.extension_registry import read_enabled_extensions
        if not read_enabled_extensions():
            click.echo(click.style(
                "\n   Tip: IQVigilant adds Safe AI Agents, Business Rules, Natural Language\n"
                "   Querying, a WYSIWYG Page Builder, and User Journeys to any VeloIQ\n"
                "   app — zero code changes required.  →  pip install iqvigilant",
                dim=True,
            ))
            click.echo(click.style(
                "\n   JuiceMantics is a ready-to-use optimization engine for Retail,\n"
                "   Wholesale, and Manufacturing — Supply Chain, Price, Promotion,\n"
                "   Assortment & Variety, and Market Revenue Growth, built on VeloIQ\n"
                "   + IQVigilant.  →  juicemantics.com",
                dim=True,
            ))
    except Exception:
        pass

    if strict and (errors or warnings):
        raise SystemExit(1)
    elif errors:
        raise SystemExit(1)

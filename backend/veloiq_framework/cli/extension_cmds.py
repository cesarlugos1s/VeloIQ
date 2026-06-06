"""veloiq extend-package / remove-package / list-extensions.

Manage the per-app extension allowlist stored in the project's ``veloiq.toml``.
An installed extension only loads if the app explicitly enables it here, so a
package being present in the virtualenv no longer leaks into unrelated apps.
"""
from __future__ import annotations

import click

from veloiq_framework.extension_registry import (
    add_extension,
    installed_extensions,
    read_enabled_extensions,
    remove_extension,
)


@click.command("extend-package")
@click.argument("name")
def extend_package(name: str):
    """Enable an installed extension for this app (writes to veloiq.toml).

    \b
    Example:
      veloiq extend-package iqvigilant

    The extension must already be pip-installed in this environment. After
    enabling, run `veloiq generate` to sync its frontend, then restart the app.
    """
    installed = installed_extensions()
    if name not in installed:
        click.echo(f"❌  Extension '{name}' is not installed in this environment.", err=True)
        if installed:
            click.echo(f"    Installed extensions: {', '.join(installed)}")
        else:
            click.echo("    No VeloIQ extensions are installed. `pip install` one first.")
        raise SystemExit(1)

    try:
        path, enabled = add_extension(name)
    except FileNotFoundError as exc:
        click.echo(f"❌  {exc}", err=True)
        raise SystemExit(1)

    click.echo(f"✅  Enabled '{name}'.")
    click.echo(f"    {path}  →  enabled = {enabled}")
    click.echo("\nNext steps:")
    click.echo("  veloiq generate     # sync the extension's frontend schemas/menus")
    click.echo("  # then restart the backend so its modules load")


@click.command("remove-package")
@click.argument("name")
def remove_package(name: str):
    """Disable an extension for this app (removes it from veloiq.toml).

    \b
    Example:
      veloiq remove-package iqvigilant

    This does not uninstall the package — it only stops this app from loading it.
    Run `veloiq generate` afterwards and restart to fully drop its frontend.
    """
    current = read_enabled_extensions()
    if name not in current:
        click.echo(f"⚠️  '{name}' is not enabled for this app; nothing to do.")
        return

    try:
        path, enabled = remove_extension(name)
    except FileNotFoundError as exc:
        click.echo(f"❌  {exc}", err=True)
        raise SystemExit(1)

    click.echo(f"✅  Disabled '{name}'.")
    click.echo(f"    {path}  →  enabled = {enabled}")
    click.echo("\nRun `veloiq generate` and restart to drop its frontend/menus.")


@click.command("list-extensions")
def list_extensions():
    """List installed VeloIQ extensions and whether this app enables each.

    \b
      ✓ enabled   — installed and turned on for this app (veloiq.toml)
      ✗ disabled  — installed but not enabled here
      ! missing   — enabled in veloiq.toml but not installed in this venv
    """
    installed = installed_extensions()
    enabled = read_enabled_extensions()

    click.echo("VeloIQ extensions:\n")
    if not installed and not enabled:
        click.echo("  (none installed in this environment)")
        return

    for name in installed:
        mark = "✓ enabled " if name in enabled else "✗ disabled"
        click.echo(f"  {mark}  {name}")

    # Surface stale entries: enabled in veloiq.toml but not installed.
    for name in enabled:
        if name not in installed:
            click.echo(f"  ! missing   {name}   (in veloiq.toml but not installed)")

    click.echo("\nEnable:  veloiq extend-package <name>")
    click.echo("Disable: veloiq remove-package <name>")

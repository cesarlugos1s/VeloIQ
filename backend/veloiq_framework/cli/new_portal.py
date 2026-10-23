"""veloiq new-portal — scaffold an external portal on the standard portal shell."""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import click

#: Templates of a new portal (kept outside ``scaffold/``, which ``veloiq new`` copies whole).
PORTAL_SCAFFOLD_DIR = Path(__file__).resolve().parents[1] / "portal_scaffold"
#: The app scaffold's index.html: its synchronous translation bootstrap is shared by every portal.
APP_SCAFFOLD_INDEX_HTML = Path(__file__).resolve().parents[1] / "scaffold" / "frontend" / "index.html"

_UI_PACKAGE = "@juicemantics/veloiq-ui"
_DEFAULT_UI_DEPENDENCY = "^0.9.0"
_SITE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")


def _veloiq_ui_dependency_for(portal_dir: Path, project_root: Path) -> str:
    """Return the portal's dependency spec on the UI package: the app frontend's own, rebased for ``file:`` links."""
    try:
        app_package = json.loads((project_root / "frontend" / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return _DEFAULT_UI_DEPENDENCY
    spec = str((app_package.get("dependencies") or {}).get(_UI_PACKAGE) or _DEFAULT_UI_DEPENDENCY)
    if not spec.startswith("file:"):
        return spec
    linked_dir = (project_root / "frontend" / spec[len("file:"):]).resolve()
    return f"file:{os.path.relpath(linked_dir, portal_dir)}"


def _portal_index_html(portal_title: str) -> str:
    """Return the portal's index.html: the app scaffold's, with its translation bootstrap, titled for the portal."""
    return APP_SCAFFOLD_INDEX_HTML.read_text(encoding="utf-8").replace("{{app_title}}", portal_title)


def _portal_toml_table(site: str, folder: str, roles: list[str], title: str, token_storage_key: str, layout: str) -> str:
    """Return the ``[portals.<site>]`` table appended to veloiq.toml."""
    roles_toml = ", ".join(json.dumps(role) for role in roles)
    return (
        f"\n[portals.{site}]\n"
        f"folder = {json.dumps(folder)}\n"
        f"roles = [{roles_toml}]\n"
        f"title = {json.dumps(title)}\n"
        f"token_storage_key = {json.dumps(token_storage_key)}\n"
        f"default_layout = {json.dumps(layout)}\n"
        f"show_dashboard_menu_entry = false\n"
        f"\n[portals.{site}.features]\n"
        f"analyze = false\n"
        f"csv_export = true\n"
        f"saved_views = true\n"
        f"column_selector = true\n"
        f"record_metadata = true\n"
    )


def _run_veloiq_generate(backend_dir: Path) -> None:
    """Run ``veloiq generate`` so the portal gets its page schemas and menu."""
    veloiq_bin = shutil.which("veloiq") or str(Path(sys.executable).with_name("veloiq"))
    if not Path(veloiq_bin).exists():
        click.echo("  ⚠️  Could not find the `veloiq` command — run `veloiq generate` yourself.")
        return
    click.echo("\n  Running: veloiq generate\n")
    result = subprocess.run([veloiq_bin, "generate"], cwd=str(backend_dir), capture_output=True, text=True)
    for line in (result.stdout or "").strip().splitlines():
        if "portal" in line.lower() or "❌" in line:
            click.echo(f"  {line}")
    if result.returncode != 0:
        click.echo("  ⚠️  `veloiq generate` failed — fix the error and run it again:")
        for line in (result.stderr or "").strip().splitlines()[-10:]:
            click.echo(f"  {line}")


@click.command("new-portal")
@click.argument("site")
@click.option("--role", "roles", multiple=True, required=True,
              help="Role of the portal's users (repeat for several roles).")
@click.option("--title", default=None, help="Title shown in the portal's header (default: from the site name).")
@click.option("--folder", default=None, help="Folder of the portal's frontend (default: ext/<site>).")
@click.option("--layout", type=click.Choice(["horizontal", "vertical"]), default="horizontal",
              help="Menu layout the portal opens with.")
@click.option("--backend-port", default=8000, show_default=True, help="Backend port the dev server proxies to.")
@click.option("--dev-port", default=5174, show_default=True, help="Port of the portal's `npm run dev` server.")
@click.option("--no-generate", is_flag=True, help="Don't run `veloiq generate` afterwards.")
def new_portal(site, roles, title, folder, layout, backend_port, dev_port, no_generate):
    """Scaffold the external portal SITE for users with the given roles.

    \b
    Creates the portal's frontend on the standard portal shell (VeloIQPortalApp):
    the standard pages of the models its roles can read, its own menu
    (navigation.<site>.config.json), the host app's translations, light and dark
    mode, and a place for its own pages (src/portalPages.ts). Declares the portal
    in veloiq.toml ([portals.<site>]) and runs `veloiq generate`.

    \b
    Then:
      cd ext/<site> && npm install
      veloiq build        # builds the app and every portal
      veloiq run          # the portal is at /portals/<site>/

    \b
    Example:
      veloiq new-portal candidate-portal --role Candidate --title "Candidates"
    """
    from veloiq_framework.extension_registry import find_config_file
    from veloiq_framework.portals.read_portal_definitions import read_portal_definitions

    if not _SITE_NAME_PATTERN.match(site):
        click.echo("❌ The site name must start with a letter and use lowercase letters, digits and dashes.", err=True)
        raise SystemExit(1)
    config_file = find_config_file()
    if config_file is None:
        click.echo("❌ No veloiq.toml found — run this inside a VeloIQ app.", err=True)
        raise SystemExit(1)
    project_root = config_file.parent
    folder = folder or f"ext/{site}"
    portal_dir = project_root / folder
    if portal_dir.exists() and any(portal_dir.iterdir()):
        click.echo(f"❌ {portal_dir} already exists and is not empty.", err=True)
        raise SystemExit(1)

    portal_title = title or site.replace("-", " ").replace("_", " ").title()
    tokens = {
        "{{site}}": site,
        "{{backend_port}}": str(backend_port),
        "{{frontend_port}}": str(dev_port),
        "{{veloiq_ui_dependency}}": _veloiq_ui_dependency_for(portal_dir, project_root),
    }
    click.echo(f"🧩 Creating portal {site} in {portal_dir}")
    for template in PORTAL_SCAFFOLD_DIR.rglob("*"):
        if template.is_dir() or "__pycache__" in template.parts:
            continue
        relative_path = template.relative_to(PORTAL_SCAFFOLD_DIR)
        destination = portal_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        content = template.read_text(encoding="utf-8")
        for token, value in tokens.items():
            content = content.replace(token, value)
        destination.write_text(content, encoding="utf-8")
        click.echo(f"  📄 {relative_path}")
    (portal_dir / "index.html").write_text(_portal_index_html(portal_title), encoding="utf-8")
    click.echo("  📄 index.html")

    if site in read_portal_definitions(project_root):
        click.echo(f"  ⏭️  veloiq.toml already declares [portals.{site}] — left as it is")
    else:
        token_storage_key = f"{project_root.name}_{site}_token".replace("-", "_")
        with config_file.open("a", encoding="utf-8") as toml_file:
            toml_file.write(_portal_toml_table(site, folder, list(roles), portal_title, token_storage_key, layout))
        click.echo(f"  📝 veloiq.toml: [portals.{site}] added")

    backend_dir = project_root / "backend"
    if not no_generate and backend_dir.is_dir():
        _run_veloiq_generate(backend_dir)

    click.echo(f"\n✅ Portal {site} created. Next:")
    click.echo(f"  cd {folder} && npm install")
    click.echo("  veloiq build                 # builds the app and every portal")
    click.echo(f"  veloiq run                   # the portal is at /portals/{site}/")

"""veloiq — VeloIQ CLI entry point."""
import click

from veloiq_framework.cli.new import new
from veloiq_framework.cli.module import add_module
from veloiq_framework.cli.generate import generate
from veloiq_framework.cli.migrate import migrate
from veloiq_framework.cli.run import run
from veloiq_framework.cli.db import db
from veloiq_framework.cli.search import search
from veloiq_framework.cli.dashboard import add_dashboard
from veloiq_framework.cli.new_extension import new_extension
from veloiq_framework.cli.add_licensing import add_licensing
from veloiq_framework.cli.extension_cmds import (
    extend_package,
    remove_package,
    list_extensions,
)


@click.group(invoke_without_command=True)
@click.version_option(package_name="veloiq-framework", prog_name="veloiq")
@click.pass_context
def cli(ctx):
    """VeloIQ™ framework CLI.

    \b
    Quick start:
      veloiq new my-app              Create a new project
      veloiq add-module inventory    Add a module to an existing project
      veloiq generate                Generate frontend schemas from backend models
      veloiq run                     Start the development server
      veloiq db upgrade              Apply Alembic migrations

    Extension packages:
      veloiq new-extension myext     Scaffold a new extension package
      veloiq add-licensing           Add license enforcement to this host app
      veloiq extend-package myext    Enable an installed extension for this app
      veloiq remove-package myext    Disable an extension for this app
      veloiq list-extensions         Show installed vs. enabled extensions

    Run `veloiq` with no arguments to open the interactive project explorer.
    """
    if ctx.invoked_subcommand is None:
        from veloiq_framework.cli.explorer import launch_explorer
        launch_explorer()


cli.add_command(new)
cli.add_command(add_module)
cli.add_command(generate)
cli.add_command(migrate)
cli.add_command(run)
cli.add_command(db)
cli.add_command(search)
cli.add_command(add_dashboard)
cli.add_command(new_extension)
cli.add_command(add_licensing)
cli.add_command(extend_package)
cli.add_command(remove_package)
cli.add_command(list_extensions)

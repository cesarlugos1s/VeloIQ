"""safem — SafeMantIQ CLI entry point."""
import click

from safemantiq_framework.cli.new import new
from safemantiq_framework.cli.module import add_module
from safemantiq_framework.cli.generate import generate
from safemantiq_framework.cli.run import run
from safemantiq_framework.cli.db import db
from safemantiq_framework.cli.search import search


@click.group()
@click.version_option(package_name="safemantiq-framework", prog_name="safem")
def cli():
    """SafeMantIQ framework CLI.

    \b
    Quick start:
      safem new my-app              Create a new project
      safem add-module inventory    Add a module to an existing project
      safem generate                Generate frontend schemas from backend models
      safem run                     Start the development server
      safem db upgrade              Apply Alembic migrations
    """


cli.add_command(new)
cli.add_command(add_module)
cli.add_command(generate)
cli.add_command(run)
cli.add_command(db)
cli.add_command(search)

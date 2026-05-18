"""safem generate — generate frontend TypeScript schemas from backend models."""
import click
from pathlib import Path


@click.command()
@click.option("--modules-dir", default=None, help="Path to the modules directory.")
@click.option("--frontend-src", default=None, help="Path to frontend/src directory.")
@click.option("--project-root", default=None, help="Project root (default: CWD).")
def generate(modules_dir, frontend_src, project_root):
    """Generate backend api.py files and frontend TypeScript schemas from SQLModel definitions.

    Scans backend modules and emits:

    \b
      backend/app/modules/{module}/api.py          (CRUD endpoints, do not edit)
      frontend/src/pages/{module}/{module}Schema.gen.ts
      frontend/src/allModels.gen.ts

    Run this whenever you add or change a model.
    Use custom_api.py (not api.py) for custom endpoints.
    """
    from safemantiq_framework.api_schema_gen import run_api_schema_gen
    run_api_schema_gen(
        modules_dir=modules_dir,
        frontend_src=frontend_src,
        project_root=project_root,
    )

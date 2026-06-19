"""Regression tests for `veloiq import-schema` relationship scaffolding.

These reproduce the schema shapes that previously produced broken models.py:

  1. Two FKs from one table to the *same* target  (film.language_id +
     film.original_language_id -> language) — needs explicit ``foreign_keys`` and
     unique reverse-collection names.
  2. Two FK paths *between the same pair* of tables, one in each direction
     (staff.store_id -> store, store.manager_staff_id -> staff) — also ambiguous,
     so every relationship between them needs ``foreign_keys``.
  3. M2M junction tables (film_actor, film_category) whose link class must be
     defined *before both* classes that reference it via ``link_model=``.

The strong assertion is the subprocess at the end: it imports the generated
module and runs ``configure_mappers()`` + ``create_all()`` exactly the way the
running app would, in a fresh interpreter so the global SQLModel registry stays
isolated from the rest of the test suite.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from veloiq_framework.cli.import_schema import _scaffold_from_schema

_DDL = [
    "CREATE TABLE language (language_id INTEGER PRIMARY KEY, name VARCHAR)",
    # film -> language twice (primary + original language)
    "CREATE TABLE film ("
    " film_id INTEGER PRIMARY KEY,"
    " title VARCHAR,"
    " language_id INTEGER NOT NULL REFERENCES language(language_id),"
    " original_language_id INTEGER REFERENCES language(language_id))",
    # store <-> staff: a circular two-path relationship
    "CREATE TABLE store ("
    " store_id INTEGER PRIMARY KEY,"
    " manager_staff_id INTEGER NOT NULL REFERENCES staff(staff_id))",
    "CREATE TABLE staff ("
    " staff_id INTEGER PRIMARY KEY,"
    " store_id INTEGER NOT NULL REFERENCES store(store_id))",
    "CREATE TABLE actor (actor_id INTEGER PRIMARY KEY, first_name VARCHAR)",
    "CREATE TABLE category (category_id INTEGER PRIMARY KEY, name VARCHAR)",
    # pure M2M junctions
    "CREATE TABLE film_actor ("
    " actor_id INTEGER NOT NULL REFERENCES actor(actor_id),"
    " film_id INTEGER NOT NULL REFERENCES film(film_id),"
    " PRIMARY KEY (actor_id, film_id))",
    "CREATE TABLE film_category ("
    " film_id INTEGER NOT NULL REFERENCES film(film_id),"
    " category_id INTEGER NOT NULL REFERENCES category(category_id),"
    " PRIMARY KEY (film_id, category_id))",
]

_MODULE = "imported_legacy"
_HEADER = (
    "from typing import TYPE_CHECKING, List, Optional\n"
    "from sqlmodel import SQLModel, Field\n"
    "from veloiq_framework import jm_relationship\n"
)


def _build_source_db(path: Path) -> None:
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        for ddl in _DDL:
            conn.execute(text(ddl))
    engine.dispose()


def _make_project(tmp_path: Path) -> Path:
    """Create the minimal project skeleton and a pre-seeded module.

    Pre-creating the module directory forces the importer's append path, which
    keeps the test independent of the frontend nav-config writer.
    """
    backend = tmp_path / "backend"
    app = backend / "app"
    modules = app / "modules"
    mod_dir = modules / _MODULE
    mod_dir.mkdir(parents=True)
    (app / "__init__.py").write_text("", encoding="utf-8")
    (modules / "__init__.py").write_text("", encoding="utf-8")
    (mod_dir / "__init__.py").write_text("", encoding="utf-8")
    (mod_dir / "models.py").write_text(_HEADER, encoding="utf-8")
    (mod_dir / "custom_api.py").write_text(
        "from fastapi import APIRouter\nrouter = APIRouter()\n", encoding="utf-8"
    )
    return tmp_path


def _scaffold(tmp_path: Path) -> str:
    _build_source_db(tmp_path / "source.db")
    project_root = _make_project(tmp_path)

    engine = create_engine(f"sqlite:///{tmp_path / 'source.db'}")
    inspector = inspect(engine)
    # Alphabetical order ensures `category` is scaffolded before `film`, which is
    # the order that used to trigger the FilmCategory NameError.
    selected = sorted(inspector.get_table_names())
    _scaffold_from_schema(selected, inspector, _MODULE, project_root, set(), set())
    engine.dispose()

    return (
        project_root / "backend" / "app" / "modules" / _MODULE / "models.py"
    ).read_text(encoding="utf-8")



def test_multi_fk_to_same_target_gets_foreign_keys(tmp_path):
    models = _scaffold(tmp_path)
    # Both FK columns must drive disambiguated relationships.
    assert '"foreign_keys": "[Film.language_id]"' in models
    assert '"foreign_keys": "[Film.original_language_id]"' in models
    # The reverse collections must have unique names (no duplicate back_populates).
    assert "original_language_films" in models


def test_bidirectional_two_path_gets_foreign_keys(tmp_path):
    models = _scaffold(tmp_path)
    assert '"foreign_keys": "[Staff.store_id]"' in models
    assert '"foreign_keys": "[Store.manager_staff_id]"' in models


def test_link_classes_defined_before_referencing_classes(tmp_path):
    models = _scaffold(tmp_path)
    for link_cls in ("FilmActor", "FilmCategory"):
        class_def = models.index(f"class {link_cls}(")
        first_use = models.index(f"link_model={link_cls}")
        assert class_def < first_use, (
            f"{link_cls} is referenced via link_model= before it is defined"
        )


def test_generated_models_configure_and_create(tmp_path):
    _scaffold(tmp_path)
    backend_dir = tmp_path / "backend"
    loader = (
        "import sys\n"
        f"sys.path.insert(0, {str(backend_dir)!r})\n"
        f"from app.modules.{_MODULE} import models  # noqa: F401\n"
        "from sqlalchemy.orm import configure_mappers\n"
        "from sqlmodel import SQLModel, create_engine\n"
        "configure_mappers()\n"
        "eng = create_engine('sqlite://')\n"
        "SQLModel.metadata.create_all(eng)\n"
        "print('CONFIGURE_OK')\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", loader],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, (
        "generated models failed to configure:\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert "CONFIGURE_OK" in proc.stdout

"""Per-model custom import-loader registry.

Modules that need custom row-loading logic (business-key upsert, FK-by-name
resolution, etc.) instead of the generic "validate with Pydantic, insert" path
used by ``create_crud_router``'s ``POST /import-csv`` route register a loader
function here, keyed by model class or tablename.

Discovery: any ``register_import_loaders()`` function found in a module's
``factory.py`` / ``{name}_factory.py`` is called automatically at app startup
by :func:`veloiq_framework.loader.load_factory_events` (host app modules) and
:func:`veloiq_framework.loader._load_extension_modules` (extension modules) —
the same discovery pass already used for ``register_*_events()``.

Example, in a module's ``factory.py``::

    def register_import_loaders() -> None:
        from veloiq_framework.import_registry import register_import_loader
        from .models import Item
        from .data_load_factory import dispatch_entity_load

        def _item_loader(row: dict, session) -> tuple[int, int]:
            return dispatch_entity_load(None, "Item", 0, [], attribute_dict=row)

        register_import_loader(Item, _item_loader)
"""
from __future__ import annotations

from typing import Callable, Type, TypeVar

T = TypeVar("T")

# (row_dict, session) -> (added: int, updated: int). Implementations should
# ``session.add()``/``session.merge()`` as needed but leave commit/rollback to
# the caller (the import-csv route commits once per request, or rolls back
# entirely when ``dry_run=true``).
ImportLoaderFn = Callable[[dict, object], tuple[int, int]]

_REGISTRY: dict[str, ImportLoaderFn] = {}


def register_import_loader(model_class_or_tablename: Type | str, loader_fn: ImportLoaderFn) -> None:
    """Register *loader_fn* as the CSV-import handler for a model.

    *model_class_or_tablename* may be a SQLModel table class (its
    ``__tablename__`` is used as the registry key) or a plain tablename
    string. Keying on tablename (rather than the class object) keeps the
    registry stable across module reloads.
    """
    key = getattr(model_class_or_tablename, "__tablename__", model_class_or_tablename)
    _REGISTRY[key] = loader_fn


def get_import_loader(model_class: Type) -> ImportLoaderFn | None:
    """Return the registered loader for *model_class*, or ``None``."""
    tablename = getattr(model_class, "__tablename__", None)
    if tablename is None:
        return None
    return _REGISTRY.get(tablename)

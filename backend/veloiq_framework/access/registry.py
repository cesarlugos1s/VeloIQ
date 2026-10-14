"""Registry of the modules and models that access policies can name.

The module loader registers every host-app module and every installed
extension module here as it loads them. Policies name a module by a
namespaced key, ``<source>:<module>``, where *source* is ``app`` for the host
app or the extension's name (e.g. ``advanced_development:jobs``). That keeps
modules apart that share a folder name, such as the ``license`` module every
extension ships. Models are named by table name.

Framework system modules (auth, help, system configuration) are never
registered: they live outside the module directories the loader scans. The
always-on modules from licensing (``license`` and friends) are skipped too,
so the resource picker only offers what a policy may restrict (AC-A4).
"""
from __future__ import annotations

from dataclasses import dataclass, field

#: Source name used in module keys for the host app's own modules.
HOST_SOURCE = "app"


@dataclass
class ModuleInfo:
    """A registered module: where it comes from and where its code lives."""
    key: str
    source: str
    name: str
    package: str
    models: set[str] = field(default_factory=set)


_MODULES: dict[str, ModuleInfo] = {}
_MODEL_TO_MODULE: dict[str, str] = {}
_EXTENSIONS: list = []
# The model scan runs lazily, after every module has been imported.
_models_resolved = False


def make_module_key(source: str, module_name: str) -> str:
    """Return the namespaced module key ``<source>:<module>``."""
    return f"{source}:{module_name}"


def split_module_key(module_key: str) -> tuple[str, str]:
    """Split ``<source>:<module>`` into ``(source, module)``."""
    source, _sep, name = module_key.partition(":")
    return source, name


def _is_excluded(module_name: str) -> bool:
    """True for modules that are always on and so can't be restricted."""
    from veloiq_framework.licensing_utils import _ALWAYS_ON_MODULES
    return module_name.lower() in _ALWAYS_ON_MODULES


def register_module(source: str, module_name: str, package: str) -> str | None:
    """Register one loaded module and return its key (``None`` if excluded).

    *package* is the dotted Python package of the module folder (e.g.
    ``app.modules.tasks``); models whose ``__module__`` lives under it belong
    to the module.
    """
    global _models_resolved
    if _is_excluded(module_name):
        return None
    key = make_module_key(source, module_name)
    _MODULES[key] = ModuleInfo(key=key, source=source, name=module_name, package=package)
    _models_resolved = False
    return key


def set_extensions(extensions: list | None) -> None:
    """Remember the enabled extensions so licensing can read their pools."""
    _EXTENSIONS[:] = list(extensions or [])


def get_extensions() -> list:
    """Return the enabled extensions recorded at load time."""
    return list(_EXTENSIONS)


def clear_registry() -> None:
    """Forget every registered module (used by tests)."""
    global _models_resolved
    _MODULES.clear()
    _MODEL_TO_MODULE.clear()
    _models_resolved = False


def _resolve_models() -> None:
    """Map every table model to the registered module whose package holds it."""
    global _models_resolved
    if _models_resolved:
        return
    from sqlmodel import SQLModel

    from veloiq_framework.loader import _iter_sqlmodel_subclasses

    _MODEL_TO_MODULE.clear()
    for info in _MODULES.values():
        info.models.clear()
    # Longest package first, so a nested package wins over its parent.
    ordered = sorted(_MODULES.values(), key=lambda m: len(m.package), reverse=True)
    for cls in _iter_sqlmodel_subclasses(SQLModel):
        tablename = getattr(cls, "__tablename__", None)
        if not tablename or getattr(cls, "__table__", None) is None:
            continue
        module_path = getattr(cls, "__module__", "") or ""
        for info in ordered:
            if module_path == info.package or module_path.startswith(info.package + "."):
                info.models.add(tablename)
                _MODEL_TO_MODULE.setdefault(tablename, info.key)
                break
    _models_resolved = True


def get_modules() -> dict[str, ModuleInfo]:
    """Return every registered module, keyed by module key."""
    _resolve_models()
    return dict(_MODULES)


def is_registered_module(module_key: str) -> bool:
    """True if *module_key* names a registered (installed, non-system) module."""
    return module_key in _MODULES


def module_key_for_model(model_key: str) -> str | None:
    """Return the module key of the model with table name *model_key*."""
    _resolve_models()
    return _MODEL_TO_MODULE.get(model_key)


def module_key_for_class(model_class: type) -> str | None:
    """Return the module key of a SQLModel table class, or ``None``."""
    tablename = getattr(model_class, "__tablename__", None)
    if not tablename:
        return None
    return module_key_for_model(tablename)


def model_belongs_to(module_key: str, model_key: str) -> bool:
    """True if the model *model_key* is part of the module *module_key*."""
    return module_key_for_model(model_key) == module_key


def registry_lookup() -> dict:
    """Return the live registry maps for :func:`~veloiq_framework.access.decision.evaluate_access`.

    Same keys as :func:`registry_snapshot` but without copying, for the
    per-request decision.
    """
    _resolve_models()
    return {"modules": _MODULES, "models": _MODEL_TO_MODULE}


def registry_snapshot() -> dict:
    """Return the registry as plain data, the shape the frontend evaluates with.

    ``{"modules": {key: {"source", "name", "models": [...]}},
       "models": {tablename: module_key}}``
    """
    _resolve_models()
    return {
        "modules": {
            key: {"source": info.source, "name": info.name, "models": sorted(info.models)}
            for key, info in sorted(_MODULES.items())
        },
        "models": dict(sorted(_MODEL_TO_MODULE.items())),
    }

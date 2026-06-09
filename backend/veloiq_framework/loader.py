"""Module auto-discovery and loading for VeloIQ apps.

This is the framework-level equivalent of load_all_modules() in main.py,
but fully parameterized — no global state, no hard-coded paths.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqladmin import Admin
    from veloiq_framework.config import VeloIQConfig


def _iter_sqlmodel_subclasses(base_cls: type) -> list[type]:
    discovered: list[type] = []
    to_visit = list(base_cls.__subclasses__())
    while to_visit:
        current = to_visit.pop()
        discovered.append(current)
        to_visit.extend(current.__subclasses__())
    return discovered


def _inject_model_classes(module_prefix: str) -> int:
    """Inject all SQLModel subclasses into every ``{module_prefix}.*.models``
    namespace so SQLAlchemy can resolve cross-module TYPE_CHECKING imports in
    string relationship expressions.

    Returns the count of injected classes.
    """
    from sqlmodel import SQLModel

    all_model_classes: dict[str, type] = {
        cls.__name__: cls for cls in _iter_sqlmodel_subclasses(SQLModel)
    }
    for mod_name, mod in list(sys.modules.items()):
        if mod is None:
            continue
        if not (mod_name.startswith(module_prefix) and mod_name.endswith(".models")):
            continue
        for class_name, cls in all_model_classes.items():
            if class_name not in mod.__dict__:
                mod.__dict__[class_name] = cls

    return len(all_model_classes)


def load_factory_events(modules_dir: Path) -> None:
    """Auto-discover and call every ``register_*_events()`` in ``*_factory.py``
    files under *modules_dir*."""
    modules_dir = Path(modules_dir)
    if not modules_dir.exists():
        return

    # Derive the dotted package prefix from what's already in sys.path.
    # Works for both "app.modules" and "myapp.modules" layouts.
    for folder in sorted(modules_dir.iterdir()):
        if not folder.is_dir() or folder.name.startswith("__"):
            continue
        for fname in folder.iterdir():
            if not (fname.name.endswith("_factory.py") or fname.name == "factory.py"):
                continue
            module_path = _path_to_module(fname)
            if module_path is None:
                continue
            try:
                factory_mod = importlib.import_module(module_path)
                for attr_name in dir(factory_mod):
                    if attr_name.startswith("register_") and attr_name.endswith("_events"):
                        fn = getattr(factory_mod, attr_name)
                        if callable(fn):
                            fn()
                            print(f"  ✅ Factory: {folder.name}.{attr_name}()")
            except Exception as exc:
                print(f"  ❌ Factory {module_path} FAILED: {exc}")


def load_modules(
    app: "FastAPI",
    admin: "Admin",
    config: "VeloIQConfig",
    *,
    extensions: list | None = None,
    license_exempt_modules: frozenset[str] = frozenset(),
    license_dependency_factory: object | None = None,
    patch_admin_license: object | None = None,
) -> None:
    """Two-pass module loader.

    Pass 1 — import every ``custom_api.py`` and ``api.py`` so all models land
    in ``sys.modules``.  Injects model classes into every models namespace to
    fix cross-module TYPE_CHECKING string expressions.

    Pass 2 — import admin views (which may trigger SQLAlchemy mapper config).

    Parameters
    ----------
    app:
        The FastAPI instance to register routers on.
    admin:
        The SQLAdmin Admin instance to register views on.
    config:
        VeloIQConfig (uses ``modules_dir``).
    extensions:
        Optional list of :class:`~veloiq_framework.extension.VeloIQExtension`
        manifests discovered by :func:`~veloiq_framework.extensions.discover_extensions`.
        Each extension's ``modules_package`` is loaded with the same three-pass
        pattern after the host app's own modules.
    license_exempt_modules:
        Module folder names exempt from license enforcement (framework apps
        typically leave this empty).
    license_dependency_factory:
        Callable(folder_name) -> FastAPI Depends — injected into each router.
        Pass None to skip license enforcement entirely.
    patch_admin_license:
        Callable(view, folder_name) — patches a SQLAdmin view with license
        access control.  Pass None to skip.
    """
    from fastapi import Depends

    modules_dir = Path(config.modules_dir)
    if not modules_dir.exists():
        print(f"❌ Modules directory not found: {modules_dir}")
        return

    module_folders = sorted(
        f.name for f in modules_dir.iterdir()
        if f.is_dir() and not f.name.startswith("__")
    )

    # Derive Python module prefix (e.g. "app.modules") from the directory.
    module_prefix = _dir_to_module_prefix(modules_dir)

    print(f"\n🔍 Scanning modules in {modules_dir} (prefix: {module_prefix})…")

    # ── Pass 0: import all models first so SQLAlchemy mapper configure_mappers()
    # succeeds regardless of alphabetical folder order (e.g. projects references
    # TeamMember before team/ is imported in Pass 1).
    for folder_name in module_folders:
        dotted = f"{module_prefix}.{folder_name}.models"
        try:
            importlib.import_module(dotted)
        except Exception:
            pass

    # ── Pass 1: APIs ──────────────────────────────────────────────────────────
    registered_router_ids: set[int] = set()

    for folder_name in module_folders:
        exempt = folder_name in license_exempt_modules
        lic_dep = (
            Depends(license_dependency_factory(folder_name))
            if (license_dependency_factory and not exempt)
            else None
        )

        for sub in ("custom_api", "api"):
            dotted = f"{module_prefix}.{folder_name}.{sub}"
            try:
                mod = importlib.import_module(dotted)
                if hasattr(mod, "router"):
                    router = mod.router
                    if id(router) in registered_router_ids:
                        # custom_api.py imported the same router object from api.py;
                        # it is already registered — skip to avoid duplicate operation IDs.
                        continue
                    if lic_dep is not None:
                        router.dependencies.append(lic_dep)
                    tag = "CUSTOM" if sub == "custom_api" else folder_name.upper()
                    app.include_router(router, tags=[folder_name.upper(), tag])
                    registered_router_ids.add(id(router))
                    print(f"  ✅ {sub}: {folder_name}")
            except ModuleNotFoundError as exc:
                if dotted not in str(exc):
                    print(f"  ❌ {folder_name}/{sub} FAILED: {exc}")
            except Exception as exc:
                print(f"  ❌ {folder_name}/{sub} CRASHED: {exc}")

    # Inject all loaded model classes so SQLAlchemy string expressions resolve.
    count = _inject_model_classes(module_prefix)
    print(f"  ✅ Injected {count} model classes into module namespaces")

    # ── Pass 1.5: Named query endpoints ──────────────────────────────────────
    from veloiq_framework.queries import NamedQuery
    from veloiq_framework.query_crud import create_query_router

    for folder_name in module_folders:
        dotted = f"{module_prefix}.{folder_name}.queries"
        try:
            queries_mod = importlib.import_module(dotted)
            for attr_name in dir(queries_mod):
                obj = getattr(queries_mod, attr_name)
                if isinstance(obj, NamedQuery):
                    router = create_query_router(obj)
                    app.include_router(router, tags=[folder_name.upper()])
                    print(f"  ✅ Query: {obj.name}")
        except ModuleNotFoundError as exc:
            if dotted not in str(exc):
                print(f"  ❌ {folder_name}/queries FAILED: {exc}")
        except Exception as exc:
            print(f"  ❌ {folder_name}/queries CRASHED: {exc}")

    # ── Pass 2: Admin views ───────────────────────────────────────────────────
    from sqlalchemy.orm import configure_mappers
    from sqladmin import ModelView
    from sqlmodel import SQLModel

    try:
        configure_mappers()
    except Exception as exc:
        print(f"  ⚠️  configure_mappers() warning: {exc}")

    for folder_name in module_folders:
        exempt = folder_name in license_exempt_modules
        dotted = f"{module_prefix}.{folder_name}.admin.admin_views"
        registered_any = False
        try:
            admin_mod = importlib.import_module(dotted)

            # Pattern A (JuiceMantics): explicit *_admin_views lists.
            for attr_name in dir(admin_mod):
                if attr_name.endswith("_admin_views") and isinstance(
                    getattr(admin_mod, attr_name), list
                ):
                    for view in getattr(admin_mod, attr_name):
                        try:
                            if patch_admin_license and not exempt:
                                patch_admin_license(view, folder_name)
                            admin.add_view(view)
                            registered_any = True
                        except Exception:
                            pass

            # Pattern B (framework): bare ModelView subclasses defined in the module.
            if not registered_any:
                for attr_name in dir(admin_mod):
                    obj = getattr(admin_mod, attr_name, None)
                    if (
                        isinstance(obj, type)
                        and issubclass(obj, ModelView)
                        and obj is not ModelView
                        and getattr(obj, "model", None) is not None
                    ):
                        try:
                            if patch_admin_license and not exempt:
                                patch_admin_license(obj, folder_name)
                            admin.add_view(obj)
                            registered_any = True
                        except Exception:
                            pass

            if registered_any:
                print(f"  ✅ Admin: {folder_name}")

        except ImportError:
            # No admin_views.py — auto-register all table models for this module.
            module_models = [
                cls for cls in _iter_sqlmodel_subclasses(SQLModel)
                if getattr(cls, "__module__", "").startswith(f"{module_prefix}.{folder_name}")
                and getattr(cls, "__tablename__", None)
            ]
            for model_cls in module_models:
                try:
                    # Must use ModelViewMeta directly so `model` lands in kwargs,
                    # which is where ModelViewMeta.__new__ reads it to set pk_columns.
                    # type(name, bases, {"model": cls}) puts it in attrs — wrong slot.
                    from sqladmin.models import ModelViewMeta
                    view = ModelViewMeta(
                        f"{model_cls.__name__}Admin", (ModelView,), {}, model=model_cls
                    )
                    admin.add_view(view)
                    registered_any = True
                except Exception as exc:
                    print(f"  ⚠️  Admin auto {folder_name}/{model_cls.__name__}: {exc}")
            if registered_any:
                print(f"  ✅ Admin (auto): {folder_name}")

        except Exception as exc:
            print(f"  ⚠️  {folder_name} Admin Error: {exc}")

    # ── Extension modules ─────────────────────────────────────────────────────
    for ext in (extensions or []):
        _load_extension_modules(
            app, admin, ext,
            registered_router_ids=registered_router_ids,
            license_dependency_factory=license_dependency_factory,
            patch_admin_license=patch_admin_license,
        )


def _load_extension_modules(
    app: "FastAPI",
    admin: "Admin",
    ext,
    *,
    registered_router_ids: set,
    license_dependency_factory: object | None,
    patch_admin_license: object | None,
) -> None:
    """Load one extension's modules using the same three-pass pattern."""
    from fastapi import Depends
    from sqlmodel import SQLModel

    pkg = ext.modules_package
    if not pkg:
        return

    # Derive the Python package that contains the module sub-packages.
    # e.g. "iqvigilant.modules" → parent is "iqvigilant.modules",
    # sub-folders are importable as "iqvigilant.modules.{folder}".
    try:
        parent_mod = importlib.import_module(pkg)
    except Exception as exc:
        print(f"  ❌ Extension '{ext.name}': cannot import modules_package '{pkg}': {exc}")
        return

    import pkgutil
    submodule_names = sorted(
        info.name for info in pkgutil.iter_modules(parent_mod.__path__)
    )

    if not submodule_names:
        return

    print(f"\n🔌 Loading extension '{ext.name}' modules ({pkg})…")

    # Pass 0: import all models first so SQLModel.metadata is populated
    # before factory events or create_all run.
    for folder_name in submodule_names:
        dotted = f"{pkg}.{folder_name}.models"
        try:
            importlib.import_module(dotted)
        except Exception:
            pass

    # Inject model classes across the extension's module prefix.
    _inject_model_classes(pkg)

    # Create any tables defined by extension models (idempotent — only
    # creates new tables, never alters existing ones).
    try:
        from veloiq_framework.db import get_engine
        engine = get_engine()
        SQLModel.metadata.create_all(engine)
    except Exception:
        pass  # Engine may not be available in all contexts (e.g. testing)

    # Factory events: call register_*_events() in any submodule factory.py
    for folder_name in submodule_names:
        for fname in ("factory", f"{folder_name}_factory"):
            dotted = f"{pkg}.{folder_name}.{fname}"
            try:
                factory_mod = importlib.import_module(dotted)
                for attr_name in dir(factory_mod):
                    if attr_name.startswith("register_") and attr_name.endswith("_events"):
                        fn = getattr(factory_mod, attr_name)
                        if callable(fn):
                            fn()
                            print(f"  ✅ {ext.name}/{folder_name}.{attr_name}()")
            except ModuleNotFoundError:
                pass
            except Exception as exc:
                print(f"  ❌ {ext.name}/{folder_name}/{fname} factory FAILED: {exc}")

    # Auto-discover the extension's own license dependency factory.
    # Convention: the extension's license module lives at {pkg}.license.license_registry
    # and exposes make_license_dependency(module_name) and LICENSE_EXEMPT_MODULES.
    ext_lic_factory = license_dependency_factory  # caller-provided factory takes precedence
    ext_exempt: frozenset[str] = frozenset()
    if ext_lic_factory is None:
        for candidate in ("license",):
            try:
                lic_reg = importlib.import_module(f"{pkg}.{candidate}.license_registry")
                if callable(getattr(lic_reg, "make_license_dependency", None)):
                    ext_lic_factory = lic_reg.make_license_dependency
                    ext_exempt = getattr(lic_reg, "LICENSE_EXEMPT_MODULES", frozenset())
                    print(f"  🔐 License enforcement: {pkg}.{candidate}.license_registry")
                    break
            except ModuleNotFoundError:
                pass
            except Exception as exc:
                print(f"  ⚠️  Could not load license registry from {pkg}.{candidate}: {exc}")

    # Pass 1: APIs.
    for folder_name in submodule_names:
        exempt = folder_name in ext_exempt
        lic_dep = (
            Depends(ext_lic_factory(folder_name))
            if (ext_lic_factory and not exempt)
            else None
        )
        for sub in ("custom_api", "api"):
            dotted = f"{pkg}.{folder_name}.{sub}"
            try:
                mod = importlib.import_module(dotted)
                if hasattr(mod, "router"):
                    router = mod.router
                    if id(router) in registered_router_ids:
                        continue
                    inc_deps = [lic_dep] if lic_dep is not None else []
                    app.include_router(
                        router,
                        tags=[folder_name.upper()],
                        dependencies=inc_deps,
                    )
                    registered_router_ids.add(id(router))
                    print(f"  ✅ {ext.name}/{folder_name}/{sub}")
            except ModuleNotFoundError as exc:
                if dotted not in str(exc):
                    print(f"  ❌ {ext.name}/{folder_name}/{sub} FAILED: {exc}")
            except Exception as exc:
                print(f"  ❌ {ext.name}/{folder_name}/{sub} CRASHED: {exc}")

    # Pass 1.5: Named queries.
    from veloiq_framework.queries import NamedQuery
    from veloiq_framework.query_crud import create_query_router

    for folder_name in submodule_names:
        dotted = f"{pkg}.{folder_name}.queries"
        try:
            queries_mod = importlib.import_module(dotted)
            for attr_name in dir(queries_mod):
                obj = getattr(queries_mod, attr_name)
                if isinstance(obj, NamedQuery):
                    router = create_query_router(obj)
                    app.include_router(router, tags=[folder_name.upper()])
                    print(f"  ✅ {ext.name}/{obj.name} (named query)")
        except ModuleNotFoundError:
            pass
        except Exception as exc:
            print(f"  ❌ {ext.name}/{folder_name}/queries FAILED: {exc}")

    # Pass 2: Admin views.
    from sqlalchemy.orm import configure_mappers
    from sqladmin import ModelView

    try:
        configure_mappers()
    except Exception:
        pass

    # Auto-discover the extension's admin license patcher if not caller-provided.
    ext_patch_admin = patch_admin_license
    if ext_patch_admin is None:
        try:
            lic_reg = importlib.import_module(f"{pkg}.license.license_registry")
            if callable(getattr(lic_reg, "patch_admin_view_with_license", None)):
                ext_patch_admin = lic_reg.patch_admin_view_with_license
        except (ModuleNotFoundError, Exception):
            pass

    for folder_name in submodule_names:
        exempt = folder_name in ext_exempt
        dotted = f"{pkg}.{folder_name}.admin.admin_views"
        registered_any = False
        try:
            admin_mod = importlib.import_module(dotted)

            for attr_name in dir(admin_mod):
                if attr_name.endswith("_admin_views") and isinstance(
                    getattr(admin_mod, attr_name), list
                ):
                    for view in getattr(admin_mod, attr_name):
                        try:
                            if ext_patch_admin and not exempt:
                                ext_patch_admin(view, folder_name)
                            admin.add_view(view)
                            registered_any = True
                        except Exception:
                            pass

            if not registered_any:
                for attr_name in dir(admin_mod):
                    obj = getattr(admin_mod, attr_name, None)
                    if (
                        isinstance(obj, type)
                        and issubclass(obj, ModelView)
                        and obj is not ModelView
                        and getattr(obj, "model", None) is not None
                    ):
                        try:
                            if ext_patch_admin and not exempt:
                                ext_patch_admin(obj, folder_name)
                            admin.add_view(obj)
                            registered_any = True
                        except Exception:
                            pass

            if registered_any:
                print(f"  ✅ {ext.name}/{folder_name} Admin")

        except ImportError:
            pass
        except Exception as exc:
            print(f"  ⚠️  {ext.name}/{folder_name} Admin Error: {exc}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _path_to_module(path: Path) -> str | None:
    """Convert a filesystem path to a dotted module name using sys.path."""
    path = path.resolve()
    for sys_path in sys.path:
        try:
            rel = path.relative_to(sys_path)
            parts = list(rel.parts)
            if parts[-1].endswith(".py"):
                parts[-1] = parts[-1][:-3]
            return ".".join(parts)
        except ValueError:
            continue
    return None


def _dir_to_module_prefix(modules_dir: Path) -> str:
    """Convert a modules directory path to a dotted prefix like ``app.modules``."""
    modules_dir = modules_dir.resolve()
    for sys_path_str in sys.path:
        try:
            rel = modules_dir.relative_to(sys_path_str)
            return ".".join(rel.parts)
        except ValueError:
            continue
    # Fallback: use parent directory name + "modules"
    return f"{modules_dir.parent.name}.{modules_dir.name}"

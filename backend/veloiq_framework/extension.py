"""VeloIQ extension manifest contract.

Extension packages declare themselves to the framework by:

1. Subclassing ``VeloIQExtension`` and filling in the class-level attributes.
2. Pointing to the subclass via a ``veloiq.extensions`` entry point in their
   ``pyproject.toml``::

       [project.entry-points."veloiq.extensions"]
       iqvigilant = "iqvigilant.manifest:ExtensionManifest"

The framework discovers all installed extensions at app startup by scanning
that entry point group.  The host app needs no changes — installing and
generating is enough.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Optional


class VeloIQExtension:
    """Base class / contract for VeloIQ extension manifests.

    Subclass this in your extension package and override the class attributes.
    All path fields (``static_dir``, ``frontend_pages_dir``) are relative to
    the installed Python package directory (i.e. the directory that contains
    your ``__init__.py``).

    Example::

        from veloiq_framework import VeloIQExtension

        class ExtensionManifest(VeloIQExtension):
            name = "iqvigilant"
            version = "1.0.0"
            modules_package = "iqvigilant.modules"
            static_dir = "static"
            frontend_pages_dir = "frontend/pages"
    """

    # ── Required ──────────────────────────────────────────────────────────────

    #: Short identifier used in URL paths and log messages (e.g. "iqvigilant").
    name: str = ""

    #: Dotted Python package path that contains the extension's modules
    #: (e.g. "iqvigilant.modules").  The loader will scan this package the
    #: same way it scans the host app's ``app/modules/``.
    modules_package: str = ""

    # ── Optional ──────────────────────────────────────────────────────────────

    #: Human-readable version string.
    version: str = "0.1.0"

    #: Path *relative to the installed package directory* where pre-built JS
    #: bundles for custom UX live (e.g. "static").  Mounted by the framework
    #: at ``/ext/{name}/``.  Leave ``None`` if the extension has no custom UI.
    static_dir: Optional[str] = None

    #: Path *relative to the installed package directory* where the
    #: extension's ``frontend/src/pages/`` schema files are stored as package
    #: data (e.g. "frontend/pages").  ``veloiq generate`` copies these into
    #: the host app's ``frontend/src/pages/`` directory.
    #: Leave ``None`` if the extension ships no schema files.
    frontend_pages_dir: Optional[str] = None

    #: Path *relative to the installed package directory* where the extension's
    #: React page components (``.tsx``) are stored as package data
    #: (e.g. "frontend/components").  ``veloiq generate`` copies these into the
    #: host app's ``frontend/src/pages/{name}/`` directory so the routes declared
    #: in :attr:`routes` can import them.  Leave ``None`` if the extension ships
    #: no page components.
    frontend_components_dir: Optional[str] = None

    #: Routes contributed to the host app's router.  Each entry is a dict::
    #:
    #:     {
    #:         "path": "/iqvigilant-license",     # URL path
    #:         "component": "LicenseManagement",  # import name used in the route
    #:         "source": "LicenseManagement.tsx", # file under frontend_components_dir
    #:         "export": "default",               # "default" or a named export
    #:     }
    #:
    #: ``veloiq generate`` turns these into ready-to-mount ``element`` entries in
    #: the generated ``extensions.gen.tsx``.
    routes: list = []

    #: Items added to the host app's user dropdown menu.  Each entry is a dict::
    #:
    #:     {
    #:         "key": "iqvigilant-license",       # unique key
    #:         "label": "IQVigilant Licensing",   # menu label
    #:         "icon": "KeyOutlined",             # Ant Design icon component name
    #:         "route": "/iqvigilant-license",    # path navigated to on click
    #:     }
    user_menu_items: list = []

    #: Per-resource Show-page overrides.  Each entry replaces the host app's
    #: default ``DynamicShow`` for one resource with a custom component::
    #:
    #:     {
    #:         "resource": "cw_nlchat",        # Refine resource name (= model.resource)
    #:         "component": "NLChatShow",      # import name used internally
    #:         "source": "NLChatShow.tsx",     # file under frontend_components_dir
    #:         "export": "NLChatShow",         # "default" or a named export
    #:     }
    #:
    #: ``veloiq generate`` emits these as an ``extensionShowComponents`` map in
    #: ``extensions.gen.tsx`` keyed by resource; the host App.tsx renders the
    #: mapped component at ``/{resource}/show/:id`` instead of ``DynamicShow``.
    show_overrides: list = []

    # ── Path resolution helpers ───────────────────────────────────────────────

    def package_dir(self) -> Path:
        """Return the absolute path to the installed Python package directory.

        Derived from the top-level package in ``modules_package``
        (e.g. "iqvigilant" from "iqvigilant.modules").
        """
        top_pkg = self.modules_package.split(".")[0] if self.modules_package else self.name
        spec = importlib.util.find_spec(top_pkg)
        if spec is None or spec.origin is None:
            raise RuntimeError(
                f"Cannot locate package '{top_pkg}' for extension '{self.name}'. "
                "Make sure the extension is properly installed."
            )
        return Path(spec.origin).parent

    def resolved_static_dir(self) -> Optional[Path]:
        """Return the absolute path to the static bundles directory, or None."""
        if not self.static_dir:
            return None
        p = self.package_dir() / self.static_dir
        return p if p.exists() else None

    def resolved_frontend_pages_dir(self) -> Optional[Path]:
        """Return the absolute path to the frontend pages directory, or None."""
        if not self.frontend_pages_dir:
            return None
        p = self.package_dir() / self.frontend_pages_dir
        return p if p.exists() else None

    def resolved_frontend_components_dir(self) -> Optional[Path]:
        """Return the absolute path to the frontend components directory, or None."""
        if not self.frontend_components_dir:
            return None
        p = self.package_dir() / self.frontend_components_dir
        return p if p.exists() else None

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(self) -> None:
        """Raise ``ValueError`` if required fields are missing."""
        if not self.name:
            raise ValueError(f"{self.__class__.__name__}: 'name' is required.")
        if not self.modules_package:
            raise ValueError(
                f"Extension '{self.name}': 'modules_package' is required."
            )

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r} version={self.version!r}>"

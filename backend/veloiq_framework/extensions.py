"""Extension discovery via Python entry points.

Scans the ``veloiq.extensions`` entry point group and returns a list of
instantiated :class:`~veloiq_framework.extension.VeloIQExtension` manifests
for every installed extension package.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from veloiq_framework.extension import VeloIQExtension


def discover_extensions() -> list["VeloIQExtension"]:
    """Return all installed VeloIQ extensions in entry-point declaration order.

    Each extension must declare a ``veloiq.extensions`` entry point in its
    ``pyproject.toml`` pointing to a :class:`VeloIQExtension` subclass::

        [project.entry-points."veloiq.extensions"]
        vigilantiq = "vigilantiq.manifest:ExtensionManifest"

    The entry point value may be either:
    - A class (subclass of ``VeloIQExtension``) — instantiated with no args.
    - An already-instantiated object — used as-is.

    Failed loads are logged and skipped so one broken extension does not
    prevent the entire app from starting.
    """
    from importlib.metadata import entry_points

    eps = entry_points(group="veloiq.extensions")
    extensions: list[VeloIQExtension] = []

    for ep in eps:
        try:
            obj = ep.load()
            # Support both class-based and instance-based manifests.
            if isinstance(obj, type):
                manifest = obj()
            else:
                manifest = obj
            manifest.validate()
            extensions.append(manifest)
            print(f"  🔌 Extension loaded: {manifest.name} v{manifest.version}")
        except Exception as exc:
            print(f"  ❌ Extension '{ep.name}' failed to load: {exc}")

    return extensions

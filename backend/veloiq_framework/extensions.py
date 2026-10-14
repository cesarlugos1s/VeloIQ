"""Extension discovery via Python entry points.

Scans the ``veloiq.extensions`` entry point group and returns a list of
instantiated :class:`~veloiq_framework.extension.VeloIQExtension` manifests
for every installed extension package.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from veloiq_framework.extension import VeloIQExtension


def discover_extensions(
    enabled: list[str] | None = None,
    quiet: bool = False,
) -> list["VeloIQExtension"]:
    """Return installed VeloIQ extensions in entry-point declaration order.

    Each extension must declare a ``veloiq.extensions`` entry point in its
    ``pyproject.toml`` pointing to a :class:`VeloIQExtension` subclass::

        [project.entry-points."veloiq.extensions"]
        iqvigilant = "iqvigilant.manifest:ExtensionManifest"

    The entry point value may be either:
    - A class (subclass of ``VeloIQExtension``) — instantiated with no args.
    - An already-instantiated object — used as-is.

    Parameters
    ----------
    enabled:
        Per-app allowlist of extension (entry-point) names to load. Only
        extensions whose name appears here are returned; the rest are skipped.
        ``None`` means *no filtering* (load every installed extension) and is
        kept for back-compatible direct calls. Callers that want the strict,
        opt-in behaviour pass the resolved list (possibly empty) from
        :func:`veloiq_framework.extension_registry.read_enabled_extensions`.

    quiet:
        When True, don't print a line for each extension loaded (failed loads
        are still reported). Used by lookups outside app startup, such as
        ``jm_obtain_config()`` resolving the extensions' packaged config.

    Failed loads are logged and skipped so one broken extension does not
    prevent the entire app from starting.
    """
    from importlib.metadata import entry_points

    eps = entry_points(group="veloiq.extensions")
    extensions: list[VeloIQExtension] = []

    for ep in eps:
        if enabled is not None and ep.name not in enabled:
            continue
        try:
            obj = ep.load()
            # Support both class-based and instance-based manifests.
            if isinstance(obj, type):
                manifest = obj()
            else:
                manifest = obj
            manifest.validate()
            extensions.append(manifest)
            if not quiet:
                print(f"  🔌 Extension loaded: {manifest.name} v{manifest.version}")
        except Exception as exc:
            print(f"  ❌ Extension '{ep.name}' failed to load: {exc}")

    return extensions


def order_extensions(
    extensions: list["VeloIQExtension"],
    enabled: list[str] | None,
) -> list["VeloIQExtension"]:
    """Return *extensions* in the order the app enables them.

    Layered resources (translation catalogs, packaged ``jm_config.ini``) are
    applied in this order, so a later-enabled extension's values take
    precedence over an earlier one's. Extensions not named in *enabled* keep
    their discovery order, after the named ones.

    :param extensions: The discovered extensions.
    :param enabled: The app's enabled-extension names, in ``veloiq.toml`` order.
    :return: The extensions, sorted by their position in *enabled*.
    """
    enabled_order = list(enabled or [])
    return sorted(
        extensions,
        key=lambda ext: enabled_order.index(ext.name) if ext.name in enabled_order else len(enabled_order),
    )

"""Contribution registry for the System Configuration Console.

VeloIQ owns the console. VeloIQ registers its own baseline entries (see
``baseline.py``) and any installed extension or app module can add more by
defining ``register_system_config()`` in its own ``factory.py`` — auto-discovered
at startup by ``veloiq_framework.loader``'s factory-scanning pass (the same
generic discovery used for ``register_*_events()`` and
``register_import_loaders()``). Import ``register_system_config`` from
``veloiq_framework.system_config``.
"""
from __future__ import annotations

_REGISTRY: dict[str, dict] = {}


def register_system_config(entries: list[dict]) -> None:
    """Add config-item entries to the System Configuration Console's key list.

    Each entry follows the console's existing shape: ``key``, ``type``
    (``"int"`` / ``"bool"`` / ``"string"`` / ``"color"``), ``source``
    (``"ini"`` or ``"toml"``), ``card`` (which section of the console the
    item renders under), ``label``, ``tooltip``, and optionally ``options``
    (a fixed list of choices) and ``default`` (used when a toml-sourced key
    isn't yet present in the project's ``veloiq.toml``). ``source: "ini"``
    entries also need a ``section`` (the ``jm_config.ini`` section name).

    Duplicate keys are rejected (first registration wins, with a warning) —
    two modules claiming the same config key is almost certainly a mistake.
    """
    for entry in entries:
        key = entry["key"]
        if key in _REGISTRY:
            print(f"  ⚠️  system_config.registry: duplicate key '{key}' — keeping first registration")
            continue
        _REGISTRY[key] = entry


def get_system_config_keys() -> list[dict]:
    """Return every registered config-item entry."""
    return list(_REGISTRY.values())

"""Endpoint types that an extension package adds to the registry (a messaging broker, for one), beside the types the framework has.

An extension registers a type with the fields of its settings, an optional check of the whole settings and the secrets it uses. A connection of such a type
keeps its settings as one JSON object (the framework's pages show them as one JSON field), checked against the definition: no field it does not name, the
required ones present, each value of its type and of its allowed choices. A connection test is registered with ``register_connection_tester`` as for any type.
Credentials are never settings: they are secrets of the connection, written and read as for every connection.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from veloiq_framework.utils.i18n_utils import _

SETTING_TYPES = ("text", "number", "boolean", "choice")
_BOOLEAN_TEXTS = {"true": True, "false": False}


class ExtensionEndpointTypeError(ValueError):
    """An extension registered a type the registry cannot accept, or a connection's settings do not fit the type; the message says why."""


@dataclass(frozen=True)
class ExtensionSettingField:
    """One setting of an extension endpoint type."""
    name: str
    label: str = ""
    type: str = "text"
    required: bool = False
    choices: tuple[str, ...] = ()
    default: Any = None
    description: str = ""


@dataclass(frozen=True)
class ExtensionEndpointType:
    """An endpoint type of an extension package: its name, the fields of its settings and an optional check of the whole settings.

    :param check_settings: Called with the settings after the per-field checks; raises :class:`ExtensionEndpointTypeError` to refuse them.
    """
    name: str
    label: str
    settings_fields: tuple[ExtensionSettingField, ...] = ()
    check_settings: Optional[Callable[[dict[str, Any]], None]] = None
    secret_keys: tuple[str, ...] = field(default_factory=tuple)


_registered_types: dict[str, ExtensionEndpointType] = {}


def register_extension_endpoint_type(definition: ExtensionEndpointType, base_endpoint_types: Optional[tuple[str, ...]] = None) -> None:
    """Register an endpoint type.

    :param base_endpoint_types: The types the framework has (by default its own list); an extension's type may not reuse one.
    :raises ExtensionEndpointTypeError: When the name is empty, reused, or a setting is malformed.
    """
    from .registry_choice_values import ENDPOINT_TYPES

    base_endpoint_types = ENDPOINT_TYPES if base_endpoint_types is None else base_endpoint_types
    if not definition.name or not definition.name.replace("_", "").isalnum() or definition.name != definition.name.lower():
        raise ExtensionEndpointTypeError(_("The name of an endpoint type is lowercase letters, digits and underscores."))
    if definition.name in base_endpoint_types or definition.name in _registered_types:
        raise ExtensionEndpointTypeError(_("The endpoint type {name} already exists.").format(name=definition.name))
    seen: set[str] = set()
    for setting in definition.settings_fields:
        if setting.type not in SETTING_TYPES or not setting.name or setting.name in seen or (setting.type == "choice" and not setting.choices):
            raise ExtensionEndpointTypeError(_("The setting {name} of the endpoint type {type} is not valid.").format(name=setting.name, type=definition.name))
        seen.add(setting.name)
    _registered_types[definition.name] = definition


def find_extension_endpoint_type(name: str) -> Optional[ExtensionEndpointType]:
    """The extension type with that name, or None."""
    return _registered_types.get(name)


def list_extension_endpoint_types() -> list[ExtensionEndpointType]:
    """Every registered extension type, in the order registered."""
    return list(_registered_types.values())


def remove_all_extension_endpoint_types() -> None:
    """Forget every registration; used by tests."""
    _registered_types.clear()


def _convert(setting: ExtensionSettingField, value: Any, type_name: str) -> Any:
    """A setting's value in its type; text from a page ('5', 'true') is read as the number or the truth value it says."""
    try:
        if setting.type == "number":
            if isinstance(value, bool):
                raise ValueError
            return int(value) if float(value) == int(float(value)) else float(value)
        if setting.type == "boolean":
            if isinstance(value, bool):
                return value
            return _BOOLEAN_TEXTS[str(value).strip().lower()]
        text = str(value)
        if setting.type == "choice" and text not in setting.choices:
            raise ExtensionEndpointTypeError(_("The setting {name} of {type} is one of {choices}.").format(name=setting.name, type=type_name, choices=", ".join(setting.choices)))
        return text
    except ExtensionEndpointTypeError:
        raise
    except (ValueError, KeyError, TypeError) as invalid:
        raise ExtensionEndpointTypeError(_("The setting {name} of {type} is a {kind}.").format(name=setting.name, type=type_name, kind=_(setting.type))) from invalid


def check_extension_settings(definition: ExtensionEndpointType, values: Any) -> dict[str, Any]:
    """The settings of a connection of the type, checked and with the defaults filled in.

    :raises ExtensionEndpointTypeError: When a setting is unknown, a required one is missing, a value is not of its type or choices, or the type's own check refuses them.
    """
    if isinstance(values, str):
        try:
            values = json.loads(values) if values.strip() else {}
        except ValueError as unreadable:
            raise ExtensionEndpointTypeError(_("The settings are not valid JSON.")) from unreadable
    if values is None:
        values = {}
    if not isinstance(values, dict):
        raise ExtensionEndpointTypeError(_("The settings are a JSON object."))
    known = {setting.name: setting for setting in definition.settings_fields}
    unknown = sorted(set(values) - set(known))
    if unknown:
        raise ExtensionEndpointTypeError(_("Unknown setting of {type}: {name}.").format(type=definition.name, name=unknown[0]))
    checked: dict[str, Any] = {}
    for name, setting in known.items():
        value = values.get(name)
        if value in (None, ""):
            value = setting.default
        if value in (None, ""):
            if setting.required:
                raise ExtensionEndpointTypeError(_("The setting {name} of {type} is required.").format(name=name, type=definition.name))
            continue
        checked[name] = _convert(setting, value, definition.name)
    if definition.check_settings is not None:
        definition.check_settings(checked)
    return checked

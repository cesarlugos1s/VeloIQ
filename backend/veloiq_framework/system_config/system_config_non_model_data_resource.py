"""The System Configuration settings as a single-record non-model data resource.

The settings are one record (``/api/veloiq_system_config/1``) with one field per
registered setting (see ``system_config_settings_registry.py``), so the console
is the standard "primary" view of that record: the record's show/edit form,
with each setting edited by the standard editor of its field type (number,
switch, color, pick-list). The form's layout (sections and related settings
side by side, like the former console) is the page configuration
``veloiq_system_config:show`` in VeloIQ's own ``page_configs.json``. Fields are
built from the registry for every request, so a setting an extension registers
appears without any schema change (in the extension's own section of its
``page_configs.json``, or else in a trailing "Other settings" section).

Values are read and written exactly as ``GET``/``PUT /api/system-config`` do
(``config/jm_config.ini`` and the ``[views]`` table of ``veloiq.toml``), so
existing installations need no migration. Only the settings a save changes are
written.
"""
from __future__ import annotations

from typing import Any

from veloiq_framework.utils.i18n_utils import _
from veloiq_framework.non_model_data_resources import (
    DataSourceRequestContext,
    NonModelDataField,
    NonModelDataResource,
    PythonFunctionsDataSource,
)

from .system_config_settings_registry import get_system_config_keys
from .read_write_system_config_files import read_system_config_items, require_configure_layout, save_system_config_updates

#: Name of the resource (endpoint ``/api/veloiq_system_config``).
SYSTEM_CONFIG_RESOURCE_NAME = "veloiq_system_config"

#: Key field and value of the one System Configuration record.
SYSTEM_CONFIG_RECORD_KEY_FIELD = "id"
SYSTEM_CONFIG_RECORD_ID = 1

#: Field type options of each registry ``type`` code; codes not listed are text.
_FIELD_OPTIONS_BY_REGISTRY_TYPE: dict[str, dict[str, Any]] = {
    "int": {"type": "number", "integer": True},
    "bool": {"type": "boolean"},
    # Only the editor: a read-only-* show view type would make the field read-only in the record form.
    "color": {"type": "string", "edit_view_type": "editable-color"},
}


def _build_system_config_setting_fields() -> list[NonModelDataField]:
    """Return one field per registered setting, typed by its registry ``type``."""
    fields = []
    for entry in get_system_config_keys():
        field_options = dict(_FIELD_OPTIONS_BY_REGISTRY_TYPE.get(entry.get("type") or "", {}))
        # A color setting's options are presets offered next to free input (as in
        # the former console), not a restriction, so only other types get them.
        if entry.get("options") and entry.get("type") != "color":
            field_options["options"] = list(entry["options"])
        fields.append(NonModelDataField(
            key=entry["key"],
            label=entry.get("label") or entry["key"],
            description=entry.get("tooltip") or "",
            **field_options,
        ))
    return fields


def _setting_value_as_its_type(entry: dict) -> Any:
    """Return a setting's current value (text in the files) as its type."""
    raw = entry.get("value")
    text = "" if raw is None else str(raw).strip()
    if entry.get("type") == "bool":
        return text.lower() == "true" if text else None
    if entry.get("type") == "int":
        try:
            return int(float(text)) if text else None
        except ValueError:
            return text
    return text


def _load_system_config_record(request_context: DataSourceRequestContext) -> list[dict]:
    """Return the one System Configuration record: every setting's current value."""
    record: dict[str, Any] = {SYSTEM_CONFIG_RECORD_KEY_FIELD: SYSTEM_CONFIG_RECORD_ID}
    for entry in read_system_config_items():
        record[entry["key"]] = _setting_value_as_its_type(entry)
    return [record]


def _setting_value_as_file_text(value: Any) -> str:
    """Return a value as the text the console writes to the files (``true``/``false``, ``42``)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _save_system_config_record(request_context: DataSourceRequestContext, eid: str, record: dict) -> dict:
    """Write the settings whose value the save changed, and return the record."""
    current = _load_system_config_record(request_context)[0]
    changed = {
        key: _setting_value_as_file_text(value)
        for key, value in record.items()
        if key != SYSTEM_CONFIG_RECORD_KEY_FIELD and value != current.get(key)
    }
    if changed:
        save_system_config_updates(changed)
    return record


def _require_configure_layout_permission(request: Any, action: str) -> None:
    """Allow only roles with the CONFIGURE_LAYOUT permission, as the console's endpoints do."""
    require_configure_layout(request)


def build_system_config_non_model_data_resource() -> NonModelDataResource:
    """Return the System Configuration non-model data resource."""
    return NonModelDataResource(
        name=SYSTEM_CONFIG_RESOURCE_NAME,
        label="System Configuration",
        description="Application-wide settings for logging, appearance and view defaults.",
        pk_fields=[SYSTEM_CONFIG_RECORD_KEY_FIELD],
        fields=[NonModelDataField(key=SYSTEM_CONFIG_RECORD_KEY_FIELD, label="ID", type="number", read_only=True)],
        build_fields_function=_build_system_config_setting_fields,
        single_record=True,
        list_view_type="primary",
        data_source=PythonFunctionsDataSource(_load_system_config_record,
                                              update_row_function=_save_system_config_record),
        access_check=_require_configure_layout_permission,
    )

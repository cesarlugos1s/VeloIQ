"""Validation of the rows written to a non-model data resource.

Every create and update builds the row as it would be saved (the existing row,
or the field defaults, with the payload's values on top), converts each value
to its field's type and checks it against the declared fields: required
values, allowed options, key fields and the resource's own ``validate_row``
rule. Invalid rows are rejected with translated messages, one per problem.
"""
from __future__ import annotations

import datetime as _dt
from typing import Any, Optional

from veloiq_framework.utils.i18n_utils import _

from .non_model_data_resource_definitions import NON_MODEL_DATA_FIELD_TYPES, NonModelDataField, NonModelDataResource
from .encode_decode_row_eid import RowEidEncodingError, encode_eid, row_key_value_as_text
from .filter_sort_page_rows import _BOOLEAN_QUERY_TEXT_VALUES

#: Payload keys that are never row fields (the row address and its revision).
_ROW_ADDRESS_PAYLOAD_KEYS = ("eid", "id")


def _translated_field_label(field: NonModelDataField) -> str:
    """Return the field's label in the request's language."""
    return _(field.label)


def field_type_for_row(field: NonModelDataField, row: dict) -> str:
    """Return the field's type for *row*: the row's own type when ``type_from_field`` names one."""
    if field.type_from_field:
        row_type = row_key_value_as_text(row.get(field.type_from_field))
        return row_type if row_type in NON_MODEL_DATA_FIELD_TYPES else "string"
    return field.type


def allowed_field_values_for_row(field: NonModelDataField, row: dict) -> list:
    """Return the values the field accepts for *row* (empty when any value is accepted)."""
    if field.options_from_field:
        options = row.get(field.options_from_field)
        if isinstance(options, list):
            return [option.get("value") if isinstance(option, dict) else option for option in options]
        return []
    return field.option_values()


def _convert_value_to_field_type(field: NonModelDataField, field_type: str, value: Any) -> tuple[Any, Optional[str]]:
    """Return ``(value as the field type, error message or None)``."""
    if value is None or (isinstance(value, str) and value.strip() == "" and field_type != "string"):
        return None, None
    label = _translated_field_label(field)
    if field_type == "number":
        if isinstance(value, bool):
            return value, _("{field}: a number is expected.").format(field=label)
        try:
            number = value if isinstance(value, (int, float)) else float(str(value).strip())
        except ValueError:
            return value, _("{field}: a number is expected.").format(field=label)
        if field.integer:
            if float(number) != int(float(number)):
                return value, _("{field}: a whole number is expected.").format(field=label)
            return int(float(number)), None
        return number, None
    if field_type == "boolean":
        if isinstance(value, bool):
            return value, None
        converted = _BOOLEAN_QUERY_TEXT_VALUES.get(row_key_value_as_text(value).strip().lower())
        if converted is None:
            return value, _("{field}: true or false is expected.").format(field=label)
        return converted, None
    if field_type in ("date", "datetime", "time"):
        text = row_key_value_as_text(value).strip().replace("Z", "+00:00")
        try:
            if field_type == "date":
                return _dt.date.fromisoformat(text[:10]).isoformat(), None
            if field_type == "datetime":
                return _dt.datetime.fromisoformat(text).isoformat(), None
            return _dt.time.fromisoformat(text).isoformat(), None
        except ValueError:
            messages = {
                "date": _("{field}: a date is expected."),
                "datetime": _("{field}: a date and time is expected."),
                "time": _("{field}: a time is expected."),
            }
            return value, messages[field_type].format(field=label)
    return (value if isinstance(value, str) else row_key_value_as_text(value)), None


def _roles_may_write_field(field: NonModelDataField, user_roles: list[str]) -> bool:
    """True when the user's roles may write the field (``write_roles`` unset = every role)."""
    return field.write_roles is None or bool(set(field.write_roles) & set(user_roles))


def build_validated_row(data_resource: NonModelDataResource, payload: dict, existing: Optional[dict], other_rows: list[dict],
              user_roles: list[str]) -> tuple[dict, list[str]]:
    """Return ``(row as it would be saved, error messages)`` for a create or an update.

    :param payload: The request body. Unknown keys, read-only fields, fields the
        user's roles may not write and (on update) key fields are ignored.
    :param existing: The current row for an update, ``None`` for a create.
    :param other_rows: Every other row of the resource (for the key uniqueness check).
    """
    creating = existing is None
    if creating:
        row = {f.key: f.default for f in data_resource.fields if f.default is not None}
    else:
        row = {key: value for key, value in existing.items() if key not in ("eid", "id", "_revision")}

    # Only the values this request sets are converted and checked; the rest of
    # the row is kept as stored (e.g. a read-only list of allowed values).
    written: set[str] = set(row) if creating else set()
    for key, value in payload.items():
        if key in _ROW_ADDRESS_PAYLOAD_KEYS or key.startswith("_"):
            continue
        field = data_resource.get_field_by_key(key)
        if field is None or field.read_only or not _roles_may_write_field(field, user_roles):
            continue
        if not creating and key in data_resource.pk_fields:
            continue
        row[key] = value
        written.add(key)

    errors: list[str] = []
    # Fields whose type comes from another field are converted after it.
    ordered = sorted(data_resource.fields, key=lambda f: 1 if f.type_from_field else 0)
    for field in ordered:
        if field.key not in written:
            continue
        converted, error = _convert_value_to_field_type(field, field_type_for_row(field, row), row[field.key])
        if error:
            errors.append(error)
            continue
        row[field.key] = converted
        allowed = allowed_field_values_for_row(field, row)
        if allowed and converted is not None and row_key_value_as_text(converted) not in {row_key_value_as_text(v) for v in allowed}:
            errors.append(_("{field}: the value is not one of the allowed values.").format(field=_translated_field_label(field)))

    for field in data_resource.fields:
        must_have = field.required or (creating and field.key in data_resource.pk_fields)
        if must_have and not field.read_only and (row.get(field.key) is None or row.get(field.key) == ""):
            errors.append(_("{field}: a value is required.").format(field=_translated_field_label(field)))

    if creating and not errors:
        try:
            eid = encode_eid([row.get(key) for key in data_resource.pk_fields])
        except RowEidEncodingError:
            errors.append(_("A row with this key can't be saved."))
        else:
            other_eids = set()
            for other in other_rows:
                try:
                    other_eids.add(encode_eid([other.get(key) for key in data_resource.pk_fields]))
                except RowEidEncodingError:
                    continue
            if eid in other_eids:
                errors.append(_("A row with this key already exists."))

    if not errors and data_resource.validate_row is not None:
        errors.extend(data_resource.validate_row(row, other_rows) or [])
    return row, errors

"""Single-value ``eid`` of a non-model data resource row, for one-field and composite keys.

The UI and the REST paths address a row by one value (``ModelDef.pkField`` and
``GET /{id}``). A row whose primary key is made of several fields gets an
``eid`` built from the key values in ``pk_fields`` order, joined with
:data:`COMPOSITE_EID_SEPARATOR`. Inside a value, the separator and :data:`COMPOSITE_EID_ESCAPE`
itself are preceded by :data:`COMPOSITE_EID_ESCAPE`, so the encoding is reversible::

    ("EMEA", "A12")   -> "EMEA~A12"
    ("a~b", "c")      -> "a!~b~c"
    ("a!", "c")       -> "a!!~c"

Both characters are left as they are by URL encoding (``encodeURIComponent``),
so an ``eid`` reads the same in a path. A one-field key is used as it is.
"""
from __future__ import annotations

from typing import Any, Sequence

#: Joins the key values of a composite key.
COMPOSITE_EID_SEPARATOR = "~"
#: Precedes a separator or an escape character that is part of a key value.
COMPOSITE_EID_ESCAPE = "!"


class RowEidEncodingError(ValueError):
    """The ``eid`` can't be built from, or split into, the row's key values."""


def row_key_value_as_text(value: Any) -> str:
    """Return the text a key value takes inside an ``eid`` (``1.0`` -> ``"1"``)."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def encode_eid(key_values: Sequence[Any]) -> str:
    """Return the ``eid`` of a row from its key values, in ``pk_fields`` order.

    :param key_values: One value per key field.
    :raises RowEidEncodingError: When there is no value, or a value is empty.
    """
    if not key_values:
        raise RowEidEncodingError("a row key needs at least one value")
    parts = [row_key_value_as_text(value) for value in key_values]
    if any(part == "" for part in parts):
        raise RowEidEncodingError("a part of the row key is empty")
    if len(parts) == 1:
        return parts[0]
    return COMPOSITE_EID_SEPARATOR.join(
        part.replace(COMPOSITE_EID_ESCAPE, COMPOSITE_EID_ESCAPE * 2).replace(COMPOSITE_EID_SEPARATOR, COMPOSITE_EID_ESCAPE + COMPOSITE_EID_SEPARATOR)
        for part in parts
    )


def decode_eid(eid: Any, part_count: int) -> list[str]:
    """Split an ``eid`` back into its key values (as text), in ``pk_fields`` order.

    :param eid: The ``eid`` from a path or a payload.
    :param part_count: The number of key fields of the resource.
    :raises RowEidEncodingError: When the ``eid`` doesn't hold exactly ``part_count`` non-empty values.
    """
    text = row_key_value_as_text(eid)
    if part_count <= 1:
        if text == "":
            raise RowEidEncodingError("the row key is empty")
        return [text]
    parts: list[str] = []
    current: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char == COMPOSITE_EID_ESCAPE and index + 1 < len(text):
            current.append(text[index + 1])
            index += 2
            continue
        if char == COMPOSITE_EID_SEPARATOR:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1
    parts.append("".join(current))
    if len(parts) != part_count or any(part == "" for part in parts):
        raise RowEidEncodingError(f"expected {part_count} key values in '{text}'")
    return parts

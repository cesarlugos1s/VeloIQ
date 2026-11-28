"""Find a value or a list of records in the parsed answer of an operation, by a dotted path (``data.items``)."""
from __future__ import annotations

from typing import Any

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_store import RegistryRuleError


def read_at_path(value: Any, dotted_path: str) -> Any:
    """The value at a dotted path of a parsed answer (``data.items``), or None when it is not there."""
    current = value
    for part in [part for part in (dotted_path or "").split(".") if part]:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def extract_records(parsed_answer: Any, records_path: str) -> list[Any]:
    """The list of records an answer holds: the answer itself, or the value at ``records_path``.

    :raises RegistryRuleError: When the key is not there or the value is not a list.
    """
    found = parsed_answer
    for part in [part for part in (records_path or "").split(".") if part]:
        if not isinstance(found, dict) or part not in found:
            raise RegistryRuleError(_("The answer has no key {key} for the list of records.").format(key=records_path))
        found = found[part]
    if not isinstance(found, list):
        raise RegistryRuleError(_("The answer is not a list; name the key that holds the list of records."))
    return found

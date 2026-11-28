"""Who uses an item of the registry: the other packages say, so the registry can refuse to delete an item that is in use.

The registry does not know the Integration Hub or its flows. A package that uses connections or operations registers a check, a
function that is given the kind and the identifier of an item and answers the names of what uses it (the flows). The registry asks every
check before it deletes a connection or an operation, and refuses with a message that names them.
"""
from __future__ import annotations

from typing import Callable

from veloiq_framework.utils.i18n_utils import _

ItemInUseCheck = Callable[[str, int], list[str]]
_registered_checks: list[ItemInUseCheck] = []


def register_item_in_use_check(check: ItemInUseCheck) -> None:
    """Add a check: ``(item_kind, item_id) -> names of what uses the item``. Registering the same function twice has no effect."""
    if check not in _registered_checks:
        _registered_checks.append(check)


def remove_registered_item_in_use_checks() -> None:
    """Forget every check (for tests)."""
    _registered_checks.clear()


def names_of_what_uses_the_item(item_kind: str, item_id: int) -> list[str]:
    """The names that every registered check gives for an item, without repeats and in order."""
    names: list[str] = []
    for check in _registered_checks:
        for name in check(item_kind, item_id):
            if name not in names:
                names.append(name)
    return names


# spec: manage-connections-with-secrets-and-a-connection-test :: An item in use is not deleted
def ensure_item_is_not_in_use(item_kind: str, item_id: int, item_name: str):
    """Raise ``RegistryRuleError`` naming the flows that use the item, when any does."""
    names = names_of_what_uses_the_item(item_kind, item_id)
    if names:
        from .connection_registry_store import RegistryRuleError
        raise RegistryRuleError(_("{item} is used by: {users}. Remove it from them first.").format(item=item_name, users=", ".join(names)))

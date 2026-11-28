"""Connection tests that a package supplies for an endpoint type the registry cannot test itself (the hub tests file and SFTP connections).

A tester is a function that takes the connection and returns the result in the shape the connection test window shows (see
``test_rest_connection``). It may raise ``RegistryRuleError`` with a message for the administrator.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from .connection_registry_models import Connection

ConnectionTester = Callable[[Connection], dict[str, Any]]

_registered_connection_testers: dict[str, ConnectionTester] = {}


def register_connection_tester(endpoint_type: str, tester: ConnectionTester) -> None:
    """Register the test of an endpoint type; a later registration for the same type replaces the earlier one."""
    _registered_connection_testers[endpoint_type] = tester


def find_connection_tester(endpoint_type: str) -> Optional[ConnectionTester]:
    """The registered test of an endpoint type; None when no package supplies one."""
    return _registered_connection_testers.get(endpoint_type)


def remove_registered_connection_testers() -> None:
    """Forget every registered test (for tests)."""
    _registered_connection_testers.clear()

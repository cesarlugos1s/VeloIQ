"""Read the operations of an OpenAPI description (3.x or Swagger 2), given as text, a file's content or an address."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

import yaml

from veloiq_framework.utils.i18n_utils import _

HTTP_METHODS = ("get", "post", "put", "patch", "delete")
MAXIMUM_REFERENCE_DEPTH = 6
OPENAPI_FETCH_TIMEOUT_SECONDS = 20


class OpenApiDescriptionError(Exception):
    """The description could not be read; the message says why and is meant for the administrator."""


def fetch_openapi_description(address: str) -> str:
    """Download a description from an address.

    :raises OpenApiDescriptionError: When the address cannot be reached (the feature needs access to it).
    """
    try:
        with urllib.request.urlopen(address, timeout=OPENAPI_FETCH_TIMEOUT_SECONDS) as response:  # noqa: S310 (address given by an administrator)
            return response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError, ValueError, UnicodeDecodeError) as unreachable:
        raise OpenApiDescriptionError(_(
            "The address {address} cannot be reached. Reading it needs access to that address; supply the description as a file instead."
        ).format(address=address)) from unreachable


def _load_description(content: str) -> dict[str, Any]:
    try:
        loaded = json.loads(content)
    except ValueError:
        try:
            loaded = yaml.safe_load(content)
        except yaml.YAMLError as invalid_yaml:
            raise OpenApiDescriptionError(_("The content is neither JSON nor YAML.")) from invalid_yaml
    if not isinstance(loaded, dict) or not isinstance(loaded.get("paths"), dict) or not ("openapi" in loaded or "swagger" in loaded):
        raise OpenApiDescriptionError(_("The content is not an OpenAPI description."))
    return loaded


def _resolve_references(node: Any, root: dict[str, Any], depth: int = 0) -> Any:
    """Replace local ``$ref`` entries with what they point to, up to a depth, so a schema can be read on its own."""
    if depth > MAXIMUM_REFERENCE_DEPTH:
        return node
    if isinstance(node, dict):
        reference = node.get("$ref")
        if isinstance(reference, str) and reference.startswith("#/"):
            target: Any = root
            for part in reference[2:].split("/"):
                target = target.get(part, {}) if isinstance(target, dict) else {}
            return _resolve_references(target, root, depth + 1)
        return {key: _resolve_references(value, root, depth) for key, value in node.items()}
    if isinstance(node, list):
        return [_resolve_references(item, root, depth) for item in node]
    return node


def _parameters_schema(path_item: dict, operation: dict, root: dict) -> str | None:
    """Collect path, query and header parameters and the request body into one JSON text."""
    collected: dict[str, Any] = {"path": [], "query": [], "header": []}
    for raw_parameter in [*(path_item.get("parameters") or []), *(operation.get("parameters") or [])]:
        parameter = _resolve_references(raw_parameter, root)
        location = parameter.get("in")
        if location in collected:
            collected[location].append({
                "name": parameter.get("name", ""),
                "type": (parameter.get("schema") or {}).get("type") or parameter.get("type") or "string",
                "required": bool(parameter.get("required", False)),
                "description": parameter.get("description", ""),
                "default": (parameter.get("schema") or {}).get("default", parameter.get("default", "")),
            })
    request_body = _resolve_references(operation.get("requestBody") or {}, root)
    body_schema = ((request_body.get("content") or {}).get("application/json") or {}).get("schema")
    if body_schema:
        collected["body"] = body_schema
    collected = {key: value for key, value in collected.items() if value}
    return json.dumps(collected, ensure_ascii=False) if collected else None


def _response_schema(operation: dict, root: dict) -> str | None:
    """The schema of the first successful response (2xx), as JSON text."""
    for status in sorted((operation.get("responses") or {}), key=str):
        if str(status).startswith("2"):
            response = _resolve_references(operation["responses"][status] or {}, root)
            schema = ((response.get("content") or {}).get("application/json") or {}).get("schema") or response.get("schema")
            return json.dumps(schema, ensure_ascii=False) if schema else None
    return None


# spec: import-and-record-api-operations :: Operation import
def list_operations_of_description(content: str) -> list[dict[str, Any]]:
    """List every operation of an OpenAPI description with the fields of a registry operation, ready to review.

    :raises OpenApiDescriptionError: When the content is not an OpenAPI description.
    """
    description = _load_description(content)
    operations: list[dict[str, Any]] = []
    for path, path_item in description["paths"].items():
        if not isinstance(path_item, dict):
            continue
        for method in HTTP_METHODS:
            operation = path_item.get(method)
            if not isinstance(operation, dict):
                continue
            operations.append({
                "name": operation.get("operationId") or f"{method.upper()} {path}",
                "method": method.upper(),
                "path": path,
                "description": operation.get("summary") or operation.get("description") or "",
                "parameters_schema": _parameters_schema(path_item, operation, description),
                "response_schema": _response_schema(operation, description),
                "source": "openapi_import",
            })
    return operations

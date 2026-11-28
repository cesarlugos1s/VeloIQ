"""Work out a small JSON Schema from a sample value (the output of an operation learned from a test or a request)."""
from __future__ import annotations

from typing import Any

MAXIMUM_SCHEMA_DEPTH = 6


def infer_json_schema(sample: Any, depth: int = 0) -> dict[str, Any]:
    """Describe the structure of a sample: object properties, the items of an array (from its first element), or a plain type."""
    if isinstance(sample, bool):
        return {"type": "boolean"}
    if isinstance(sample, int):
        return {"type": "integer"}
    if isinstance(sample, float):
        return {"type": "number"}
    if sample is None:
        return {"type": "null"}
    if isinstance(sample, str):
        return {"type": "string"}
    if depth >= MAXIMUM_SCHEMA_DEPTH:
        return {"type": "object" if isinstance(sample, dict) else "array"}
    if isinstance(sample, list):
        return {"type": "array", "items": infer_json_schema(sample[0], depth + 1) if sample else {}}
    if isinstance(sample, dict):
        return {"type": "object", "properties": {key: infer_json_schema(value, depth + 1) for key, value in sample.items()}}
    return {}

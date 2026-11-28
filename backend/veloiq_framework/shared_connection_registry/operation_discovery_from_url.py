"""Discover an operation from a URL: path and query parameters, description and output, trying four strategies in order.

1. Analysis of the URL: the segments of the path that look like identifiers become path parameters and the query values
   become query parameters.
2. An OpenAPI or Swagger description at the base address.
3. An ``OPTIONS`` request, for the methods the endpoint allows.
4. The real request (only when the method is GET, which reads and changes nothing), for the structure of its response.

A segment is an identifier only by its shape (a number, a UUID, a date, or text with a digit); a version such as v1 is part of
the path. No list of words decides anything. Every value found stays changeable by the administrator before it is recorded.
"""
from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from veloiq_framework.utils.i18n_utils import _

from .http_calls_to_other_systems import send_http_request
from .json_schema_from_sample import infer_json_schema
from .openapi_operation_import import list_operations_of_description
from .registry_choice_values import OPERATION_METHODS

NUMBER_PATTERN = re.compile(r"^-?\d+(\.\d+)?$")
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VERSION_PATTERN = re.compile(r"^v\d+$", re.IGNORECASE)
DIGIT_PATTERN = re.compile(r"\d")
# Where an OpenAPI description is usually served, relative to the base address (addresses, not words of a language).
OPENAPI_DESCRIPTION_LOCATIONS = ("/openapi.json", "/api/openapi.json", "/docs/openapi.json", "/swagger.json")
DISCOVERY_TIMEOUT_SECONDS = 10


def classify_path_segment(segment: str) -> tuple[str, str] | None:
    """Return (parameter name, type) when a path segment is an identifier by its shape, otherwise None."""
    if VERSION_PATTERN.match(segment):
        return None
    if NUMBER_PATTERN.match(segment):
        return "id", "integer"
    if UUID_PATTERN.match(segment):
        return "uuid", "string"
    if DATE_PATTERN.match(segment):
        return "date", "string"
    if segment.isalnum() and DIGIT_PATTERN.search(segment):
        return "id", "string"
    return None


# spec: discover-an-operation-from-a-url :: Identifiers are recognised by their shape
# spec: discover-an-operation-from-a-url :: Query values become parameters
def analyse_url(url: str) -> dict[str, Any]:
    """Strategy 1: the path with its identifiers as ``{parameters}``, the path parameters and the query parameters."""
    parsed = urlparse(url if "://" in url else f"http://{url}")
    counters: dict[str, int] = {}
    path_parameters: list[dict[str, Any]] = []
    cleaned_segments: list[str] = []
    for raw_segment in [part for part in parsed.path.split("/") if part]:
        segment = unquote(raw_segment)
        classified = classify_path_segment(segment)
        if classified is None:
            cleaned_segments.append(segment)
            continue
        name, parameter_type = classified
        counters[name] = counters.get(name, 0) + 1
        unique_name = name if counters[name] == 1 else f"{name}_{counters[name]}"
        path_parameters.append({"name": unique_name, "type": parameter_type, "required": True,
                                "description": _("Path parameter: {name}").format(name=unique_name), "default": segment})
        cleaned_segments.append("{" + unique_name + "}")
    query_parameters = []
    for name, values in parse_qs(parsed.query).items():
        sample = values[0] if values else ""
        parameter_type = "integer" if sample.lstrip("-").isdigit() else "number" if NUMBER_PATTERN.match(sample) else "string"
        query_parameters.append({"name": name, "type": parameter_type, "required": False,
                                 "description": _("Query parameter: {name}").format(name=name), "default": sample})
    return {
        "base_url": f"{parsed.scheme}://{parsed.netloc}",
        "path": "/" + "/".join(cleaned_segments),
        "literal_path": parsed.path or "/",
        "path_parameters": path_parameters,
        "query_parameters": query_parameters,
    }


def _template_matches(template: str, literal_path: str) -> bool:
    pattern = "^" + re.sub(r"\\\{[^}]+\\\}", "[^/]+", re.escape(template.rstrip("/"))) + "/?$"
    return re.match(pattern, literal_path.rstrip("/") or "/") is not None


def _find_in_openapi_description(base_url: str, literal_path: str, method: str) -> dict[str, Any] | None:
    """Strategy 2: the operation of an OpenAPI or Swagger description served at the base address, when it has this path."""
    for location in OPENAPI_DESCRIPTION_LOCATIONS:
        result = send_http_request("GET", f"{base_url}{location}", timeout_seconds=DISCOVERY_TIMEOUT_SECONDS)
        if result.http_status != 200:
            continue
        try:
            operations = list_operations_of_description(result.text)
        except Exception:  # a page that is not a description: try the next location
            continue
        on_this_path = [operation for operation in operations if _template_matches(operation["path"], literal_path)]
        chosen = next((operation for operation in on_this_path if operation["method"] == method), None) or (on_this_path[0] if on_this_path else None)
        if chosen is not None:
            return chosen
    return None


def _allowed_methods(base_url: str, literal_path: str) -> list[str]:
    """Strategy 3: the methods an ``OPTIONS`` request says the endpoint allows."""
    result = send_http_request("OPTIONS", f"{base_url}{literal_path}", timeout_seconds=DISCOVERY_TIMEOUT_SECONDS)
    allow = next((value for key, value in result.headers.items() if key.lower() == "allow"), "")
    return [method.strip().upper() for method in allow.split(",") if method.strip().upper() in OPERATION_METHODS]


# spec: discover-an-operation-from-a-url :: Discovery from a URL
def discover_operation_from_url(url: str, method: str = "GET") -> dict[str, Any]:
    """Work out an operation from a URL, as the registry records it, plus the fields IQVigilant's screens read.

    :raises ValueError: When the URL is empty or the method is not allowed.
    """
    method = (method or "GET").strip().upper()
    if not url or not url.strip():
        raise ValueError(_("A URL is required."))
    if method not in OPERATION_METHODS:
        raise ValueError(_("The method must be one of: {allowed}.").format(allowed=", ".join(OPERATION_METHODS)))
    analysed = analyse_url(url.strip())
    base_url, literal_path = analysed["base_url"], analysed["literal_path"]
    discovered: dict[str, Any] = {
        "method": method, "path": analysed["path"], "base_url": base_url, "description": "", "source": "url_discovery",
        "path_parameters": analysed["path_parameters"], "query_parameters": analysed["query_parameters"],
        "body_schema": None, "response_schema": None, "response_type": "object", "found_by": ["url_analysis"],
    }
    described = _find_in_openapi_description(base_url, literal_path, method)
    if described is not None:
        discovered["found_by"].append("openapi_description")
        discovered.update(method=described["method"], path=described["path"], description=described["description"])
        parameters = json.loads(described["parameters_schema"]) if described["parameters_schema"] else {}
        discovered["path_parameters"] = parameters.get("path") or discovered["path_parameters"]
        discovered["query_parameters"] = parameters.get("query") or discovered["query_parameters"]
        discovered["body_schema"] = parameters.get("body")
        discovered["response_schema"] = json.loads(described["response_schema"]) if described["response_schema"] else None
    allowed = _allowed_methods(base_url, literal_path)
    if allowed:
        discovered["found_by"].append("options_request")
        discovered["allowed_methods"] = allowed
        if described is None and method not in allowed:
            discovered["method"] = allowed[0]
    if discovered["method"] == "GET" and discovered["response_schema"] is None:
        real = send_http_request("GET", f"{base_url}{literal_path}", timeout_seconds=DISCOVERY_TIMEOUT_SECONDS)
        if real.http_status is not None and real.http_status < 500:
            sample = real.parsed_json()
            if sample is not None:
                discovered["found_by"].append("real_request")
                discovered["response_schema"] = infer_json_schema(sample)
    if len(discovered["found_by"]) == 1:
        discovered["notice"] = _("The URL could not be reached, so the parameters come from the URL alone. Reading it needs access to that "
                                 "address; check the operation and enter what is missing by hand.")
    schema = discovered["response_schema"] or {}
    discovered["response_type"] = schema.get("type") or "string"
    if not discovered["description"]:
        discovered["description"] = f"{discovered['method']} {discovered['path']}"
    discovered["parameters_schema"] = json.dumps(
        {key: value for key, value in (("path", discovered["path_parameters"]), ("query", discovered["query_parameters"]),
                                       ("body", discovered["body_schema"])) if value}, ensure_ascii=False) or None
    discovered["response_schema"] = json.dumps(discovered["response_schema"], ensure_ascii=False) if discovered["response_schema"] else None
    discovered["http_method"] = discovered["method"]
    discovered["summary"] = discovered["description"]
    discovered["parameters"] = {"path": discovered["path_parameters"], "query": discovered["query_parameters"]}
    discovered["request_body"] = discovered["body_schema"]
    return discovered

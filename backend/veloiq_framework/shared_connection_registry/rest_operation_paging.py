"""Read every page of an operation's answer, following the paging style of its connection.

The five styles of the specification: ``offset`` and ``page_number`` send the page size and move forward with a query parameter, ``cursor``
sends the cursor the answer holds, ``json_link`` follows the address the answer holds, and ``header_link`` follows the ``Link`` header
(RFC 8288). A read stops at the first empty page, at a page with fewer records than the page size, or when there is no next page. A read
that has followed the most pages the connection allows fails with a message, instead of returning part of the records as if they were all.
Each call waits and tries again when the system says it is throttled.
"""
from __future__ import annotations

import re
import time
from typing import Any, Callable
from urllib.parse import urljoin

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection, Operation
from .connection_registry_store import RegistryRuleError
from .operation_test_call import call_operation

THROTTLED_STATUS = 429
MAXIMUM_THROTTLE_WAITS = 3
MAXIMUM_THROTTLE_WAIT_SECONDS = 30
LINK_HEADER_NEXT_PATTERN = re.compile(r'<([^>]+)>\s*;[^,]*\brel="?next"?', re.IGNORECASE)


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


def _seconds_to_wait(headers: dict[str, str]) -> float:
    asked = next((value for key, value in headers.items() if key.lower() == "retry-after"), "")
    try:
        return max(0.0, min(float(asked), MAXIMUM_THROTTLE_WAIT_SECONDS))
    except ValueError:
        return 1.0


def _call_page(connection: Connection, operation: Operation, sample_values: dict[str, Any] | None, extra_query: dict[str, Any] | None,
               absolute_url: str | None, wait: Callable[[float], None]) -> dict[str, Any]:
    """One call, waiting when throttled; an error status or no answer raises with the message that names it."""
    for attempt in range(MAXIMUM_THROTTLE_WAITS + 1):
        answer = call_operation(connection, operation, sample_values, extra_query=extra_query, absolute_url=absolute_url)
        if answer["http_status"] == THROTTLED_STATUS and attempt < MAXIMUM_THROTTLE_WAITS:
            wait(_seconds_to_wait(answer["headers"]))
            continue
        break
    if answer["http_status"] is None:
        raise RegistryRuleError(_("The operation could not be reached: {problem}").format(problem=answer.get("error")))
    if answer["http_status"] >= 400:
        raise RegistryRuleError(_("The operation answered with the status {status} ({url}).").format(status=answer["http_status"], url=answer["url"]))
    return answer


def _next_address(settings, answer: dict[str, Any]) -> str | None:
    """The address of the next page for the json_link and header_link styles, made absolute against the base address."""
    if settings.paging == "json_link":
        found = read_at_path(answer["body_parsed"], settings.next_link_path or "")
    else:
        header = next((value for key, value in answer["headers"].items() if key.lower() == "link"), "")
        matched = LINK_HEADER_NEXT_PATTERN.search(header)
        found = matched.group(1) if matched else None
    if not found or not isinstance(found, str):
        return None
    return urljoin(settings.base_url.rstrip("/") + "/", found)


# spec: connect-to-rest-and-openapi-apis :: Paging by offset or by page number
# spec: connect-to-rest-and-openapi-apis :: Paging by cursor or by link
# spec: connect-to-rest-and-openapi-apis :: Paging has a limit
def read_all_pages(connection: Connection, operation: Operation, sample_values: dict[str, Any] | None = None, records_path: str = "",
                   wait: Callable[[float], None] = time.sleep) -> list[Any]:
    """Call the operation page after page and return the records of every page.

    :param records_path: Where each answer holds its list of records (empty: the answer is the list).
    :raises RegistryRuleError: When a call fails, an answer is not a list, or the limit of pages is reached with more to read.
    """
    settings = connection.connection_has_rest_connection_settings[0]
    style, records, next_address, cursor = settings.paging, [], None, None
    page_number, offset = settings.first_page_number or 0, 0
    size_query = {settings.page_size_parameter: settings.page_size} if settings.page_size_parameter and settings.page_size else {}
    for pages_read in range(1, settings.maximum_pages + 1):
        extra_query: dict[str, Any] = {}
        if style in ("offset", "page_number", "cursor"):
            extra_query.update(size_query)
        if style == "offset":
            extra_query[settings.page_parameter] = offset
        elif style == "page_number":
            extra_query[settings.page_parameter] = page_number
        elif style == "cursor" and cursor is not None:
            extra_query[settings.cursor_parameter] = cursor
        answer = _call_page(connection, operation, sample_values, extra_query, next_address, wait)
        page = extract_records(answer["body_parsed"], records_path)
        records.extend(page)
        if style == "none":
            return records
        if style in ("offset", "page_number"):
            if not page or (size_query and settings.page_size and len(page) < settings.page_size):
                return records
            offset += len(page)
            page_number += 1
            has_more = True
        elif style == "cursor":
            cursor = read_at_path(answer["body_parsed"], settings.next_cursor_path or "")
            has_more = bool(cursor)
        else:
            next_address = _next_address(settings, answer)
            has_more = next_address is not None
        if not has_more:
            return records
    raise RegistryRuleError(_("The read stopped after {pages} pages, the most the connection allows; more are available.").format(pages=settings.maximum_pages))

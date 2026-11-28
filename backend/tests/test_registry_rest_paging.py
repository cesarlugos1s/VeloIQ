"""Reading every page of an operation: the five paging styles, the page limit, throttled pages and the clear failures."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest
from sqlmodel import Session

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry.connection_registry_models import Connection, Operation
from veloiq_framework.shared_connection_registry.connection_registry_store import RegistryRuleError
from veloiq_framework.shared_connection_registry.rest_operation_paging import extract_records, read_all_pages, read_at_path

ITEMS = [{"n": n} for n in range(120)]


class PagedApi(BaseHTTPRequestHandler):
    requests: list = []
    throttle_first_page = 0

    def log_message(self, *arguments):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
        PagedApi.requests.append(self.path)
        host = f"http://{self.headers['Host']}"
        headers, body = {}, None
        if parsed.path == "/offset":
            start, size = int(query.get("offset", 0)), int(query.get("limit", 50))
            body = ITEMS[start:start + size]
        elif parsed.path == "/page":
            number, size = int(query.get("page", 1)), int(query.get("per_page", 50))
            body = ITEMS[(number - 1) * size:number * size]
            if PagedApi.throttle_first_page and number == 1:
                PagedApi.throttle_first_page -= 1
                return self._send(429, {"error": "slow"}, {"Retry-After": "2"})
        elif parsed.path == "/cursor":
            start, size = int(query.get("cursor", 0)), 50
            more = start + size < len(ITEMS)
            body = {"data": {"items": ITEMS[start:start + size], "meta": {"next": str(start + size) if more else None}}}
        elif parsed.path == "/link-body":
            number = int(query.get("p", 1))
            body = {"results": ITEMS[(number - 1) * 50:number * 50], "links": {"next": f"/link-body?p={number + 1}" if number * 50 < len(ITEMS) else None}}
        elif parsed.path == "/link-header":
            number = int(query.get("p", 1))
            body = ITEMS[(number - 1) * 50:number * 50]
            if number * 50 < len(ITEMS):
                headers["Link"] = f'<{host}/link-header?p={number + 1}>; rel="next", <{host}/link-header?p=1>; rel="first"'
        elif parsed.path == "/endless":
            body = [{"n": 1}]
            headers["Link"] = f'<{host}/endless>; rel="next"'
        elif parsed.path == "/not-a-list":
            body = {"id": 1}
        elif parsed.path == "/broken":
            return self._send(500, {"error": "boom"})
        self._send(200, body, headers)

    def _send(self, status, payload, headers=None):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture(scope="module")
def paged_api():
    server = ThreadingHTTPServer(("127.0.0.1", 0), PagedApi)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def read(client, auth, base_url, path, rest, records_path="", wait=lambda seconds: None):
    PagedApi.requests.clear()
    connection_id = client.post("/api/registry/connections", headers=auth, json={
        "name": f"p-{path}-{len(PagedApi.requests)}-{id(rest)}", "endpoint_type": "rest_api", "rest_settings": {"base_url": base_url, **rest}})
    assert connection_id.status_code == 201, connection_id.text
    connection_id = connection_id.json()["id"]
    operation_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "o", "path": path, "parameters_schema": "{}"}).json()["id"]
    with Session(get_engine()) as session:
        return read_all_pages(session.get(Connection, connection_id), session.get(Operation, operation_id), records_path=records_path, wait=wait)


def test_paging_by_offset_reads_every_page_with_the_page_size_and_stops_on_a_short_page(client, auth, paged_api):
    records = read(client, auth, paged_api, "/offset", {"paging": "offset", "page_parameter": "offset", "page_size_parameter": "limit", "page_size": 50})
    assert [r["n"] for r in records] == list(range(120))
    assert [path.split("?")[1] for path in PagedApi.requests] == ["limit=50&offset=0", "limit=50&offset=50", "limit=50&offset=100"]


def test_paging_by_page_number_starts_at_the_first_page_number(client, auth, paged_api):
    records = read(client, auth, paged_api, "/page", {"paging": "page_number", "page_parameter": "page", "page_size_parameter": "per_page", "page_size": 50, "first_page_number": 1})
    assert len(records) == 120 and [p.split("?")[1] for p in PagedApi.requests] == ["per_page=50&page=1", "per_page=50&page=2", "per_page=50&page=3"]


def test_paging_by_cursor_sends_the_cursor_of_the_answer_until_there_is_none(client, auth, paged_api):
    records = read(client, auth, paged_api, "/cursor", {"paging": "cursor", "cursor_parameter": "cursor", "next_cursor_path": "data.meta.next"}, records_path="data.items")
    assert len(records) == 120 and [p.split("?")[1] if "?" in p else "" for p in PagedApi.requests] == ["", "cursor=50", "cursor=100"]


def test_paging_by_a_link_in_the_body_follows_a_relative_address(client, auth, paged_api):
    records = read(client, auth, paged_api, "/link-body", {"paging": "json_link", "next_link_path": "links.next"}, records_path="results")
    assert len(records) == 120 and PagedApi.requests == ["/link-body", "/link-body?p=2", "/link-body?p=3"]


def test_paging_by_the_link_header_follows_the_next_relation(client, auth, paged_api):
    records = read(client, auth, paged_api, "/link-header", {"paging": "header_link"})
    assert len(records) == 120 and PagedApi.requests == ["/link-header", "/link-header?p=2", "/link-header?p=3"]


def test_without_paging_one_call_gives_the_list_and_a_named_key_holds_a_list_inside_an_object(client, auth, paged_api):
    assert len(read(client, auth, paged_api, "/offset", {"paging": "none"})) == 50
    assert len(read(client, auth, paged_api, "/cursor", {"paging": "none"}, records_path="data.items")) == 50


def test_a_read_that_reaches_the_page_limit_fails_instead_of_returning_part_of_the_records(client, auth, paged_api):
    with pytest.raises(RegistryRuleError, match="stopped after 4 pages"):
        read(client, auth, paged_api, "/endless", {"paging": "header_link", "maximum_pages": 4})
    assert len(PagedApi.requests) == 4


def test_a_throttled_page_waits_the_time_it_asks_and_is_tried_again(client, auth, paged_api):
    waits = []
    PagedApi.throttle_first_page = 2
    records = read(client, auth, paged_api, "/page", {"paging": "page_number", "page_parameter": "page", "page_size_parameter": "per_page", "page_size": 50}, wait=waits.append)
    assert len(records) == 120 and waits == [2.0, 2.0]


@pytest.mark.parametrize("path,rest,message", [
    ("/not-a-list", {}, "not a list"),
    ("/broken", {}, "status 500"),
])
def test_what_cannot_be_read_fails_with_a_message(client, auth, paged_api, path, rest, message):
    with pytest.raises(RegistryRuleError, match=message):
        read(client, auth, paged_api, path, rest)


def test_the_settings_a_paging_style_needs_are_checked_when_the_connection_is_saved(client, auth, paged_api):
    for paging, missing in (("offset", "page_parameter"), ("cursor", "cursor_parameter"), ("json_link", "next_link_path")):
        refused = client.post("/api/registry/connections", headers=auth, json={"name": f"v-{paging}", "endpoint_type": "rest_api", "rest_settings": {"base_url": paged_api, "paging": paging}})
        assert refused.status_code == 422 and missing in refused.json()["detail"]


def test_the_small_helpers_read_dotted_paths_and_records():
    assert read_at_path({"a": {"b": [1]}}, "a.b") == [1] and read_at_path({"a": 1}, "a.b") is None and read_at_path([1], "") == [1]
    assert extract_records({"d": [1, 2]}, "d") == [1, 2]
    with pytest.raises(RegistryRuleError, match="has no key x"):
        extract_records({"d": []}, "x")

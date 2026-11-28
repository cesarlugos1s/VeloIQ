"""The framework's HTTP client keeps every Set-Cookie header of an answer, so a session of several cookies can be sent back."""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from veloiq_framework.shared_connection_registry.http_calls_to_other_systems import send_http_request


class ServerThatSetsCookies(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(401 if self.path == "/refused" else 200)
        for cookie in ("SESSION=abc; Path=/; HttpOnly", "sap-usercontext=client=100; Path=/", "MYSAPSSO2=xyz; Path=/") if self.path != "/none" else ():
            self.send_header("Set-Cookie", cookie)
        self.send_header("X-CSRF-Token", "token-1")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *arguments):
        pass


@pytest.fixture(scope="module")
def server_address():
    server = ThreadingHTTPServer(("127.0.0.1", 0), ServerThatSetsCookies)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def test_every_set_cookie_header_of_an_answer_is_kept_not_only_the_last(server_address):
    result = send_http_request("GET", f"{server_address}/service")
    assert result.http_status == 200 and result.headers["X-CSRF-Token"] == "token-1"
    assert result.set_cookies == ["SESSION=abc; Path=/; HttpOnly", "sap-usercontext=client=100; Path=/", "MYSAPSSO2=xyz; Path=/"]


def test_the_cookies_of_an_error_answer_are_kept_and_an_answer_without_cookies_has_none(server_address):
    assert len(send_http_request("GET", f"{server_address}/refused").set_cookies) == 3
    assert send_http_request("GET", f"{server_address}/none").set_cookies == []
    assert send_http_request("GET", "http://127.0.0.1:9/").set_cookies == []

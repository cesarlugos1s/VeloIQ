"""An extension can open path prefixes for endpoints that authenticate the caller themselves; everything else still needs a login."""
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from veloiq_framework import db

from veloiq_framework.config import VeloIQConfig
from veloiq_framework.auth.utils import create_access_token
from veloiq_framework.extension import VeloIQExtension
from veloiq_framework.factory import _add_auth_middleware


def build_app(public_paths, monkeypatch):
    # The middleware looks for a portal's anonymous visitor when a call has no token, so it needs a database.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(db, "_engine", engine)
    app = FastAPI()

    @app.post("/api/ext/webhooks/{name}")
    def webhook(name: str):
        return {"name": name}

    @app.post("/api/ext/webhooks-who/{name}")
    def who(name: str, request: Request):
        user = getattr(request.state, "user", None)
        return {"user": user.get("sub") if user else None}

    @app.post("/api/ext/private")
    def private():
        return {"private": True}

    configuration = VeloIQConfig()
    _add_auth_middleware(app, configuration, public_paths)
    client = TestClient(app)
    client.auth_secret = configuration.auth_secret
    return client


def test_a_declared_prefix_skips_the_login_check_and_other_paths_still_need_a_login(monkeypatch):
    client = build_app(("/api/ext/webhooks/",), monkeypatch)
    assert client.post("/api/ext/webhooks/orders").json() == {"name": "orders"}
    assert client.post("/api/ext/private").status_code == 401


def test_nothing_is_opened_when_no_prefix_is_declared(monkeypatch):
    assert build_app((), monkeypatch).post("/api/ext/webhooks/orders").status_code == 401


def test_an_extension_declares_no_public_prefix_by_default():
    assert VeloIQExtension.public_path_prefixes == ()


def test_a_login_token_on_a_declared_prefix_is_read_and_a_token_that_is_not_one_is_left_for_the_endpoint(monkeypatch):
    client = build_app(("/api/ext/webhooks",), monkeypatch)
    token = create_access_token({"sub": "7", "roles": ["Admin"]}, client.auth_secret)
    assert client.post("/api/ext/webhooks-who/x", headers={"Authorization": f"Bearer {token}"}).json() == {"user": "7"}
    assert client.post("/api/ext/webhooks-who/x", headers={"Authorization": "Bearer an-api-key"}).json() == {"user": None}
    assert client.post("/api/ext/webhooks-who/x").json() == {"user": None}

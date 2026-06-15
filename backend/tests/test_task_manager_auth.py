"""Auth: login, JWT, protected routes."""


def test_login_returns_token(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post("/auth/login", json={"username": "nobody", "password": "x"})
    assert resp.status_code == 401


def test_protected_route_requires_token(client):
    resp = client.get("/api/project")
    assert resp.status_code == 401


def test_protected_route_accepts_token(client, auth):
    resp = client.get("/api/project", headers=auth)
    assert resp.status_code == 200


def test_invalid_token_rejected(client):
    resp = client.get("/api/project", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401

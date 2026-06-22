import pytest
from fastapi.testclient import TestClient

from app.api import auth as auth_api
from app.auth import dependencies
from app.config import settings
from app.main import app

client = TestClient(app)

VALID_PAYLOAD = {
    "sub": "1234567890",
    "email": "user@example.com",
    "email_verified": True,
    "name": "Test User",
    "picture": "https://example.com/avatar.png",
}


@pytest.fixture(autouse=True)
def configured_client_id(monkeypatch):
    """Most tests assume auth is configured; the unconfigured case is tested
    explicitly below."""
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")


def _patch_verify(monkeypatch, result):
    """Replace Google's verifier with a stub: `result` is either a payload dict
    to return, or an exception instance to raise."""

    def fake_verify(token, request, audience):
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(dependencies.id_token, "verify_oauth2_token", fake_verify)


def test_me_requires_token():
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_rejects_invalid_token(monkeypatch):
    _patch_verify(monkeypatch, ValueError("bad token"))
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401


def test_me_rejects_unverified_email(monkeypatch):
    _patch_verify(monkeypatch, {**VALID_PAYLOAD, "email_verified": False})
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 401


def test_me_returns_user_for_valid_token(monkeypatch):
    _patch_verify(monkeypatch, VALID_PAYLOAD)
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer good"})
    assert resp.status_code == 200
    assert resp.json() == {
        "sub": "1234567890",
        "email": "user@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.png",
    }


def test_me_returns_503_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 503


class _FakeTokenResponse:
    """Stand-in for httpx's Response in the auth-code exchange tests."""

    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


@pytest.fixture
def configured_secret(monkeypatch):
    """The exchange endpoint needs the client secret too (the id fixture above
    only sets the client id)."""
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")


def _patch_token_exchange(monkeypatch, response):
    monkeypatch.setattr(auth_api.httpx, "post", lambda *a, **k: response)


def test_google_auth_returns_id_token(monkeypatch, configured_secret):
    _patch_token_exchange(monkeypatch, _FakeTokenResponse(200, {"id_token": "the-id-token"}))
    resp = client.post("/api/auth/google", json={"code": "abc"})
    assert resp.status_code == 200
    assert resp.json() == {"id_token": "the-id-token"}


def test_google_auth_rejects_bad_code(monkeypatch, configured_secret):
    _patch_token_exchange(monkeypatch, _FakeTokenResponse(400, {"error": "invalid_grant"}))
    resp = client.post("/api/auth/google", json={"code": "bad"})
    assert resp.status_code == 401


def test_google_auth_502_when_no_id_token(monkeypatch, configured_secret):
    # 200 but missing id_token => code lacked the openid scope.
    _patch_token_exchange(monkeypatch, _FakeTokenResponse(200, {"access_token": "x"}))
    resp = client.post("/api/auth/google", json={"code": "abc"})
    assert resp.status_code == 502


def test_google_auth_503_when_secret_unconfigured(monkeypatch):
    # client id is set by the autouse fixture; secret defaults to empty.
    monkeypatch.setattr(settings, "google_client_secret", "")
    resp = client.post("/api/auth/google", json={"code": "abc"})
    assert resp.status_code == 503

import pytest
from fastapi.testclient import TestClient

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

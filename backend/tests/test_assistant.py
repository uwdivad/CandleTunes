import pytest
from fastapi.testclient import TestClient

from app.auth import dependencies
from app.config import settings
from app.db import engine as db_engine
from app.llm import get_provider as real_get_provider
from app.models.assistant import AssistantResult, AssistantSettings, TrackSettings

VALID_PAYLOAD = {
    "sub": "1234567890",
    "email": "user@example.com",
    "email_verified": True,
    "name": "Test User",
    "picture": "https://example.com/avatar.png",
}

CHAT_BODY = {
    "tickers": ["AAPL"],
    "start": "2024-01-01",
    "end": "2024-06-01",
    "messages": [{"role": "user", "content": "calm lo-fi please"}],
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A TestClient backed by a throwaway SQLite file, with auth configured and
    the LLM provider + data summary stubbed so no network is touched."""
    monkeypatch.setattr(settings, "database_url", f"sqlite:///{tmp_path / 'test.db'}")

    # Rebuild the engine/session factory against the temp DB, then create tables.
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(
        settings.database_url, connect_args={"check_same_thread": False}, future=True
    )
    monkeypatch.setattr(db_engine, "engine", test_engine)
    monkeypatch.setattr(
        db_engine, "SessionLocal", sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    )
    db_engine.Base.metadata.create_all(test_engine)

    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")

    # Avoid hitting yfinance.
    monkeypatch.setattr(
        "app.api.assistant.summarize_tickers",
        lambda tickers, start, end: {t: {"trend": "flat"} for t in tickers},
    )

    # Canned provider result.
    canned = AssistantResult(
        message="Set a mellow minor key.",
        settings=AssistantSettings(scale="minor", bpm=72, tracks={"AAPL": TrackSettings(instrument="piano")}),
    )

    class FakeProvider:
        def complete(self, system, messages):
            return canned

    monkeypatch.setattr("app.api.assistant.get_provider", lambda name: FakeProvider())

    from app.main import app

    return TestClient(app)


def _auth(monkeypatch, payload=VALID_PAYLOAD):
    monkeypatch.setattr(
        dependencies.id_token, "verify_oauth2_token", lambda *a, **k: payload
    )
    return {"Authorization": "Bearer good"}


def test_chat_requires_token(client):
    resp = client.post("/api/assistant/chat", json=CHAT_BODY)
    assert resp.status_code == 401


def test_chat_returns_structured_shape_and_persists_run(client, monkeypatch):
    headers = _auth(monkeypatch)
    resp = client.post("/api/assistant/chat", json=CHAT_BODY, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Set a mellow minor key."
    assert body["settings"]["scale"] == "minor"
    assert body["settings"]["tracks"]["AAPL"]["instrument"] == "piano"
    assert body["run_id"]

    # The run was persisted.
    from app.db.models import AssistantRun

    with db_engine.SessionLocal() as db:
        run = db.get(AssistantRun, body["run_id"])
        assert run is not None
        assert run.user_sub == VALID_PAYLOAD["sub"]
        assert run.tickers == ["AAPL"]
        assert run.refusal is False


def test_feedback_persists_and_requires_known_run(client, monkeypatch):
    headers = _auth(monkeypatch)
    chat = client.post("/api/assistant/chat", json=CHAT_BODY, headers=headers).json()
    run_id = chat["run_id"]

    ok = client.post(
        "/api/assistant/feedback",
        json={"run_id": run_id, "rating": "up", "note": "nice"},
        headers=headers,
    )
    assert ok.status_code == 200

    from app.db.models import AssistantFeedback

    with db_engine.SessionLocal() as db:
        rows = db.query(AssistantFeedback).filter_by(run_id=run_id).all()
        assert len(rows) == 1
        assert rows[0].rating == "up"
        assert rows[0].note == "nice"

    missing = client.post(
        "/api/assistant/feedback",
        json={"run_id": "does-not-exist", "rating": "down"},
        headers=headers,
    )
    assert missing.status_code == 404


def test_feedback_requires_token(client):
    resp = client.post("/api/assistant/feedback", json={"run_id": "x", "rating": "up"})
    assert resp.status_code == 401


def test_chat_503_when_provider_unconfigured(client, monkeypatch):
    headers = _auth(monkeypatch)
    # Restore the real factory and clear the key → 503 before any LLM work.
    monkeypatch.setattr("app.api.assistant.get_provider", real_get_provider)
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    resp = client.post("/api/assistant/chat", json=CHAT_BODY, headers=headers)
    assert resp.status_code == 503

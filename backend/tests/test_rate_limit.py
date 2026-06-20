"""Incoming per-client rate limiting (slowapi).

Hermetic: the sonify engine is stubbed so allowed requests touch no network, and
each test uses a unique X-Forwarded-For so its in-memory counter is independent
of other tests sharing the process-global store.
"""

import pytest
from fastapi.testclient import TestClient

import app.api.sonify as sonify_api
from app.config import settings
from app.main import app

SONIFY_BODY = {"tracks": [{"ticker": "AAA", "start": "2024-01-01", "end": "2024-02-01"}]}


@pytest.fixture
def client(monkeypatch):
    # Allowed requests must not hit yfinance — return an empty composition cheaply.
    monkeypatch.setattr(sonify_api, "sonify_composition", lambda *a, **k: ([], [], 0.0))
    return TestClient(app)


def test_sonify_returns_429_when_limit_exceeded(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_sonify", "2/minute")
    headers = {"X-Forwarded-For": "10.0.0.1"}

    assert client.post("/api/sonify", json=SONIFY_BODY, headers=headers).status_code == 200
    assert client.post("/api/sonify", json=SONIFY_BODY, headers=headers).status_code == 200

    resp = client.post("/api/sonify", json=SONIFY_BODY, headers=headers)
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


def test_separate_clients_have_independent_buckets(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_sonify", "1/minute")

    a = {"X-Forwarded-For": "10.0.0.2"}
    b = {"X-Forwarded-For": "10.0.0.3"}

    assert client.post("/api/sonify", json=SONIFY_BODY, headers=a).status_code == 200
    assert client.post("/api/sonify", json=SONIFY_BODY, headers=a).status_code == 429
    # A different client is unaffected by the first client's overflow.
    assert client.post("/api/sonify", json=SONIFY_BODY, headers=b).status_code == 200

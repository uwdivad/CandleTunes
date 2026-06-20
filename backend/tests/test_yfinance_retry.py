"""Outbound exponential-backoff-with-jitter retry around Yahoo Finance calls.

Hermetic: yfinance is stubbed (no network) and the tenacity Retrying's sleep is
neutralised (no real backoff waits), so these run instantly.
"""

import numpy as np
import pandas as pd
import pytest

import app.data.yfinance_client as yc
from app.config import settings


def _make_df(n: int = 5) -> pd.DataFrame:
    index = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {
            "Open": np.linspace(100, 110, n),
            "High": np.linspace(101, 111, n),
            "Low": np.linspace(99, 109, n),
            "Close": np.linspace(100, 110, n),
            "Volume": np.linspace(1000, 2000, n),
        },
        index=index,
    )


@pytest.fixture(autouse=True)
def _no_cache_no_sleep(monkeypatch):
    """Bypass the disk cache and make backoff waits instant for every test here."""
    monkeypatch.setattr(yc, "get_cached", lambda *a, **k: None)
    monkeypatch.setattr(yc, "set_cached", lambda *a, **k: None)
    monkeypatch.setattr(yc, "get_cached_value", lambda *a, **k: None)
    monkeypatch.setattr(yc, "set_cached_value", lambda *a, **k: None)
    monkeypatch.setattr(yc._download.retry, "sleep", lambda *_: None)
    monkeypatch.setattr(yc._screen.retry, "sleep", lambda *_: None)


def test_fetch_ohlcv_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}
    good = _make_df()

    def flaky(*a, **k):
        calls["n"] += 1
        if calls["n"] < 3:  # fail twice, succeed on the 3rd attempt
            raise RuntimeError("429 Too Many Requests")
        return good

    monkeypatch.setattr(yc.yf, "download", flaky)

    df = yc.fetch_ohlcv("ZZZX", "2024-01-01", "2024-02-01")

    assert calls["n"] == 3
    assert len(df) == 5


def test_fetch_ohlcv_raises_valueerror_after_exhausting_retries(monkeypatch):
    calls = {"n": 0}

    def always_fail(*a, **k):
        calls["n"] += 1
        raise RuntimeError("boom")

    monkeypatch.setattr(yc.yf, "download", always_fail)

    with pytest.raises(ValueError):
        yc.fetch_ohlcv("ZZZX", "2024-01-01", "2024-02-01")

    # Exactly the configured number of attempts, then the final error surfaces
    # (wrapped as ValueError → the router's existing 502 path).
    assert calls["n"] == settings.yf_retry_attempts


def test_fetch_ohlcv_does_not_retry_empty_result(monkeypatch):
    """An empty frame is a deterministic 'no data' case — fail fast, no retries."""
    calls = {"n": 0}

    def empty(*a, **k):
        calls["n"] += 1
        return pd.DataFrame()

    monkeypatch.setattr(yc.yf, "download", empty)

    with pytest.raises(ValueError):
        yc.fetch_ohlcv("ZZZX", "2024-01-01", "2024-02-01")

    assert calls["n"] == 1


def test_fetch_top_movers_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    def flaky(query):
        calls["n"] += 1
        if calls["n"] < 2:  # first screen call fails once, then recovers
            raise RuntimeError("transient")
        return {"quotes": [{"symbol": "AAA"}]}

    monkeypatch.setattr(yc.yf, "screen", flaky)

    result = yc.fetch_top_movers(count=1)

    assert result["gainers"] == [{"symbol": "AAA"}]
    assert calls["n"] >= 2

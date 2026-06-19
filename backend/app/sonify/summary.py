import numpy as np

from app.data.yfinance_client import fetch_ohlcv
from app.logging_config import log_call


@log_call
def summarize_ticker(ticker: str, start: str, end: str) -> dict:
    """Compact per-ticker stats for the LLM, computed from the same cached OHLCV
    the engine uses. A few cheap numbers so token cost stays low. Raises on fetch
    failure — callers degrade gracefully (see summarize_tickers)."""
    df = fetch_ohlcv(ticker, start, end)
    close = df["Close"].to_numpy(dtype=float)
    n = len(close)

    first, last = float(close[0]), float(close[-1])
    total_return_pct = round((last / first - 1.0) * 100.0, 2) if first else 0.0

    daily_returns = np.diff(close) / close[:-1] if n > 1 else np.array([0.0])
    daily_vol_pct = round(float(np.std(daily_returns)) * 100.0, 2)

    running_max = np.maximum.accumulate(close)
    drawdowns = (close - running_max) / running_max
    max_drawdown_pct = round(float(drawdowns.min()) * 100.0, 2)

    if total_return_pct > 5:
        trend = "up"
    elif total_return_pct < -5:
        trend = "down"
    else:
        trend = "flat"

    # Raw first/last closes are intentionally omitted — return %, volatility,
    # trend and drawdown are what drive musical choices, and dropping the two
    # price numbers trims the per-ticker payload sent to the LLM.
    return {
        "bars": n,
        "total_return_pct": total_return_pct,
        "daily_volatility_pct": daily_vol_pct,
        "trend": trend,
        "max_drawdown_pct": max_drawdown_pct,
    }


@log_call
def summarize_tickers(tickers: list[str], start: str, end: str) -> dict[str, dict]:
    """Summarize each ticker, skipping any that fail to fetch so one bad symbol
    doesn't sink the whole turn."""
    summaries: dict[str, dict] = {}
    for ticker in tickers:
        try:
            summaries[ticker] = summarize_ticker(ticker, start, end)
        except Exception as exc:  # noqa: BLE001 — degrade gracefully, never fail the turn
            summaries[ticker] = {"error": str(exc)}
    return summaries

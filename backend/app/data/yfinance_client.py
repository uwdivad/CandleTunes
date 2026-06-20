import pandas as pd
import yfinance as yf

from app.data.cache import get_cached, get_cached_value, set_cached, set_cached_value
from app.data.retry import yf_retry
from app.logging_config import log_call

MOVERS_CACHE_TTL_SECONDS = 3600


@yf_retry
def _download(ticker: str, start: str, end: str, interval: str) -> pd.DataFrame:
    """Raw yfinance download, retried with backoff + jitter on transient failures."""
    return yf.download(
        ticker, start=start, end=end, interval=interval, progress=False, auto_adjust=False
    )


@yf_retry
def _screen(query: str) -> dict:
    """Raw yfinance screen, retried with backoff + jitter on transient failures."""
    return yf.screen(query)


@log_call
def fetch_ohlcv(ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    cached = get_cached(ticker, start, end, interval)
    if cached is not None:
        return cached

    try:
        df = _download(ticker, start, end, interval)
    except Exception as exc:
        raise ValueError(f"Failed to fetch data for '{ticker}': {exc}") from exc

    if df is None or df.empty:
        raise ValueError(f"No data returned for ticker '{ticker}'")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.dropna()
    if df.empty:
        raise ValueError(f"No usable data returned for ticker '{ticker}'")

    set_cached(ticker, start, end, interval, df)
    return df


@log_call
def fetch_top_movers(count: int = 5) -> dict[str, list[dict]]:
    cache_key = "top_movers"
    cached = get_cached_value(cache_key, MOVERS_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    try:
        gainers = _screen("day_gainers")
        losers = _screen("day_losers")
    except Exception as exc:
        raise ValueError(f"Failed to fetch top movers: {exc}") from exc

    result = {
        "gainers": gainers.get("quotes", [])[:count],
        "losers": losers.get("quotes", [])[:count],
    }
    set_cached_value(cache_key, result)
    return result

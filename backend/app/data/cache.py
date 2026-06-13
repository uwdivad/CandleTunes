import hashlib
import pickle
import time

import pandas as pd

from app.config import settings
from app.logging_config import log_call


@log_call
def _cache_key(ticker: str, start: str, end: str, interval: str) -> str:
    raw = f"{ticker}|{start}|{end}|{interval}"
    return hashlib.sha256(raw.encode()).hexdigest()


@log_call
def get_cached(ticker: str, start: str, end: str, interval: str) -> pd.DataFrame | None:
    path = settings.cache_dir / f"{_cache_key(ticker, start, end, interval)}.pkl"
    if path.exists() and (time.time() - path.stat().st_mtime) < settings.cache_ttl_seconds:
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


@log_call
def set_cached(ticker: str, start: str, end: str, interval: str, df: pd.DataFrame) -> None:
    path = settings.cache_dir / f"{_cache_key(ticker, start, end, interval)}.pkl"
    with open(path, "wb") as f:
        pickle.dump(df, f)


@log_call
def get_cached_value(key: str, ttl_seconds: int) -> object | None:
    path = settings.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.pkl"
    if path.exists() and (time.time() - path.stat().st_mtime) < ttl_seconds:
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


@log_call
def set_cached_value(key: str, value: object) -> None:
    path = settings.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.pkl"
    with open(path, "wb") as f:
        pickle.dump(value, f)

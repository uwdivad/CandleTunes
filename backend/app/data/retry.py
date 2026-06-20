"""Retry helper for outbound Yahoo Finance calls.

yfinance has no built-in retry and Yahoo Finance throttles (HTTP 429) and has
transient network blips, so a single hiccup would otherwise become a user-facing
502. ``yf_retry`` wraps the raw network call with exponential backoff + jitter and
re-raises the final exception once attempts are exhausted (``reraise=True``), so
the caller's existing ``except Exception -> ValueError`` handling is unchanged.

Only *raised* exceptions are retried — deterministic "no data / bad ticker" cases
are validated by the caller after the call returns and stay a fast failure.
"""

from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.config import settings


def yf_retry(func):
    """Decorate a Yahoo Finance network call with exponential backoff + jitter."""
    return retry(
        stop=stop_after_attempt(settings.yf_retry_attempts),
        wait=wait_exponential_jitter(
            initial=settings.yf_retry_initial_seconds,
            max=settings.yf_retry_max_seconds,
        ),
        reraise=True,
    )(func)

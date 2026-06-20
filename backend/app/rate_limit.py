"""Incoming per-client rate limiting (slowapi).

The shared ``limiter`` lives here so routers can import it without a circular
dependency on ``app.main``. Storage is selected from ``rate_limit_storage_uri``:
``memory://`` keeps counts in-process (per instance); pointing it at a
``redis://`` URL (plus ``pip install "limits[redis]"``) gives a shared,
restart-surviving store across instances with no code change.

Per-route limits are passed as zero-arg callables that read ``settings`` at
request time (e.g. ``@limiter.limit(lambda: settings.rate_limit_sonify)``) so the
limits stay env-configurable and can be tightened at runtime in tests.
"""

from slowapi import Limiter
from starlette.requests import Request

from app.config import settings


def client_key(request: Request) -> str:
    """Identify the client to rate-limit by.

    Prefer the first ``X-Forwarded-For`` hop — behind Cloud Run / CloudFront /
    Lambda the socket peer is the proxy, and the real client IP is the first
    entry in that header. Fall back to the socket peer for direct connections.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


limiter = Limiter(
    key_func=client_key,
    default_limits=[settings.rate_limit_default],
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
    headers_enabled=True,  # emit X-RateLimit-* and Retry-After headers
)

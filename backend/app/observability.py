"""Langfuse LLM observability — a thin wrapper that no-ops when unconfigured.

Keeps the Langfuse import and the enabled/disabled branching in one place so the
providers and the assistant router stay decoupled from the SDK. Token usage (and
the cost Langfuse derives from it) is captured in `generation()`, which is the
only place the raw provider response is still in scope.

Targets the langfuse v4 SDK (OTel-based): observations are created with
`start_as_current_observation(as_type=...)`, and trace-level user/session/
metadata are propagated to child observations via `propagate_attributes()`.

Flush note: the assistant runs on Cloud Run with sync clients. Langfuse batches
events on a background thread, so call `flush()` before the request returns or a
frozen instance can drop them. `trace_span()` / `record_feedback_score()` do this
for you.
"""

from contextlib import contextmanager

from app.config import settings

_client = None
_initialized = False


def get_langfuse():
    """The shared Langfuse client, or None when not configured."""
    global _client, _initialized
    if not settings.langfuse_enabled:
        return None
    if not _initialized:
        _initialized = True
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_base_url,
        )
    return _client


def new_trace_id() -> str | None:
    """Mint a trace id up front so it can be persisted on the run row before the
    LLM call's trace exists. Returns None when Langfuse is disabled."""
    lf = get_langfuse()
    return lf.create_trace_id() if lf else None


class _NoopObservation:
    def update(self, **_):  # pragma: no cover - trivial
        ...


@contextmanager
def generation(name: str, model: str, input):
    """Record one LLM call as a Langfuse generation (auto-nests under the active
    trace span). Yields an object with `.update(output=, usage_details=)`; a no-op
    when Langfuse is disabled."""
    lf = get_langfuse()
    if lf is None:
        yield _NoopObservation()
        return
    with lf.start_as_current_observation(
        name=name, as_type="generation", model=model, input=input
    ) as gen:
        yield gen


@contextmanager
def trace_span(
    name: str,
    trace_id: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict | None = None,
    input=None,
    tags: list[str] | None = None,
):
    """Open the root trace span and propagate trace-level attributes to every
    observation created inside the `with` (incl. the provider's generation).
    Yields the span (for a final `.update(output=...)`) or None. Flushes on exit.

    `input` is set on the root span (which is what the trace's input renders from
    in the v4 observation-centric model) — pass only the meaningful, non-sensitive
    payload (e.g. the user's latest message), not every function arg. `tags`
    propagate to every child observation for dashboard filtering."""
    lf = get_langfuse()
    if lf is None:
        yield None
        return
    from langfuse import propagate_attributes

    ctx = {"trace_id": trace_id} if trace_id else None
    try:
        with lf.start_as_current_observation(
            name=name, as_type="span", trace_context=ctx, input=input
        ) as span:
            with propagate_attributes(
                user_id=user_id, session_id=session_id, metadata=metadata, tags=tags
            ):
                yield span
    finally:
        lf.flush()


def record_feedback_score(trace_id: str | None, rating: str) -> None:
    """Attach a thumbs up/down as a Langfuse score on an existing trace."""
    lf = get_langfuse()
    if lf is None or not trace_id:
        return
    lf.create_score(
        trace_id=trace_id,
        name="user_feedback",
        value=1 if rating == "up" else 0,
        data_type="BOOLEAN",
    )
    lf.flush()

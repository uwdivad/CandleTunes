import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.config import settings
from app.db.engine import get_db
from app.db.repository import get_run, save_feedback, save_run
from app.llm import get_provider
from app.llm.base import REFUSAL_MESSAGE, build_system_prompt
from app.logging_config import log_call
from app.observability import new_trace_id, record_feedback_score, trace_span
from app.rate_limit import limiter
from app.models.assistant import (
    AssistantChatResponse,
    AssistantRequest,
    ChatMessage,
    FeedbackRequest,
)
from app.sonify.summary import summarize_tickers

router = APIRouter()

# Cap how much chat history is sent to the LLM. The current settings snapshot
# (in the system prompt) carries the state, so only recent turns are needed for
# conversational context — this bounds input-token growth on long chats.
MAX_HISTORY_MESSAGES = 8


def _recent_messages(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Last N messages, trimmed so the first is a user turn (Anthropic requires
    the conversation to start with `user`)."""
    recent = messages[-MAX_HISTORY_MESSAGES:]
    while recent and recent[0].role != "user":
        recent = recent[1:]
    return recent


@router.post("/assistant/chat", response_model=AssistantChatResponse)
@limiter.limit(lambda *_: settings.rate_limit_assistant)
@log_call
def chat(
    request: Request,
    response: Response,
    req: AssistantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssistantChatResponse:
    """One arranger turn. Sign-in required (LLM calls cost money). Persists a run
    row regardless of outcome, then returns the result plus its run_id."""
    provider_name = (req.provider or settings.llm_provider).lower()
    model = settings.anthropic_model if provider_name == "anthropic" else settings.openai_model
    conversation_id = req.conversation_id or str(uuid.uuid4())

    # 503s here (unconfigured/unknown provider) propagate before we do any work.
    provider = get_provider(req.provider)
    summaries = summarize_tickers(req.tickers, req.start, req.end)
    system = build_system_prompt(summaries, req.current_settings)

    # The trace's input renders from the root span's input. Surface only the
    # user's latest turn — not the full system prompt or every arg — so traces
    # stay readable and we don't leak the prompt scaffolding into Langfuse.
    latest_user_message = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), None
    )

    # Mint the trace id up front: save_run() runs after the LLM call, so this is
    # the only way to persist the id (for feedback scoring) alongside the run.
    trace_id = new_trace_id()
    run_fields = dict(
        conversation_id=conversation_id,
        user_sub=user.sub,
        user_email=user.email,
        provider=provider_name,
        model=model,
        tickers=req.tickers,
        start=req.start,
        end=req.end,
        data_summary=summaries,
        request_messages=[m.model_dump() for m in req.messages],
        langfuse_trace_id=trace_id,
    )

    # trace_span nests the provider's generation under one trace, propagates the
    # user/session/metadata to it, and flushes on exit (required on Cloud Run with
    # the sync client); no-op when disabled.
    with trace_span(
        "assistant.chat",
        trace_id=trace_id,
        user_id=user.sub,
        session_id=conversation_id,
        metadata={"provider": provider_name, "model": model, "tickers": req.tickers},
        input=latest_user_message,
        tags=["feature:assistant", f"provider:{provider_name}"],
    ) as span:
        started = time.monotonic()
        try:
            result = provider.complete(system, _recent_messages(req.messages))
        except Exception as exc:  # noqa: BLE001 — record the failure, surface a 502
            save_run(
                db,
                **run_fields,
                latency_ms=int((time.monotonic() - started) * 1000),
                error=str(exc),
            )
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        latency_ms = int((time.monotonic() - started) * 1000)
        # Providers map a model decline (or unparseable output) to REFUSAL_MESSAGE.
        refusal = result.message == REFUSAL_MESSAGE
        run = save_run(
            db,
            **run_fields,
            result_message=result.message,
            result_settings=result.settings.model_dump(exclude_none=True),
            latency_ms=latency_ms,
            refusal=refusal,
        )
        if span:
            span.update(
                output=result.message, metadata={"refusal": refusal, "run_id": run.id}
            )

    return AssistantChatResponse(
        message=result.message, settings=result.settings, run_id=run.id
    )


@router.post("/assistant/feedback")
@log_call
def feedback(
    req: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Record a thumbs up/down (+ optional note) on a run. Sign-in required."""
    run = get_run(db, req.run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown run_id.")
    save_feedback(db, run_id=req.run_id, user_sub=user.sub, rating=req.rating, note=req.note)
    record_feedback_score(run.langfuse_trace_id, req.rating)
    return {"status": "ok"}

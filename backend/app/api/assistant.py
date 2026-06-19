import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.config import settings
from app.db.engine import get_db
from app.db.repository import get_run, save_feedback, save_run
from app.llm import get_provider
from app.llm.base import REFUSAL_MESSAGE, build_system_prompt
from app.logging_config import log_call
from app.models.assistant import (
    AssistantChatResponse,
    AssistantRequest,
    FeedbackRequest,
)
from app.sonify.summary import summarize_tickers

router = APIRouter()


@router.post("/assistant/chat", response_model=AssistantChatResponse)
@log_call
def chat(
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
    system = build_system_prompt(summaries)

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
    )

    started = time.monotonic()
    try:
        result = provider.complete(system, req.messages)
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
    if get_run(db, req.run_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown run_id.")
    save_feedback(db, run_id=req.run_id, user_sub=user.sub, rating=req.rating, note=req.note)
    return {"status": "ok"}

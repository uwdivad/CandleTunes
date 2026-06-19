import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.engine import Base

# Queryable JSON on Postgres (JSONB), portable plain JSON elsewhere (e.g. SQLite).
JSONColumn = JSON().with_variant(JSONB, "postgresql")


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AssistantRun(Base):
    """One assistant chat turn: the inputs we sent, the model output, and timing.
    `conversation_id` groups the turns of a single refinement chain."""

    __tablename__ = "assistant_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    conversation_id: Mapped[str] = mapped_column(String(36), index=True)

    user_sub: Mapped[str] = mapped_column(String, index=True)
    user_email: Mapped[str | None] = mapped_column(String, nullable=True)

    provider: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String)

    tickers: Mapped[list] = mapped_column(JSONColumn)
    start: Mapped[str] = mapped_column(String)
    end: Mapped[str] = mapped_column(String)

    data_summary: Mapped[dict] = mapped_column(JSONColumn)
    request_messages: Mapped[list] = mapped_column(JSONColumn)

    result_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_settings: Mapped[dict | None] = mapped_column(JSONColumn, nullable=True)

    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refusal: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    feedback: Mapped[list["AssistantFeedback"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class AssistantFeedback(Base):
    """A thumbs up/down (+ optional note) on a single run. One-to-many so a user
    can change their mind; take the latest per run for analysis."""

    __tablename__ = "assistant_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("assistant_runs.id"), index=True
    )
    user_sub: Mapped[str] = mapped_column(String, index=True)
    rating: Mapped[str] = mapped_column(String)  # "up" | "down"
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped["AssistantRun"] = relationship(back_populates="feedback")

from sqlalchemy.orm import Session

from app.db.models import AssistantFeedback, AssistantRun
from app.logging_config import log_call


@log_call
def save_run(db: Session, **fields) -> AssistantRun:
    """Insert one assistant run row and return it (with its generated id)."""
    run = AssistantRun(**fields)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@log_call
def get_run(db: Session, run_id: str) -> AssistantRun | None:
    return db.get(AssistantRun, run_id)


@log_call
def save_feedback(db: Session, run_id: str, user_sub: str, rating: str, note: str | None) -> AssistantFeedback:
    feedback = AssistantFeedback(run_id=run_id, user_sub=user_sub, rating=rating, note=note)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# SQLite needs check_same_thread=False to be usable across FastAPI's threadpool;
# the option is meaningless (and rejected) for other backends, so apply it only
# for sqlite URLs.
_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create tables if they don't exist. Imports models for their side effect of
    registering with Base.metadata, then issues CREATE TABLE. No migrations yet —
    fine for the append-only run/feedback log; revisit with Alembic if the schema
    starts changing."""
    from app.db import models  # noqa: F401  (register tables on Base.metadata)

    Base.metadata.create_all(engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: yield a session and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

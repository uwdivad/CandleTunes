from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cache_dir: Path = Path(__file__).resolve().parent.parent / "cache"
    cache_ttl_seconds: int = 3600
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"
    # Directory holding the built frontend (frontend/dist), copied into the
    # container image. Absent in local dev, so the static mount is skipped there.
    static_dir: Path = Path(__file__).resolve().parent.parent / "static"


settings = Settings()
settings.cache_dir.mkdir(parents=True, exist_ok=True)

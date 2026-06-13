from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cache_dir: Path = Path(__file__).resolve().parent.parent / "cache"
    cache_ttl_seconds: int = 3600
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
settings.cache_dir.mkdir(parents=True, exist_ok=True)

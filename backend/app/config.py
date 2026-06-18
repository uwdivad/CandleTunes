from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env (next to the venv); real environment variables still take
# precedence over anything declared there.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    cache_dir: Path = Path(__file__).resolve().parent.parent / "cache"
    cache_ttl_seconds: int = 3600
    cors_origins: list[str] = ["http://localhost:5173"]
    # Level for the console handler. The daily rolling file log is independent
    # and controlled by log_file_level below.
    log_level: str = "INFO"
    # Daily rolling file log (one file per day, rotated at midnight). Set to DEBUG
    # to capture @log_call arg/return traces; set log_file_level to "" to disable.
    log_dir: Path = Path(__file__).resolve().parent.parent / "logs"
    log_file_level: str = "DEBUG"
    log_file_backup_count: int = 14
    # Google OAuth 2.0 Web client ID. Used as the audience when verifying ID
    # tokens; must match VITE_GOOGLE_CLIENT_ID on the frontend. Empty disables
    # auth (protected endpoints then return 503).
    google_client_id: str = ""
    # Directory holding the built frontend (frontend/dist), copied into the
    # container image. Absent in local dev, so the static mount is skipped there.
    static_dir: Path = Path(__file__).resolve().parent.parent / "static"


settings = Settings()
settings.cache_dir.mkdir(parents=True, exist_ok=True)

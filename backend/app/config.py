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

    # LLM "arranger" assistant. Provider is per-request overridable; keys/models
    # come from the environment (or backend/.env). Calling an unconfigured
    # provider returns 503, mirroring the auth dependency.
    llm_provider: str = "anthropic"  # "anthropic" | "openai"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"
    openai_model: str = "gpt-4.1"

    # Langfuse LLM observability. Disabled (no-op) unless both keys are set; inject
    # them as Cloud Run env vars like the other LLM config. Self-hosted: point
    # langfuse_host at your deployment (defaults to the local self-host port).
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "http://localhost:3000"

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    # Persistence for assistant runs + feedback. SQLite keeps local dev and tests
    # infra-free; set a postgresql+psycopg:// URL in prod — the same ORM models
    # run on both.
    database_url: str = "sqlite:///" + str(
        Path(__file__).resolve().parent.parent / "candletunes.db"
    )

    # Outbound retry for Yahoo Finance calls (see app/data/retry.py). yfinance has
    # no built-in retry and Yahoo throttles often, so transient failures are
    # retried with exponential backoff + jitter before surfacing as a 502.
    yf_retry_attempts: int = 4
    yf_retry_initial_seconds: float = 0.5
    yf_retry_max_seconds: float = 8.0

    # Incoming per-client rate limiting (see app/rate_limit.py). Storage backend is
    # chosen from the URI scheme: "memory://" is in-process (per instance); switch
    # to "redis://host:6379" (and `pip install "limits[redis]"`) for a shared,
    # restart-surviving store across instances — no code change needed.
    rate_limit_enabled: bool = True
    rate_limit_storage_uri: str = "memory://"
    rate_limit_default: str = "120/minute"
    rate_limit_sonify: str = "30/minute"
    rate_limit_assistant: str = "10/minute"


settings = Settings()
settings.cache_dir.mkdir(parents=True, exist_ok=True)

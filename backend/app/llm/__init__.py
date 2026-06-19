from fastapi import HTTPException, status

from app.config import settings
from app.llm.base import Provider


def get_provider(name: str | None = None) -> Provider:
    """Select a provider by explicit name, falling back to the configured default.
    Unknown or unconfigured (missing API key) providers raise 503, mirroring the
    auth dependency's behavior when sign-in isn't configured."""
    name = (name or settings.llm_provider).lower()

    if name == "anthropic":
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Anthropic provider is not configured (ANTHROPIC_API_KEY unset).",
            )
        from app.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider()

    if name == "openai":
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI provider is not configured (OPENAI_API_KEY unset).",
            )
        from app.llm.openai_provider import OpenAIProvider

        return OpenAIProvider()

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Unknown LLM provider: {name!r}.",
    )

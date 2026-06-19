import anthropic

from app.config import settings
from app.llm.base import REFUSAL_MESSAGE
from app.models.assistant import AssistantResult, AssistantSettings, ChatMessage


class AnthropicProvider:
    def __init__(self) -> None:
        # Thinking is omitted (off) — this is fast structured extraction, not a
        # reasoning task. opus-4-8 runs without thinking when the field is absent.
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def complete(self, system: str, messages: list[ChatMessage]) -> AssistantResult:
        response = self._client.messages.parse(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=system,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            output_format=AssistantResult,
        )
        if response.stop_reason == "refusal":
            return AssistantResult(message=REFUSAL_MESSAGE, settings=AssistantSettings())
        result = response.parsed_output
        if result is None:
            return AssistantResult(message=REFUSAL_MESSAGE, settings=AssistantSettings())
        return result

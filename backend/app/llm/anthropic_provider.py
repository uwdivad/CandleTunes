import anthropic

from app.config import settings
from app.llm.base import REFUSAL_MESSAGE
from app.models.assistant import AssistantResult, AssistantSettings, ChatMessage
from app.observability import generation


class AnthropicProvider:
    def __init__(self) -> None:
        # Thinking is omitted (off) — this is fast structured extraction, not a
        # reasoning task. opus-4-8 runs without thinking when the field is absent.
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def complete(self, system: str, messages: list[ChatMessage]) -> AssistantResult:
        msgs = [{"role": m.role, "content": m.content} for m in messages]
        with generation(
            name="arranger.anthropic",
            model=settings.anthropic_model,
            input={"system": system, "messages": msgs},
        ) as gen:
            response = self._client.messages.parse(
                model=settings.anthropic_model,
                max_tokens=2000,
                system=system,
                messages=msgs,
                output_format=AssistantResult,
            )
            usage = getattr(response, "usage", None)
            if usage is not None:
                gen.update(
                    usage_details={
                        "input": usage.input_tokens,
                        "output": usage.output_tokens,
                    }
                )
            if response.stop_reason == "refusal":
                result = AssistantResult(message=REFUSAL_MESSAGE, settings=AssistantSettings())
            else:
                result = response.parsed_output or AssistantResult(
                    message=REFUSAL_MESSAGE, settings=AssistantSettings()
                )
            gen.update(output=result)
            return result

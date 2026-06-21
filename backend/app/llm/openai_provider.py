import openai

from app.config import settings
from app.llm.base import REFUSAL_MESSAGE
from app.models.assistant import AssistantResult, AssistantSettings, ChatMessage
from app.observability import generation


class OpenAIProvider:
    def __init__(self) -> None:
        self._client = openai.OpenAI(api_key=settings.openai_api_key)

    def complete(self, system: str, messages: list[ChatMessage]) -> AssistantResult:
        msgs = [
            {"role": "system", "content": system},
            *({"role": m.role, "content": m.content} for m in messages),
        ]
        with generation(
            name="arranger.openai",
            model=settings.openai_model,
            input={"messages": msgs},
        ) as gen:
            response = self._client.chat.completions.parse(
                model=settings.openai_model,
                messages=msgs,
                response_format=AssistantResult,
            )
            usage = getattr(response, "usage", None)
            if usage is not None:
                gen.update(
                    usage_details={
                        "input": usage.prompt_tokens,
                        "output": usage.completion_tokens,
                    }
                )
            message = response.choices[0].message
            if message.refusal or message.parsed is None:
                result = AssistantResult(message=REFUSAL_MESSAGE, settings=AssistantSettings())
            else:
                result = message.parsed
            gen.update(output=result)
            return result

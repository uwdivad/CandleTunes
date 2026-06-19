import openai

from app.config import settings
from app.llm.base import REFUSAL_MESSAGE
from app.models.assistant import AssistantResult, AssistantSettings, ChatMessage


class OpenAIProvider:
    def __init__(self) -> None:
        self._client = openai.OpenAI(api_key=settings.openai_api_key)

    def complete(self, system: str, messages: list[ChatMessage]) -> AssistantResult:
        response = self._client.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system},
                *({"role": m.role, "content": m.content} for m in messages),
            ],
            response_format=AssistantResult,
        )
        message = response.choices[0].message
        if message.refusal or message.parsed is None:
            return AssistantResult(message=REFUSAL_MESSAGE, settings=AssistantSettings())
        return message.parsed

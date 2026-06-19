import json
from typing import Protocol

from app.models.assistant import AssistantResult, ChatMessage

# A friendly stand-in when the model declines or returns nothing parseable.
REFUSAL_MESSAGE = (
    "I wasn't able to come up with an arrangement for that. Try rephrasing, or "
    "describe the mood you're after."
)

_ALLOWED = """
ALLOWED VALUES (use only these):
- scale: major | minor | pentatonic_major | pentatonic_minor | chromatic
- root_note: integer 0-11 (0=C, 1=C#, ... 11=B)
- notes_per_bar: 1 or 2
- speed_mode: "bpm" or "duration"
- bpm: 40-240 (only meaningful when speed_mode="bpm")
- total_duration_sec: 10-300 (only meaningful when speed_mode="duration")
- instrument / global_instrument: piano | synth_triangle | synth_sine | synth_sawtooth | synth_square
- register_base_midi: 36 (C2) | 48 (C3) | 60 (C4) | 72 (C5) | 84 (C6)
- chord_mode: off | triad | power
- legato: 0.1-1.0
- swing: 0.0-0.5
- color: hex string like "#7dd3fc"
""".strip()


def build_system_prompt(summaries: dict[str, dict]) -> str:
    """System prompt: what the app does, the allowed values, and how to respond.
    The per-ticker data summary is embedded so settings adapt to the real charts."""
    return f"""You are the "arranger" for CandleTunes, an app that sonifies stock/crypto \
price history into music. Each selected ticker becomes one track; its closing price drives \
pitch (within a scale) and its volume/volatility drives note velocity.

Your job: given the user's request and the price data below, choose musical settings that \
sound pleasing and coherent and reflect each ticker's character (a calm, flat stock should \
sound different from a volatile, surging one). Across tracks, prefer distinct instruments \
and registers so they don't muddy each other. Track 0 conventionally uses piano.

Respond with TWO things in the structured output:
- message: one or two friendly sentences describing what you set and why.
- settings: ONLY the fields that should change from the current state. Omit everything \
you're leaving alone. Per-ticker overrides go in `tracks`, keyed by the EXACT ticker symbol.

{_ALLOWED}

PRICE DATA SUMMARY (per ticker):
{json.dumps(summaries, indent=2)}
"""


class Provider(Protocol):
    def complete(self, system: str, messages: list[ChatMessage]) -> AssistantResult: ...

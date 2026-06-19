from typing import Literal

from pydantic import BaseModel, Field

from app.models.sonify import ChordMode, ScaleName

# Instruments the assistant may assign. These are exactly the voices the frontend
# exposes (frontend/src/components/trackOptions.ts VOICES): piano + four synth
# oscillators. The engine-only "meow" voice is intentionally excluded because the
# UI hides it. `register_base_midi` values mirror the UI's OCTAVES options.
Instrument = Literal["piano", "synth_triangle", "synth_sine", "synth_sawtooth", "synth_square"]
RegisterBaseMidi = Literal[36, 48, 60, 72, 84]
SpeedMode = Literal["bpm", "duration"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TrackSettings(BaseModel):
    """Per-ticker overrides. All optional — the assistant returns only what should
    change. Keyed by ticker symbol in AssistantSettings.tracks."""

    instrument: Instrument | None = None
    scale: ScaleName | None = None
    root_note: int | None = Field(default=None, ge=0, le=11)
    notes_per_bar: Literal[1, 2] | None = None
    register_base_midi: RegisterBaseMidi | None = None
    chord_mode: ChordMode | None = None
    color: str | None = None  # hex, e.g. "#7dd3fc"


class AssistantSettings(BaseModel):
    """A settings patch. Every field optional — only changed values are returned."""

    scale: ScaleName | None = None
    root_note: int | None = Field(default=None, ge=0, le=11)
    notes_per_bar: Literal[1, 2] | None = None
    speed_mode: SpeedMode | None = None
    bpm: float | None = None
    total_duration_sec: float | None = None
    global_instrument: Instrument | None = None
    legato: float | None = Field(default=None, ge=0.1, le=1.0)
    swing: float | None = Field(default=None, ge=0.0, le=0.5)
    chord_mode: ChordMode | None = None
    tracks: dict[str, TrackSettings] | None = None


class AssistantResult(BaseModel):
    """The LLM structured-output schema: a short chat reply plus a settings patch.
    Carries no run_id — the model must not generate it; the router adds it."""

    message: str
    settings: AssistantSettings = Field(default_factory=AssistantSettings)


class AssistantChatResponse(BaseModel):
    """What the chat route returns: the result plus the persisted run id."""

    message: str
    settings: AssistantSettings
    run_id: str


class AssistantRequest(BaseModel):
    tickers: list[str] = Field(min_length=1)
    start: str
    end: str
    messages: list[ChatMessage] = Field(min_length=1)
    current_settings: AssistantSettings | None = None
    provider: str | None = None
    conversation_id: str | None = None


class FeedbackRequest(BaseModel):
    run_id: str
    rating: Literal["up", "down"]
    note: str | None = None

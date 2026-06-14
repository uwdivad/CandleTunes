from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ScaleName(str, Enum):
    major = "major"
    minor = "minor"
    pentatonic_major = "pentatonic_major"
    pentatonic_minor = "pentatonic_minor"
    chromatic = "chromatic"


class TrackRequest(BaseModel):
    ticker: str
    start: str
    end: str
    interval: str = "1d"
    register_base_midi: int | None = None
    pitch_range_semitones: int = 24
    instrument: str | None = None
    scale: ScaleName | None = None
    root_note: int | None = Field(default=None, ge=0, le=11)
    notes_per_bar: Literal[1, 2] | None = None


class SonifyRequest(BaseModel):
    tracks: list[TrackRequest] = Field(min_length=1)
    bpm: float | None = None
    total_duration_sec: float | None = None
    notes_per_bar: Literal[1, 2] = 1
    scale: ScaleName = ScaleName.major
    root_note: int = Field(default=0, ge=0, le=11)
    global_instrument: str | None = None


class NoteEvent(BaseModel):
    time_sec: float
    pitch_midi: int
    duration_sec: float
    velocity: int
    track: int
    ticker: str


class TrackInfo(BaseModel):
    track: int
    ticker: str
    instrument: str
    register_base_midi: int
    bar_count: int


class SonifyResponse(BaseModel):
    notes: list[NoteEvent]
    tracks: list[TrackInfo]
    total_duration_sec: float


class MidiExportRequest(BaseModel):
    notes: list[NoteEvent]
    tracks: list[TrackInfo]

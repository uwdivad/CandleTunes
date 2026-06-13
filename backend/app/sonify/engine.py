from typing import Callable

import pandas as pd

from app.logging_config import log_call
from app.models.sonify import NoteEvent, ScaleName, TrackInfo, TrackRequest
from app.sonify.pitch import compute_log_returns, normalize_to_range, quantize_pitch, robust_zscore_clip
from app.sonify.scales import build_scale_pitches
from app.sonify.velocity import compute_velocity

BASE_REGISTERS = [60, 48, 72, 36, 84]  # C4, C3, C5, C2, C6
SYNTH_INSTRUMENTS = ["synth_triangle", "synth_sine", "synth_sawtooth"]
LEGATO = 0.9
MAX_BARS = 1000


@log_call
def register_for_track(track_index: int) -> int:
    return BASE_REGISTERS[track_index % len(BASE_REGISTERS)]


@log_call
def instrument_for_track(track_index: int) -> str:
    if track_index == 0:
        return "piano"
    return SYNTH_INSTRUMENTS[(track_index - 1) % len(SYNTH_INSTRUMENTS)]


@log_call
def sonify_track(
    df: pd.DataFrame,
    track_index: int,
    ticker: str,
    total_duration_sec: float,
    notes_per_bar: int,
    scale: ScaleName,
    root_note: int,
    base_midi: int,
    pitch_range_semitones: int,
) -> list[NoteEvent]:
    scale_pitches = build_scale_pitches(root_note, scale.value, base_midi, pitch_range_semitones)

    close = df["Close"].to_numpy(dtype=float)
    n = len(close)

    if n < 2:
        mid_pitch = scale_pitches[len(scale_pitches) // 2]
        return [
            NoteEvent(
                time_sec=0.0,
                pitch_midi=mid_pitch,
                duration_sec=total_duration_sec,
                velocity=80,
                track=track_index,
                ticker=ticker,
            )
        ]

    open_ = df["Open"].to_numpy(dtype=float)
    high = df["High"].to_numpy(dtype=float)
    low = df["Low"].to_numpy(dtype=float)
    volume = df["Volume"].to_numpy(dtype=float)

    log_returns = compute_log_returns(close)
    z_clipped = robust_zscore_clip(log_returns)
    level_close = normalize_to_range(close)
    hl_range_pct = (high - low) / close
    velocity = compute_velocity(volume, hl_range_pct)

    total_notes = n * notes_per_bar
    note_slot = total_duration_sec / total_notes

    notes: list[NoteEvent] = []

    if notes_per_bar == 2:
        price_min, price_max = float(close.min()), float(close.max())
        level_open = normalize_to_range(open_, price_min, price_max)
        half = note_slot / 2
        for i in range(n):
            t0 = i * note_slot
            pitch_a = quantize_pitch(level_open[i], z_clipped[i], scale_pitches)
            pitch_b = quantize_pitch(level_close[i], z_clipped[i], scale_pitches)
            notes.append(
                NoteEvent(
                    time_sec=t0,
                    pitch_midi=pitch_a,
                    duration_sec=half * LEGATO,
                    velocity=int(velocity[i]),
                    track=track_index,
                    ticker=ticker,
                )
            )
            notes.append(
                NoteEvent(
                    time_sec=t0 + half,
                    pitch_midi=pitch_b,
                    duration_sec=half * LEGATO,
                    velocity=int(velocity[i]),
                    track=track_index,
                    ticker=ticker,
                )
            )
    else:
        for i in range(n):
            pitch = quantize_pitch(level_close[i], z_clipped[i], scale_pitches)
            notes.append(
                NoteEvent(
                    time_sec=i * note_slot,
                    pitch_midi=pitch,
                    duration_sec=note_slot * LEGATO,
                    velocity=int(velocity[i]),
                    track=track_index,
                    ticker=ticker,
                )
            )

    return notes


@log_call
def _maybe_resample(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) <= MAX_BARS:
        return df
    return (
        df.resample("W")
        .agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
        .dropna()
    )


@log_call
def sonify_composition(
    tracks: list[TrackRequest],
    total_duration_sec: float,
    notes_per_bar: int,
    scale: ScaleName,
    root_note: int,
    fetch_ohlcv: Callable[[str, str, str, str], pd.DataFrame],
) -> tuple[list[NoteEvent], list[TrackInfo]]:
    all_notes: list[NoteEvent] = []
    track_infos: list[TrackInfo] = []

    for idx, track_req in enumerate(tracks):
        df = fetch_ohlcv(track_req.ticker, track_req.start, track_req.end, track_req.interval)
        df = _maybe_resample(df)

        base_midi = (
            track_req.register_base_midi
            if track_req.register_base_midi is not None
            else register_for_track(idx)
        )
        instrument = track_req.instrument or instrument_for_track(idx)

        notes = sonify_track(
            df,
            idx,
            track_req.ticker,
            total_duration_sec,
            notes_per_bar,
            scale,
            root_note,
            base_midi,
            track_req.pitch_range_semitones,
        )
        all_notes.extend(notes)
        track_infos.append(
            TrackInfo(
                track=idx,
                ticker=track_req.ticker,
                instrument=instrument,
                register_base_midi=base_midi,
                bar_count=len(df),
            )
        )

    return all_notes, track_infos

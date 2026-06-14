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
    bpm: float | None,
    total_duration_sec: float | None,
    notes_per_bar: int,
    scale: ScaleName,
    root_note: int,
    base_midi: int,
    pitch_range_semitones: int,
) -> tuple[list[NoteEvent], float]:
    scale_pitches = build_scale_pitches(root_note, scale.value, base_midi, pitch_range_semitones)

    close = df["Close"].to_numpy(dtype=float)
    n = len(close)
    total_notes = n * notes_per_bar
    
    if bpm is not None:
        seconds_per_note = 60.0 / bpm
        track_duration = total_notes * seconds_per_note
        note_slot = seconds_per_note
    elif total_duration_sec is not None:
        track_duration = total_duration_sec
        note_slot = total_duration_sec / total_notes if total_notes > 0 else 60.0
    else:
        track_duration = 60.0
        note_slot = 60.0 / total_notes if total_notes > 0 else 60.0

    if n < 2:
        mid_pitch = scale_pitches[len(scale_pitches) // 2]
        return [
            NoteEvent(
                time_sec=0.0,
                pitch_midi=mid_pitch,
                duration_sec=note_slot,
                velocity=80,
                track=track_index,
                ticker=ticker,
            )
        ], note_slot

    open_ = df["Open"].to_numpy(dtype=float)
    high = df["High"].to_numpy(dtype=float)
    low = df["Low"].to_numpy(dtype=float)
    volume = df["Volume"].to_numpy(dtype=float)

    log_returns = compute_log_returns(close)
    z_clipped = robust_zscore_clip(log_returns)
    level_close = normalize_to_range(close)
    hl_range_pct = (high - low) / close
    velocity = compute_velocity(volume, hl_range_pct)

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

    return notes, track_duration


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
    bpm: float | None,
    total_duration_sec: float | None,
    notes_per_bar: int,
    scale: ScaleName,
    root_note: int,
    global_instrument: str | None,
    fetch_ohlcv: Callable[[str, str, str, str], pd.DataFrame],
) -> tuple[list[NoteEvent], list[TrackInfo]]:
    all_notes: list[NoteEvent] = []
    track_infos: list[TrackInfo] = []
    max_duration_sec: float = 0.0

    for idx, track_req in enumerate(tracks):
        df = fetch_ohlcv(track_req.ticker, track_req.start, track_req.end, track_req.interval)
        df = _maybe_resample(df)

        base_midi = (
            track_req.register_base_midi
            if track_req.register_base_midi is not None
            else register_for_track(idx)
        )
        instrument = track_req.instrument or global_instrument or instrument_for_track(idx)
        track_scale = track_req.scale if track_req.scale is not None else scale
        track_root = track_req.root_note if track_req.root_note is not None else root_note
        track_npb = track_req.notes_per_bar if track_req.notes_per_bar is not None else notes_per_bar

        notes, track_duration = sonify_track(
            df,
            idx,
            track_req.ticker,
            bpm,
            total_duration_sec,
            track_npb,
            track_scale,
            track_root,
            base_midi,
            track_req.pitch_range_semitones,
        )
        all_notes.extend(notes)
        if track_duration > max_duration_sec:
            max_duration_sec = track_duration
            
        track_infos.append(
            TrackInfo(
                track=idx,
                ticker=track_req.ticker,
                instrument=instrument,
                register_base_midi=base_midi,
                bar_count=len(df),
            )
        )

    return all_notes, track_infos, max_duration_sec

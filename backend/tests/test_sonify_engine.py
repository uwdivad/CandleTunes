import numpy as np
import pandas as pd
import pytest

from app.models.sonify import ScaleName
from app.sonify.engine import sonify_composition, sonify_track
from app.sonify.scales import build_scale_pitches


def _make_df(n: int, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    open_ = close + rng.normal(0, 0.5, n)
    high = np.maximum(open_, close) + rng.uniform(0, 1, n)
    low = np.minimum(open_, close) - rng.uniform(0, 1, n)
    volume = rng.uniform(1000, 2000, n)
    index = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume}, index=index
    )


def test_sonify_track_note_count_single_note_per_bar():
    df = _make_df(10)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24)
    assert len(notes) == 10
    assert notes[0].time_sec == 0.0
    assert notes[-1].time_sec == pytest.approx(9 * (60.0 / 60.0))


def test_sonify_track_note_count_two_notes_per_bar():
    df = _make_df(10)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 2, ScaleName.major, 0, 60, 24)
    assert len(notes) == 20


def test_sonify_track_pitches_in_scale():
    df = _make_df(50, seed=42)
    scale_pitches = set(build_scale_pitches(0, "major", 60, 24))
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24)
    for note in notes:
        assert note.pitch_midi in scale_pitches


def test_sonify_track_velocity_range():
    df = _make_df(50, seed=1)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24)
    for note in notes:
        assert 1 <= note.velocity <= 127


def test_sonify_track_custom_legato():
    df = _make_df(10)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24, legato=0.5)
    note_slot = 60.0 / 60.0
    for note in notes:
        assert note.duration_sec == pytest.approx(note_slot * 0.5)


def test_sonify_track_swing_shifts_offbeat_notes():
    df = _make_df(10)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 2, ScaleName.major, 0, 60, 24, legato=1.0, swing=0.2)
    note_slot = 60.0 / 60.0
    half = note_slot / 2
    swing_offset = half * 0.2

    onbeat = notes[0]
    offbeat = notes[1]
    assert onbeat.time_sec == pytest.approx(0.0)
    assert offbeat.time_sec == pytest.approx(half + swing_offset)
    assert offbeat.duration_sec == pytest.approx((half - swing_offset) * 1.0)
    # offbeat note should not overlap into the next bar
    assert offbeat.time_sec + offbeat.duration_sec <= note_slot + 1e-9


@pytest.mark.parametrize("chord_mode,extra_notes_per_note", [("off", 0), ("power", 1), ("triad", 2)])
def test_sonify_track_chord_mode_adds_chord_tones(chord_mode, extra_notes_per_note):
    df = _make_df(10)
    scale_pitches = set(build_scale_pitches(0, "major", 60, 24))
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24, chord_mode=chord_mode)

    assert len(notes) == 10 * (1 + extra_notes_per_note)
    for note in notes:
        assert note.pitch_midi in scale_pitches


def test_sonify_track_chord_tones_have_reduced_velocity():
    df = _make_df(10)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24, chord_mode="triad")

    # group notes by time_sec: melody note first, then its chord tones
    by_time: dict[float, list] = {}
    for note in notes:
        by_time.setdefault(note.time_sec, []).append(note)

    for grouped in by_time.values():
        melody, *chord_tones = grouped
        for chord_note in chord_tones:
            assert chord_note.velocity == int(melody.velocity * 0.8)


def test_sonify_track_single_bar_edge_case():
    df = _make_df(1)
    notes, _ = sonify_track(df, 0, "AAPL", 60.0, None, 1, ScaleName.major, 0, 60, 24)
    assert len(notes) == 1
    assert notes[0].duration_sec == 1.0
    assert notes[0].velocity == 80


def test_sonify_track_flat_price_no_div_by_zero():
    n = 10
    index = pd.date_range("2024-01-01", periods=n, freq="D")
    df = pd.DataFrame(
        {
            "Open": [100.0] * n,
            "High": [100.0] * n,
            "Low": [100.0] * n,
            "Close": [100.0] * n,
            "Volume": [0.0] * n,
        },
        index=index,
    )
    notes, _ = sonify_track(df, 0, "FLAT", 60.0, None, 1, ScaleName.major, 0, 60, 24)
    assert len(notes) == 10
    for note in notes:
        assert 1 <= note.velocity <= 127


def test_sonify_composition_multi_track_registers():
    def fake_fetch(ticker, start, end, interval):
        return _make_df(20, seed=hash(ticker) % 1000)

    from app.models.sonify import TrackRequest

    tracks = [
        TrackRequest(ticker="AAPL", start="2024-01-01", end="2024-02-01"),
        TrackRequest(ticker="BTC-USD", start="2024-01-01", end="2024-02-01"),
    ]

    notes, track_infos, max_dur, failed = sonify_composition(
        tracks, 60.0, None, 1, ScaleName.major, 0, None, fake_fetch
    )

    assert failed == []
    assert track_infos[0].track == 0
    assert track_infos[0].instrument == "piano"
    assert track_infos[1].track == 1
    assert track_infos[1].instrument == "synth_triangle"
    assert track_infos[0].register_base_midi != track_infos[1].register_base_midi

    track0_notes = [n for n in notes if n.track == 0]
    track1_notes = [n for n in notes if n.track == 1]
    assert len(track0_notes) == 20
    assert len(track1_notes) == 20
    # all tracks share the same timeline
    assert max(n.time_sec + n.duration_sec for n in notes) <= 60.0 + 1e-6


def test_sonify_composition_partial_success_keeps_indices():
    from app.models.sonify import TrackRequest

    def fake_fetch(ticker, start, end, interval):
        if ticker == "BAD":
            raise ValueError(f"No data returned for ticker '{ticker}'")
        return _make_df(20, seed=hash(ticker) % 1000)

    tracks = [
        TrackRequest(ticker="AAPL", start="2024-01-01", end="2024-02-01"),
        TrackRequest(ticker="BAD", start="2024-01-01", end="2024-02-01"),
        TrackRequest(ticker="MSFT", start="2024-01-01", end="2024-02-01"),
    ]

    notes, track_infos, _max_dur, failed = sonify_composition(
        tracks, 60.0, None, 1, ScaleName.major, 0, None, fake_fetch
    )

    # Failed track is reported, surviving tracks keep their original indices.
    assert [f.ticker for f in failed] == ["BAD"]
    assert failed[0].track == 1
    assert [ti.track for ti in track_infos] == [0, 2]
    assert {n.track for n in notes} == {0, 2}

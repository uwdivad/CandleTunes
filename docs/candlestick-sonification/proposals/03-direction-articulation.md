# 3. Candle direction → articulation

**Status**: 💡 Idea

**Goal**: make bull vs. bear candles audibly distinct using **direction**
(`close >= open`), which is currently unused in note formation.

## Options for what direction controls

- **Articulation**: bull candles play more *legato* (sustained), bear candles more
  *staccato* (clipped) — modulate `duration_sec` by direction.
- **Velocity accent**: a small velocity bump for bull candles, dip for bear, on top of the
  existing volume/range velocity.
- **Chord quality** (stretch): bull → major-ish chord tones, bear → minor — would interact
  with `chord_mode` / `chord_tone_pitches` and is the most involved.

Articulation is the cleanest v1: one multiplier on the existing per-note duration, no new
notes, no pitch changes.

## Tasks

- [ ] `models/sonify.py`: add a `direction_articulation: bool = False` flag.
- [ ] `engine.py`: when enabled, compute `is_bull = close[i] >= open_[i]` and scale the
      note duration (e.g. bull `legato`, bear `legato * 0.5`).
- [ ] `tests/test_sonify_engine.py`: a bull bar yields a longer `duration_sec` than a bear
      bar at the same slot.

## Notes

- Direction is the most "free" signal — it's a sign bit already in the data and maps
  naturally onto a binary musical contrast. Good low-risk follow-up to #1 or #2.

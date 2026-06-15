# 2. Wick-range pitch accents

**Status**: 💡 Idea

**Goal**: keep the existing melodic line (close-driven) but add short **grace notes** or a
pitch bend reaching up to the bar's high and/or down to its low, so long wicks are heard
as well as seen.

## Mapping

For each bar, alongside the main note:

- If the upper wick (`high - max(open, close)`) is a meaningful fraction of the candle
  range, emit a short grace note at the **high** pitch just before/after the main note.
- If the lower wick (`min(open, close) - low`) is meaningful, emit one at the **low**
  pitch.

Grace-note duration could be a small fixed fraction of the note slot (e.g. `0.15 *
note_slot`) at reduced velocity, similar to how `_chord_notes` emits secondary notes at
`velocity * 0.8`.

## Tasks

- [ ] `models/sonify.py`: add a `wick_accents: bool = False` flag (global, possibly
      per-track later).
- [ ] `engine.py`: after the main note, conditionally append high/low grace notes when the
      wick exceeds a threshold (e.g. wick > 25% of the high-low range).
- [ ] `tests/test_sonify_engine.py`: a bar with a large upper wick emits an extra note at
      the high pitch; a doji (no wicks) emits none.

## Trade-offs

- Cheaper than OHLC mode (no new `notes_per_bar` value, no frontend type widening beyond a
  toggle) and composes with any existing `notes_per_bar`.
- Risk of clutter on noisy/volatile series — the threshold and the velocity reduction are
  the main tuning knobs.

# 1. OHLC note mode (`notes_per_bar = 4`)

**Status**: 💡 Idea

**Goal**: trace out the full candle as a four-note figure per bar —
**Open → High → Low → Close** — so the listener hears the candle's shape, not just the
close.

## Why this first

The engine already has a two-note path for `notes_per_bar == 2` (open → close within one
note slot, each note `half * legato`). Extending the slot to four sub-notes is the same
pattern with finer subdivision, so it touches the fewest concepts.

## Mapping

For each bar, normalize all four prices against the **same close-based min/max** already
used for `level_open` so the four notes share one pitch frame, then quantize each:

```
slot = note_slot / 4
O at t0 + 0*slot   pitch = quantize(level_open[i],  z[i])
H at t0 + 1*slot   pitch = quantize(level_high[i],  z[i])
L at t0 + 2*slot   pitch = quantize(level_low[i],   z[i])
C at t0 + 3*slot   pitch = quantize(level_close[i], z[i])
```

This makes a bull candle rise on the close and a bear candle fall, with the wicks pushing
the H/L notes above/below the body — the candle's silhouette becomes audible.

## Tasks

- [ ] `models/sonify.py`: widen `notes_per_bar` validation to allow `4` (currently
      effectively `1` or `2`).
- [ ] `engine.py`: add a `notes_per_bar == 4` branch in `sonify_track`, normalizing
      `high`/`low` with the same `(price_min, price_max)` frame as `level_open`, and
      emitting the four sub-notes. Reuse `_chord_notes` per sub-note if chord_mode is on.
- [ ] `tests/test_sonify_engine.py`: assert 4 melodic notes per bar, correct sub-slot
      timing, and that H ≥ body ≥ L in pitch for a clean (no-blend) case.
- [ ] Frontend `notesPerBar` type currently `1 | 2` (`api/types.ts`,
      `TickerChartPanel.tsx`) — widen to `1 | 2 | 4` and add the option to the
      notes-per-bar control.
- [ ] `TickerChartPanel.tsx` `noteTimes` mapping uses `i * notesPerBar` into unique slot
      times — verify it still lines the playhead up to the bar with 4 sub-notes (the
      bar's first sub-note is the right anchor).

## Open questions

- The z-return blend (`quantize_pitch_index`) is per-bar, so all four sub-notes get the
  same direction nudge — fine, but worth confirming it doesn't flatten the H/L contrast.
- Does the high-low velocity weighting still make sense per sub-note, or should H/L get a
  distinct accent? Keep uniform for v1.

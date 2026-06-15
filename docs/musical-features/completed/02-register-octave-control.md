# 2. Register / octave control per ticker

**Status**: ✅ Completed

**Goal**: let each ticker be shifted up/down in pitch independently, rather than relying
solely on the auto-assigned register by track index.

- [x] Backend already supports this: `TrackRequest.register_base_midi` and
      `TrackRequest.pitch_range_semitones` (`backend/app/models/sonify.py`), consumed in
      `sonify_composition` (`engine.py`).
- [x] `api/types.ts`: add `registerBaseMidi?: number` (and optionally
      `pitchRangeSemitones?: number`) to `TrackConfig`.
- [x] `TickerInput.tsx` gear panel: add an "Octave" select, e.g. options mapped to
      `register_base_midi` values `36, 48, 60, 72, 84` (C2–C6), defaulting to "Auto"
      (omit field → backend's `register_for_track(idx)`).
- [x] `HomePage.tsx`: pass `register_base_midi: trackConfigs[ticker]?.registerBaseMidi`
      in the `tracks` array sent to `/api/sonify`.

**Notes**: smallest item on this list — backend work is already done.

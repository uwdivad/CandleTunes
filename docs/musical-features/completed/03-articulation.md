# 3. Articulation / note length (staccato ↔ legato)

**Status**: ✅ Completed

**Goal**: replace the hardcoded `LEGATO = 0.9` in `engine.py` with a user-controlled
note-length ratio.

- [x] `models/sonify.py`: add `legato: float = Field(default=0.9, ge=0.1, le=1.0)` to
      `SonifyRequest`.
- [x] `engine.py`: thread `legato` through `sonify_composition` → `sonify_track`,
      replacing the `LEGATO` constant in the `duration_sec=note_slot * LEGATO` /
      `half * LEGATO` calculations.
- [x] `tests/test_sonify_engine.py`: add a case asserting `duration_sec ≈ note_slot * legato`
      for a non-default legato value.
- [x] `SonifyControls.tsx`: add a "Articulation" slider (Staccato ↔ Legato, 0.1–1.0,
      default 0.9).
- [x] `HomePage.tsx` / `api/types.ts`: thread `legato` state into the `/api/sonify`
      request.

**Notes**: global-only for v1 (no per-track override) — keeps scope small.

# 5. Groove / rhythm variation (swing, rests)

**Status**: 🚧 In progress — swing shipped; rests still open.

**Goal**: avoid perfectly metronomic, always-on-grid notes.

- [x] `models/sonify.py`: add `swing: float = Field(default=0.0, ge=0.0, le=0.5)` to
      `SonifyRequest` (fraction of the second half-note's slot to delay, only meaningful
      when `notes_per_bar == 2`).
- [x] `engine.py`: in the `notes_per_bar == 2` branch, shift the second note's `time_sec`
      by `+ half * swing` and shrink its `duration_sec` accordingly so it doesn't
      overlap the next bar.
- [x] `SonifyControls.tsx`: add a "Swing" slider (0–50%), only enabled/visible when
      Notes/bar = 2.
- [ ] *(stretch, not done)* Rests: add a `rest_threshold: float` — if a bar's velocity signal falls
      below the threshold, skip emitting that note entirely (silence on quiet bars).
      Mark as a separate sub-task since it changes note *counts*, which
      `test_sonify_engine.py` currently asserts on.

**Notes**: keep swing and rests as independently shippable sub-items; swing is the
higher-value, lower-risk one.

# Musical Features

Tracking docs for the musical functions added (or planned) on top of the base
sonification engine. Each feature lives in its own file, sorted into a subdirectory by
status:

- **[`completed/`](completed/)** — shipped, all sub-steps checked off.
- **[`in-progress/`](in-progress/)** — partially shipped or has open sub-tasks.

## Status overview

| # | Feature | Status |
|---|---------|--------|
| 1 | [Per-track mixing (mute / solo / volume / pan)](completed/01-per-track-mixing.md) | ✅ Completed |
| 2 | [Register / octave control per ticker](completed/02-register-octave-control.md) | ✅ Completed |
| 3 | [Articulation / note length (staccato ↔ legato)](completed/03-articulation.md) | ✅ Completed |
| 4 | [Harmony / chords](completed/04-harmony-chords.md) | ✅ Completed |
| 5 | [Groove / rhythm variation (swing, rests)](in-progress/05-groove-rhythm.md) | 🚧 Swing shipped; rests open |
| 6 | [Audio effects (reverb / delay)](completed/06-audio-effects.md) | ✅ Completed |
| 7 | [Loop / repeat playback](completed/07-loop-playback.md) | ✅ Completed |

## Implementation order (as built)

1. **#2 Register/octave** — backend already done, very small frontend lift.
2. **#1 Per-track mixing** — highest UX value for multi-ticker listening.
3. **#7 Loop playback** — small, frontend-only, immediately useful while tweaking mix.
4. **#3 Articulation** — small, one new global slider + backend param.
5. **#6 Audio effects** — frontend-only, moderate complexity (async reverb buffers).
6. **#5 Groove/swing** — backend param + small engine change; rests as a stretch follow-up.
7. **#4 Harmony/chords** — most involved; touches pitch-selection logic and tests most.

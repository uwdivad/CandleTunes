# Musical Features Plan

Tracking plan for musical functions identified as missing from the current UI.
Check off each item (and sub-step) as it's implemented.

---

## 1. Per-track mixing (mute / solo / volume / pan)

**Goal**: with multiple tickers playing simultaneously, let the user isolate or balance
individual tracks.

- [ ] `AudioEngine.ts`: replace direct `instrument.connect(this.masterVolume)` with a
      per-track `Tone.Channel` (volume/pan/mute/solo built in), chained
      `instrument -> Tone.Channel -> masterVolume`. Store in
      `Map<number, Tone.Channel>` alongside `instruments`.
- [ ] `AudioEngine.ts`: add `setTrackVolume(track, percent)`, `setTrackPan(track, value)`,
      `setTrackMute(track, muted)`, `setTrackSolo(track, solo)`. `Tone.Channel.solo`
      handles cross-track muting automatically via `Tone.Solo`.
- [ ] `HomePage.tsx`: add `trackMixer: Record<string /* ticker */, { volume: number; pan: number; mute: boolean; solo: boolean }>`
      state, with sensible defaults (volume 100, pan 0, mute/solo false).
- [ ] UI: add compact mute (`M`) / solo (`S`) toggle buttons to each `TickerChartPanel`
      header (next to the ticker label), plus a volume + pan slider in the existing
      gear-icon settings panel in `TickerInput.tsx`.
- [ ] `index.css`: small `.track-mixer` button styles (active/mute/solo color states).

**Notes**: purely frontend — no backend/API changes needed.

---

## 2. Register / octave control per ticker

**Goal**: let each ticker be shifted up/down in pitch independently, rather than relying
solely on the auto-assigned register by track index.

- [x] Backend already supports this: `TrackRequest.register_base_midi` and
      `TrackRequest.pitch_range_semitones` (`backend/app/models/sonify.py`), consumed in
      `sonify_composition` (`engine.py`).
- [ ] `api/types.ts`: add `registerBaseMidi?: number` (and optionally
      `pitchRangeSemitones?: number`) to `TrackConfig`.
- [ ] `TickerInput.tsx` gear panel: add an "Octave" select, e.g. options mapped to
      `register_base_midi` values `36, 48, 60, 72, 84` (C2–C6), defaulting to "Auto"
      (omit field → backend's `register_for_track(idx)`).
- [ ] `HomePage.tsx`: pass `register_base_midi: trackConfigs[ticker]?.registerBaseMidi`
      in the `tracks` array sent to `/api/sonify`.

**Notes**: smallest item on this list — backend work is already done.

---

## 3. Articulation / note length (staccato ↔ legato)

**Goal**: replace the hardcoded `LEGATO = 0.9` in `engine.py` with a user-controlled
note-length ratio.

- [ ] `models/sonify.py`: add `legato: float = Field(default=0.9, ge=0.1, le=1.0)` to
      `SonifyRequest`.
- [ ] `engine.py`: thread `legato` through `sonify_composition` → `sonify_track`,
      replacing the `LEGATO` constant in the `duration_sec=note_slot * LEGATO` /
      `half * LEGATO` calculations.
- [ ] `tests/test_sonify_engine.py`: add a case asserting `duration_sec ≈ note_slot * legato`
      for a non-default legato value.
- [ ] `SonifyControls.tsx`: add a "Articulation" slider (Staccato ↔ Legato, 0.1–1.0,
      default 0.9).
- [ ] `HomePage.tsx` / `api/types.ts`: thread `legato` state into the `/api/sonify`
      request.

**Notes**: global-only for v1 (no per-track override) — keeps scope small.

---

## 4. Harmony / chords

**Goal**: optionally thicken each track's single melodic line with scale-derived chord
tones (e.g. root + 3rd + 5th).

- [ ] `models/sonify.py`: add `chord_mode: Literal["off", "triad", "power"] = "off"` to
      `SonifyRequest`, with an optional per-track override on `TrackRequest`
      (`chord_mode: Literal["off","triad","power"] | None = None`).
- [ ] `pitch.py` / `engine.py`: when `chord_mode != "off"`, for each generated note, also
      emit additional `NoteEvent`s at scale-degree offsets from the chosen pitch's index
      in `scale_pitches` (+2 steps for a third, +4 steps for a fifth in `"triad"`; +4
      only for `"power"`), clamped to the scale list bounds. Reduce chord-tone velocity
      slightly (e.g. `velocity * 0.8`) so the melody note still leads.
- [ ] `engine.py`: extend `sonify_track` to append these extra notes with the same
      `time_sec`/`duration_sec`/`track`.
- [ ] `SonifyControls.tsx`: add a "Harmony" dropdown (Off / Triad / Power Chord), global
      + per-track override in the gear panel.
- [ ] Frontend playback/keyboard: no changes expected — `Tone.Part` and
      `activeNotes: Map<track, Set<midi>>` already support multiple simultaneous notes
      per track.

**Notes**: verify with `tests/test_sonify_engine.py` that all chord-tone pitches are
still members of `scale_pitches`.

---

## 5. Groove / rhythm variation (swing, rests)

**Goal**: avoid perfectly metronomic, always-on-grid notes.

- [ ] `models/sonify.py`: add `swing: float = Field(default=0.0, ge=0.0, le=0.5)` to
      `SonifyRequest` (fraction of the second half-note's slot to delay, only meaningful
      when `notes_per_bar == 2`).
- [ ] `engine.py`: in the `notes_per_bar == 2` branch, shift the second note's `time_sec`
      by `+ half * swing` and shrink its `duration_sec` accordingly so it doesn't
      overlap the next bar.
- [ ] `SonifyControls.tsx`: add a "Swing" slider (0–50%), only enabled/visible when
      Notes/bar = 2.
- [ ] *(stretch)* Rests: add a `rest_threshold: float` — if a bar's velocity signal falls
      below the threshold, skip emitting that note entirely (silence on quiet bars).
      Mark as a separate sub-task since it changes note *counts*, which
      `test_sonify_engine.py` currently asserts on.

**Notes**: keep swing and rests as independently shippable sub-items; swing is the
higher-value, lower-risk one.

---

## 6. Audio effects (reverb / delay)

**Goal**: add spatial depth — currently all instruments are completely dry.

- [ ] `AudioEngine.ts`: insert effect sends between `masterVolume` and the destination:
      `masterVolume -> reverb -> delay -> toDestination()` and also `-> recorder` (so
      exports include effects). Use `Tone.Reverb` (decay ~1.5s) and
      `Tone.FeedbackDelay` (delay ~0.25s, feedback ~0.3), both with a `wet` control.
- [ ] `AudioEngine.ts`: add `setReverbAmount(percent)` / `setDelayAmount(percent)`
      mapping `0-100` → each effect's `.wet` value (`0-1`).
- [ ] `HomePage.tsx`: add `reverb`/`delay` state (default 0), wire to the above setters
      via `useEffect`, same pattern as the existing `volume` effect.
- [ ] `TransportControls.tsx` (or a new small "Mix" section in the sidebar): add
      "Reverb" and "Delay" sliders (0–100%) next to the existing volume control.
- [ ] `Tone.Reverb` requires async impulse generation (`Tone.Reverb.generate()` /
      `ready` promise) — await it inside `init()` alongside `Tone.loaded()`.

**Notes**: purely frontend; watch for the async reverb-buffer-generation cost on
`init()` (regeneration already awaits `Tone.loaded()`, so this fits the same pattern).

---

## 7. Loop / repeat playback

**Goal**: let a composition repeat continuously instead of stopping after one pass.

- [ ] `AudioEngine.ts`: add `setLoop(enabled: boolean, durationSec: number)` —
      sets `Tone.getTransport().loop`, `loopStart = 0`, `loopEnd = durationSec`, and
      also sets `this.part.loop = enabled` / `this.part.loopEnd = durationSec` (Part
      loop is separate from Transport loop and is required for notes to retrigger each
      pass).
- [ ] `HomePage.tsx`: add `isLooping` state (default `false`). Call
      `audioEngine.setLoop(isLooping, composition.total_duration_sec)` whenever
      `isLooping` or `composition` changes.
- [ ] `HomePage.tsx`: in the `requestAnimationFrame` tick (`useEffect` around line ~97),
      when `t >= total_duration_sec` **and** `isLooping`, don't pause/reset — just let
      the transport/part loop continue (reset `currentTime` to 0 for the UI). When not
      looping, keep existing pause/reset/stop-recording behavior.
- [ ] `TransportControls.tsx`: add a "Loop" toggle button next to Play/Pause.
- [ ] Recording interaction: disable the Loop toggle (or force it off) while
      `isRecordingAudio` is true, so audio export still stops after exactly one pass —
      keep current `handleStopRecording`/recording-completion logic unchanged.

**Notes**: smallest *frontend-only* item besides #1; mostly transport/part configuration.

---

## Suggested order

1. **#2 Register/octave** — backend already done, very small frontend lift.
2. **#1 Per-track mixing** — highest UX value for multi-ticker listening.
3. **#7 Loop playback** — small, frontend-only, immediately useful while tweaking mix.
4. **#3 Articulation** — small, one new global slider + backend param.
5. **#6 Audio effects** — frontend-only, moderate complexity (async reverb buffers).
6. **#5 Groove/swing** — backend param + small engine change; rests as a stretch follow-up.
7. **#4 Harmony/chords** — most involved; touches pitch-selection logic and tests most.

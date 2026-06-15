# 4. Harmony / chords

**Status**: ✅ Completed

**Goal**: optionally thicken each track's single melodic line with scale-derived chord
tones (e.g. root + 3rd + 5th).

- [x] `models/sonify.py`: add `chord_mode: Literal["off", "triad", "power"] = "off"` to
      `SonifyRequest`, with an optional per-track override on `TrackRequest`
      (`chord_mode: Literal["off","triad","power"] | None = None`).
- [x] `pitch.py` / `engine.py`: when `chord_mode != "off"`, for each generated note, also
      emit additional `NoteEvent`s at scale-degree offsets from the chosen pitch's index
      in `scale_pitches` (+2 steps for a third, +4 steps for a fifth in `"triad"`; +4
      only for `"power"`), clamped to the scale list bounds. Reduce chord-tone velocity
      slightly (e.g. `velocity * 0.8`) so the melody note still leads.
- [x] `engine.py`: extend `sonify_track` to append these extra notes with the same
      `time_sec`/`duration_sec`/`track`.
- [x] `SonifyControls.tsx`: add a "Harmony" dropdown (Off / Triad / Power Chord), global
      + per-track override in the gear panel.
- [x] Frontend playback/keyboard: no changes expected — `Tone.Part` and
      `activeNotes: Map<track, Set<midi>>` already support multiple simultaneous notes
      per track.

**Notes**: verify with `tests/test_sonify_engine.py` that all chord-tone pitches are
still members of `scale_pitches`.

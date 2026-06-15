# 6. Audio effects (reverb / delay)

**Status**: ✅ Completed

**Goal**: add spatial depth — currently all instruments are completely dry.

- [x] `AudioEngine.ts`: insert effect sends between `masterVolume` and the destination:
      `masterVolume -> reverb -> delay -> toDestination()` and also `-> recorder` (so
      exports include effects). Use `Tone.Reverb` (decay ~1.5s) and
      `Tone.FeedbackDelay` (delay ~0.25s, feedback ~0.3), both with a `wet` control.
- [x] `AudioEngine.ts`: add `setReverbAmount(percent)` / `setDelayAmount(percent)`
      mapping `0-100` → each effect's `.wet` value (`0-1`).
- [x] `HomePage.tsx`: add `reverb`/`delay` state (default 0), wire to the above setters
      via `useEffect`, same pattern as the existing `volume` effect.
- [x] `TransportControls.tsx` (or a new small "Mix" section in the sidebar): add
      "Reverb" and "Delay" sliders (0–100%) next to the existing volume control.
- [x] `Tone.Reverb` requires async impulse generation (`Tone.Reverb.generate()` /
      `ready` promise) — await it inside `init()` alongside `Tone.loaded()`.

**Notes**: purely frontend; watch for the async reverb-buffer-generation cost on
`init()` (regeneration already awaits `Tone.loaded()`, so this fits the same pattern).

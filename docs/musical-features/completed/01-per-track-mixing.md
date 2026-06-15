# 1. Per-track mixing (mute / solo / volume / pan)

**Status**: ✅ Completed

**Goal**: with multiple tickers playing simultaneously, let the user isolate or balance
individual tracks.

- [x] `AudioEngine.ts`: replace direct `instrument.connect(this.masterVolume)` with a
      per-track `Tone.Channel` (volume/pan/mute/solo built in), chained
      `instrument -> Tone.Channel -> masterVolume`. Store in
      `Map<number, Tone.Channel>` alongside `instruments`.
- [x] `AudioEngine.ts`: add `setTrackVolume(track, percent)`, `setTrackPan(track, value)`,
      `setTrackMute(track, muted)`, `setTrackSolo(track, solo)`. `Tone.Channel.solo`
      handles cross-track muting automatically via `Tone.Solo`.
- [x] `HomePage.tsx`: add `trackMixer: Record<string /* ticker */, { volume: number; pan: number; mute: boolean; solo: boolean }>`
      state, with sensible defaults (volume 100, pan 0, mute/solo false).
- [x] UI: add compact mute (`M`) / solo (`S`) toggle buttons to each `TickerChartPanel`
      header (next to the ticker label), plus a volume + pan slider in the existing
      gear-icon settings panel in `TickerInput.tsx`.
- [x] `index.css`: small `.track-mixer` button styles (active/mute/solo color states).

**Notes**: purely frontend — no backend/API changes needed.

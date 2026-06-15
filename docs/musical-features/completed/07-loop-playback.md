# 7. Loop / repeat playback

**Status**: ✅ Completed

**Goal**: let a composition repeat continuously instead of stopping after one pass.

- [x] `AudioEngine.ts`: add `setLoop(enabled: boolean, durationSec: number)` —
      sets `Tone.getTransport().loop`, `loopStart = 0`, `loopEnd = durationSec`, and
      also sets `this.part.loop = enabled` / `this.part.loopEnd = durationSec` (Part
      loop is separate from Transport loop and is required for notes to retrigger each
      pass).
- [x] `HomePage.tsx`: add `isLooping` state (default `false`). Call
      `audioEngine.setLoop(isLooping, composition.total_duration_sec)` whenever
      `isLooping` or `composition` changes.
- [x] `HomePage.tsx`: in the `requestAnimationFrame` tick (`useEffect` around line ~97),
      when `t >= total_duration_sec` **and** `isLooping`, don't pause/reset — just let
      the transport/part loop continue (reset `currentTime` to 0 for the UI). When not
      looping, keep existing pause/reset/stop-recording behavior.
- [x] `TransportControls.tsx`: add a "Loop" toggle button next to Play/Pause.
- [x] Recording interaction: disable the Loop toggle (or force it off) while
      `isRecordingAudio` is true, so audio export still stops after exactly one pass —
      keep current `handleStopRecording`/recording-completion logic unchanged.

**Notes**: smallest *frontend-only* item besides #1; mostly transport/part configuration.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Start of every session**: this `CLAUDE.md` is auto-loaded, but `AI_INSTRUCTIONS.md` and
`ai_history/` are **not** — read them explicitly before doing other work:
1. Read `AI_INSTRUCTIONS.md` (repo root) — defines mandatory AI-collaboration rules for
   this repo (see "AI session history" below for the summary), and must be followed at
   the end of any session with significant code/architecture/design changes.
2. Read `ai_history/index.md` for the current architecture summary and session log
   index, and skim the most recent file(s) in `ai_history/sessions/` for context on
   recent work.

## Project overview

CandleTunes turns stock/crypto OHLCV data into music ("sonification"). A FastAPI backend
fetches price history via `yfinance`, converts it into a list of MIDI-like `NoteEvent`s, and
a React/TypeScript frontend plays those notes through Tone.js while rendering candlestick
charts and a piano keyboard synced to playback.

## Commands

### Backend (Python, FastAPI) — run from `backend/`

A venv already exists at `backend/.venv`.

```powershell
# Run the dev server (reload enabled), serves http://localhost:8000
.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Run all tests
.venv\Scripts\python.exe -m pytest

# Run a single test file / test
.venv\Scripts\python.exe -m pytest tests/test_sonify_engine.py
.venv\Scripts\python.exe -m pytest tests/test_sonify_engine.py::test_sonify_track_pitches_in_scale
```

There is no linter/formatter configured for the backend.

### Frontend (React + TypeScript + Vite) — run from `frontend/`

```powershell
npm run dev      # dev server at http://localhost:5173 (proxies to backend at VITE_API_BASE_URL, default http://localhost:8000)
npm run build    # tsc -b type-check, then vite build
npm run lint     # eslint .
```

There is no frontend test runner configured.

## Architecture

### Backend (`backend/app/`)

Request flow: `api/*.py` (FastAPI routers) → `models/*.py` (Pydantic request/response
schemas) → `sonify/*.py` (pure computation) → `data/*.py` (data fetch + disk cache).
Every public function is wrapped with `@log_call` (`logging_config.py`), which logs
args/return values at DEBUG level — set `log_level` in `app/config.py`/env to `DEBUG` to
see this.

- **`api/sonify.py`** — `POST /api/sonify`: the core endpoint. Takes a `SonifyRequest`
  (list of `TrackRequest`s + global musical params) and returns a `SonifyResponse`
  (flat list of `NoteEvent`s + per-track `TrackInfo` + total duration).
- **`api/chart.py`** — `GET /api/chart/{ticker}`: raw OHLCV bars for the candlestick chart.
- **`api/midi.py`** — `POST /api/midi`: converts a `SonifyResponse`'s notes/tracks into a
  downloadable `.mid` file via `sonify/midi_export.py` (pretty_midi).
- **`api/movers.py`** — `GET /api/movers`: top gainers/losers via `yf.screen`.
- **`sonify/engine.py`** — `sonify_composition()` iterates over tracks, fetches OHLCV,
  resamples to weekly bars if a series exceeds `MAX_BARS` (1000), and calls
  `sonify_track()` per track. Each track gets an auto-assigned register
  (`BASE_REGISTERS`, cycling C4/C3/C5/C2/C6) and instrument (`piano` for track 0, then
  cycling synth oscillator types) unless overridden per-track.
  - **Timing**: if `bpm` is set, note duration is derived from BPM (`60/bpm` per note
    slot); otherwise notes are stretched to fit `total_duration_sec`. `total_duration_sec`
    in the response is the *max* across tracks (tracks can have different bar counts).
  - **Pitch mapping** (`sonify/pitch.py` + `sonify/scales.py`): close price is normalized
    to `[0,1]` over its range, blended 70/30 with a clipped z-scored log-return signal,
    then quantized to the nearest pitch in a scale built from `root_note`/`scale`/
    `register_base_midi`/`pitch_range_semitones`.
  - **Velocity** (`sonify/velocity.py`): blend of normalized volume (60%) and normalized
    high-low range (40%); falls back to pure range-based volatility when volume is all
    zero (forex/crypto).
  - With `notes_per_bar == 2`, each bar emits two notes (open price → close price) within
    one note slot, each with `duration_sec = half_slot * LEGATO` (`LEGATO = 0.9`).
- **`data/yfinance_client.py`** — wraps `yfinance` downloads. Raises `ValueError` on
  empty/failed fetches, which routers convert to HTTP 502. The raw `yf.download`/
  `yf.screen` calls go through `data/retry.py`'s `@yf_retry` (tenacity) — exponential
  backoff with jitter on *raised* transient errors (Yahoo 429 / network), re-raising the
  final exception after `yf_retry_attempts`. Deterministic "no data" results are not
  retried (validated after the call).
- **`data/cache.py`** — disk cache in `backend/cache/` (pickled DataFrames, keyed by
  sha256 of `ticker|start|end|interval`, gitignored). OHLCV cache TTL is
  `cache_ttl_seconds` (1h default); top-movers cache TTL is `MOVERS_CACHE_TTL_SECONDS`
  (15min, in `yfinance_client.py`).
- **`rate_limit.py`** — incoming per-client rate limiting via `slowapi`. `main.py`
  registers the shared `limiter`, a 429 exception handler, and `SlowAPIMiddleware` (applies
  `rate_limit_default` to every route), with CORS kept outermost so 429s keep CORS headers.
  Expensive endpoints add stricter caps via `@limiter.limit(lambda *_: settings.<limit>)`
  (`/api/sonify` → `rate_limit_sonify`, `/api/assistant/chat` → `rate_limit_assistant`);
  those endpoints need both `request: Request` and `response: Response` params (slowapi
  injects rate-limit headers into the latter). Clients are keyed by the first
  `X-Forwarded-For` hop. Storage is `rate_limit_storage_uri` — `memory://` (per instance)
  today; switch to `redis://…` (+ `pip install "limits[redis]"`) for a shared store, no
  code change.

### Frontend (`frontend/src/`)

- **`pages/HomePage.tsx`** — top-level orchestrator and effectively the app's state
  container (tickers, date range, scale/root/notes-per-bar, BPM vs. fixed-duration mode,
  per-track config/colors, volume, recording state). A debounced effect
  (`GENERATION_DEBOUNCE_MS = 500`) re-POSTs `/api/sonify` whenever relevant state changes,
  then re-initializes the `AudioEngine` and schedules the returned notes. Selected
  tickers persist to `localStorage` (`candletunes.tickers`, migrated from `candlemusic.tickers`).
- **`audio/AudioEngine.ts`** — wraps Tone.js. Builds one instrument per track (a
  `Tone.Sampler` with Salamander piano samples for `instrument === "piano"`, otherwise a
  `Tone.PolySynth` with an oscillator type from `SYNTH_OSCILLATORS`), all routed through a
  shared `masterVolume` → `recorder` (for audio export) → destination. `schedule()` builds
  a `Tone.Part` from `NoteEvent[]`, firing `onNoteStart`/`onNoteEnd` callbacks (via
  `Tone.Draw`) used to drive the piano keyboard and chart playhead. Also exposes a
  configurable `manualInstrument` for the interactive on-screen piano, with its own
  voice (`setManualVoice`), volume (`setManualVolume`), octave shift
  (`setManualOctaveShift`), and sustain pedal (`setManualSustain`); it is routed through a
  dedicated `manualVolume` node and is *not* torn down by `dispose()` so it survives an
  empty ticker list.
- **`state/playbackStore.ts`** — zustand store for transport state (`isPlaying`,
  `currentTime`) and `activeNotes: Map<track, Set<midiPitch>>`, the latter driving the
  `PianoKeyboard` highlight and per-track note display.
- **`api/queries.ts`** / **`api/client.ts`** / **`api/types.ts`** — TanStack Query hooks
  over an axios client (`VITE_API_BASE_URL`, default `http://localhost:8000`); `types.ts`
  mirrors the backend Pydantic models and must be kept in sync manually.
- **`components/`** — `TickerInput` (ticker list + per-track gear-icon config:
  instrument/scale/root/notes-per-bar/color), `SonifyControls` (global musical params,
  BPM vs. duration mode), `TickerChartPanel` (lightweight-charts candlestick + note
  overlay, one per track), `PianoKeyboard` (interactive + playback-driven), `KeyboardSettings`
  (voice/octave/sustain/volume/computer-keys controls for the interactive piano),
  `TransportControls` (play/pause/seek/volume/MIDI export/audio export), `TopMovers`,
  `DateRangePicker`.

Key invariant: `track` indices in `NoteEvent`/`TrackInfo` correspond positionally to the
`tracks` array in the `SonifyRequest`/response — the frontend keys instruments, colors,
and chart panels by this index.

## AI session history

This repo maintains an AI-collaboration log in `ai_history/` (gitignored, local-only).
Per `AI_INSTRUCTIONS.md`, after any session with significant code/architecture/design
changes: add a new file in `ai_history/sessions/` (named `YYYY-MM-DD_Feature_Name.md`)
documenting the change, link it from `ai_history/index.md`'s Session Log Index, and update
the "Key Architectural Pillars" section there if the architecture shifted.

`docs/musical-features/` tracks the musical features (per-track mixing, octave control,
articulation, harmony, swing, effects, looping) — one file per feature with notes on which
files each touches, sorted into `completed/` and `in-progress/` subdirectories.
See `docs/musical-features/README.md` for the status overview.

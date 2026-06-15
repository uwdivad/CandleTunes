# CandleMusic

> 🎼 **Turn market movement into music.**

![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-pytest-0A9EDC?logo=pytest&logoColor=white)

CandleMusic fetches OHLCV (open/high/low/close/volume) market data, maps it onto a
musical scale, and plays it back as a multi-track composition synced to live candlestick
charts and an on-screen piano. Each ticker becomes a "voice" in the arrangement: price
drives pitch, volume and volatility drive note velocity, and you control the key, scale,
tempo, instruments, and articulation.

**Example session:** add `AAPL`, `MSFT`, and `BTC-USD`, choose a scale and tempo, mix the
tracks, then export the result as MIDI or recorded audio.

---

## 🕯️ How it works

```
 yfinance OHLCV  ──►  pitch / velocity / timing mapping  ──►  NoteEvent[]  ──►  Tone.js playback
   (backend data)        (backend sonify engine)            (JSON over HTTP)     (frontend audio)
```

1. The **FastAPI backend** downloads price history (cached to disk), then converts each
   ticker's series into a flat list of MIDI-like `NoteEvent`s.
2. The **React/TypeScript frontend** POSTs your settings to `/api/sonify`, receives the
   notes, and schedules them through **Tone.js**, highlighting a piano keyboard and a
   chart playhead in time with the audio.

### The sonification model

For each track (ticker):

- **Pitch** — the close price is normalized to `[0, 1]` over its range, blended 70/30 with
  a clipped z-scored log-return signal, then quantized to the nearest note in the selected
  scale (built from `root_note` / `scale` / `register_base_midi` / `pitch_range_semitones`).
- **Velocity** — a blend of normalized volume (60%) and normalized high–low range (40%);
  falls back to pure range-based volatility when volume is all zero (e.g. forex/crypto).
- **Timing** — if a `bpm` is set, each note slot lasts `60 / bpm` seconds; otherwise notes
  are stretched to fill `total_duration_sec`. With `notes_per_bar = 2`, each bar emits two
  notes (open price → close price) within one slot.
- **Registers & instruments** — tracks are auto-assigned cycling registers
  (C4/C3/C5/C2/C6) and instruments (piano for track 0, then cycling synth oscillators),
  unless overridden per track.

Long series (> 1000 bars) are resampled to weekly bars before mapping.

---

## ✨ Features

- 🎵 **Multi-track sonification** — layer multiple tickers as simultaneous voices.
- 🎹 **Live piano + candlestick charts** — keyboard keys and chart playheads light up in
  sync with playback (via Tone.js + lightweight-charts).
- 🎛️ **Musical controls** — root note, scale (major / minor / pentatonic major / pentatonic
  minor / chromatic), notes-per-bar, BPM vs. fixed-duration timing, legato, swing, and
  chord mode (off / triad / power).
- 🎚️ **Per-track studio controls** — override instrument, scale, root, register,
  notes-per-bar, chord mode, and color; adjust volume and pan or mute/solo each ticker.
- 🔗 **Linked or independent timelines** — seek all charts together or unlock a track to
  explore it at a different playback position.
- ⌨️ **Interactive on-screen piano** — play it with mouse or computer keys, with
  configurable voice, octave shift, sustain pedal, and volume.
- 🌊 **Playback effects** — shape the combined output with reverb and delay, then loop the
  composition while tuning the mix.
- 📈 **Top movers** — browse top gainers/losers to pick tickers.
- 💾 **Export** — download the composition as a `.mid` MIDI file or a recorded audio file.

> 🚧 **In progress:** swing is available now; configurable rhythmic rests are tracked in
> [`docs/musical-features/in-progress/05-groove-rhythm.md`](docs/musical-features/in-progress/05-groove-rhythm.md).

---

## 🧰 Tech stack

| Layer    | Technologies |
|----------|--------------|
| Backend  | Python, FastAPI, Pydantic, yfinance, pandas, NumPy, pretty_midi, uvicorn |
| Frontend | React 19, TypeScript, Vite, Tone.js, lightweight-charts, TanStack Query, Zustand, axios |

---

## 🚀 Getting started

### Prerequisites

- **Python 3.11+**
- **Node.js 20.19+ or 22.12+** and npm (required by the locked Vite toolchain)

### 1. Backend — run from `backend/`

```powershell
# Create and activate a venv (first time only)
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run the dev server (reload enabled) at http://localhost:8000
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Interactive API docs are available at <http://localhost:8000/docs>.

### 2. Frontend — run from `frontend/`

```powershell
npm install
npm run dev      # dev server at http://localhost:5173
```

The frontend sends API calls to `VITE_API_BASE_URL` (default `http://localhost:8000`).
Open <http://localhost:5173>, enter one or more tickers, and press play.

For a non-default backend URL, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🧪 Commands

### Backend (from `backend/`)

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --reload   # dev server
.venv\Scripts\python.exe -m pytest                          # run all tests
.venv\Scripts\python.exe -m pytest tests/test_sonify_engine.py   # single file
```

There is no linter/formatter configured for the backend.

### Frontend (from `frontend/`)

```powershell
npm run dev      # dev server (Vite)
npm run build    # tsc -b type-check, then vite build
npm run lint     # eslint .
npm run preview  # preview a production build
```

There is no frontend test runner configured.

---

## 🔌 API reference

All routes are prefixed with `/api`.

| Method | Endpoint                | Description |
|--------|-------------------------|-------------|
| `POST` | `/api/sonify`           | Core endpoint. Takes a `SonifyRequest` (tracks + global musical params), returns a `SonifyResponse` (flat `NoteEvent[]` + per-track `TrackInfo` + total duration). |
| `GET`  | `/api/chart/{ticker}`   | Raw OHLCV bars for the candlestick chart. |
| `POST` | `/api/midi`             | Converts a sonify response's notes/tracks into a downloadable `.mid` file. |
| `GET`  | `/api/movers`           | Top gainers/losers via `yfinance` screening. |
| `GET`  | `/api/health`           | Health check (`{"status": "ok"}`). |

### Example: sonify a request

```bash
curl -X POST http://localhost:8000/api/sonify \
  -H "Content-Type: application/json" \
  -d '{
    "tracks": [
      { "ticker": "AAPL", "start": "2024-01-01", "end": "2024-06-01", "interval": "1d" }
    ],
    "bpm": 120,
    "scale": "pentatonic_major",
    "root_note": 0,
    "notes_per_bar": 1
  }'
```

Key request fields (see `backend/app/models/sonify.py` for the full schema):

- **`SonifyRequest`** — `tracks` (≥1), `bpm`, `total_duration_sec`, `notes_per_bar` (1|2),
  `scale`, `root_note` (0–11), `global_instrument`, `legato` (0.1–1.0), `swing` (0.0–0.5),
  `chord_mode` (`off` | `triad` | `power`).
- **`TrackRequest`** — `ticker`, `start`, `end`, `interval`, plus optional per-track
  overrides for register, pitch range, instrument, scale, root, notes-per-bar, and chord
  mode.

---

## 🗂️ Project structure

```
CandleMusic/
├── backend/
│   └── app/
│       ├── api/            # FastAPI routers: sonify, chart, midi, movers
│       ├── models/         # Pydantic request/response schemas
│       ├── sonify/         # Pure sonification logic: engine, pitch, velocity, scales, midi_export
│       ├── data/           # yfinance client + disk cache
│       ├── config.py       # Settings (cache dir/TTL, CORS, log level)
│       ├── logging_config.py  # @log_call decorator (DEBUG arg/return logging)
│       └── main.py         # App entrypoint + router wiring
└── frontend/
    └── src/
        ├── pages/          # HomePage.tsx — top-level state container & orchestration
        ├── components/     # TickerInput, SonifyControls, charts, PianoKeyboard, transport, …
        ├── audio/          # AudioEngine.ts — Tone.js wrapper
        ├── state/          # playbackStore.ts (zustand)
        └── api/            # TanStack Query hooks, axios client, shared types
```

> **Invariant:** `track` indices in `NoteEvent` / `TrackInfo` correspond positionally to the
> `tracks` array in the request/response — the frontend keys instruments, colors, and chart
> panels by this index.

### Configuration

Backend settings (`backend/app/config.py`, overridable via environment variables):

| Setting | Default | Purpose |
|---------|---------|---------|
| `cache_dir` | `backend/cache/` | Disk cache for OHLCV DataFrames (gitignored). |
| `cache_ttl_seconds` | `3600` | OHLCV cache lifetime (1 hour). |
| `cors_origins` | `["http://localhost:5173"]` | Allowed frontend origins. |
| `log_level` | `INFO` | Set to `DEBUG` to see `@log_call` arg/return logs. |

---

## 📌 Project status

- Market data is fetched via `yfinance`; failed/empty fetches surface as HTTP 502.
- OHLCV responses are cached to disk by a sha256 of `ticker|start|end|interval`.
- `docs/musical-features/` tracks the musical features (mixing, articulation, harmony,
  effects, looping, etc.), one file per feature, sorted into `completed/` and
  `in-progress/` subdirectories — see its `README.md` for a status overview.
- Backend behavior is covered by pytest. The frontend currently relies on TypeScript,
  ESLint, production builds, and manual browser testing; an automated UI test suite is
  still missing.

---

## 📄 License

No license file is currently present in this repository.

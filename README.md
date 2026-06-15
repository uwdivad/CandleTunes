# CandleMusic 🕯️🎶

> **Hear what the market is doing.** CandleMusic turns stock and crypto price history into
> living, multi-track music.

![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

Feed it a few tickers and CandleMusic fetches their OHLCV data, maps it onto a musical
scale, and plays it back as a composition that's locked in sync with live candlestick
charts and an on-screen piano. Every ticker becomes its own **voice**: price picks the
notes, volume and volatility shape how hard they're struck, and you stay in control of the
key, scale, tempo, and instruments.

> 🎧 **Try it:** drop in `AAPL`, `MSFT`, and `BTC-USD`, pick a scale and tempo, balance the
> tracks, then export the result as MIDI or recorded audio.

---

## How it works

```
 yfinance OHLCV  ──►  pitch / velocity / timing mapping  ──►  NoteEvent[]  ──►  Tone.js playback
   (backend data)        (backend sonify engine)            (JSON over HTTP)     (frontend audio)
```

1. The **FastAPI backend** downloads price history (cached to disk) and turns each ticker's
   series into a flat list of MIDI-like `NoteEvent`s.
2. The **React + TypeScript frontend** POSTs your settings to `/api/sonify`, then schedules
   the returned notes through **Tone.js**, lighting up the piano keys and chart playhead in
   time with the audio.

**The mapping, in a nutshell:** a ticker's **close price drives pitch** (quantized to your
chosen scale and key), **volume and price range drive velocity** (loud, choppy days hit
harder), and **timing** follows either a fixed BPM or a target duration. Set notes-per-bar
to 2 and each bar plays its open and close. Very long histories are resampled to weekly bars
so the song stays listenable.

---

## ✨ Features

- 🎵 **Multi-track sonification** — layer multiple tickers as simultaneous voices.
- 🎹 **Live piano + candlestick charts** — keys and chart playheads light up in sync with
  playback.
- 🎛️ **Musical controls** — root note, scale (major, minor, pentatonic major/minor,
  chromatic), notes-per-bar, BPM vs. fixed-duration timing, articulation, swing, and chords
  (triad / power).
- 🎚️ **Per-track studio mixer** — override instrument, scale, root, register, and color per
  ticker, then balance volume, pan, mute, and solo.
- 🔗 **Linked or independent timelines** — scrub all charts together, or unlock a track to
  explore it on its own playhead.
- ⌨️ **Playable on-screen piano** — mouse or computer keys, with voice, octave, sustain, and
  volume.
- 🌊 **Effects + looping** — sweeten the mix with reverb and delay and loop while you tweak.
- 📈 **Top movers** — browse the day's gainers and losers to find tickers.
- 💾 **Export** — save your composition as a `.mid` file or recorded audio.

> 🚧 Swing is live; configurable rhythmic rests are still in progress — see
> [`docs/musical-features/`](docs/musical-features/).

---

## 🧰 Tech stack

| Layer    | Technologies |
|----------|--------------|
| Backend  | Python, FastAPI, Pydantic, yfinance, pandas, NumPy, pretty_midi, uvicorn |
| Frontend | React 19, TypeScript, Vite, Tone.js, lightweight-charts, TanStack Query, Zustand, axios |

---

## 🚀 Getting started

**Prerequisites:** Python 3.11+, and Node.js 20.19+ / 22.12+ with npm.

**Backend** (from `backend/`):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend** (from `frontend/`):

```powershell
npm install
npm run dev      # http://localhost:5173
```

Open <http://localhost:5173>, add a ticker, and press play. Interactive API docs live at
<http://localhost:8000/docs>. The frontend talks to `http://localhost:8000` by default;
point it elsewhere with `VITE_API_BASE_URL` in `frontend/.env.local`.

---

## 🧪 Development

```powershell
# Backend (from backend/)
.venv\Scripts\python.exe -m pytest                          # run tests
.venv\Scripts\python.exe -m pytest tests/test_sonify_engine.py   # single file

# Frontend (from frontend/)
npm run build    # tsc -b type-check, then vite build
npm run lint     # eslint .
```

Backend logic is covered by pytest. The frontend leans on TypeScript, ESLint, and
production builds — there's no automated UI test suite yet.

---

## 🔌 API reference

All routes are prefixed with `/api`.

| Method | Endpoint              | Description |
|--------|-----------------------|-------------|
| `POST` | `/api/sonify`         | Core endpoint. Takes a `SonifyRequest` (tracks + musical params), returns a `SonifyResponse` (`NoteEvent[]` + per-track `TrackInfo` + total duration). |
| `GET`  | `/api/chart/{ticker}` | Raw OHLCV bars for the candlestick chart. |
| `POST` | `/api/midi`           | Renders a sonify response into a downloadable `.mid` file. |
| `GET`  | `/api/movers`         | Top gainers/losers. |
| `GET`  | `/api/health`         | Health check. |

```bash
curl -X POST http://localhost:8000/api/sonify \
  -H "Content-Type: application/json" \
  -d '{
    "tracks": [
      { "ticker": "AAPL", "start": "2024-01-01", "end": "2024-06-01", "interval": "1d" }
    ],
    "bpm": 120,
    "scale": "pentatonic_major",
    "notes_per_bar": 1
  }'
```

See `backend/app/models/sonify.py` for the full request/response schema.

---

## 🗂️ Project structure

```
CandleMusic/
├── backend/app/
│   ├── api/       # FastAPI routers: sonify, chart, midi, movers
│   ├── models/    # Pydantic request/response schemas
│   ├── sonify/    # Sonification core: engine, pitch, velocity, scales, midi_export
│   └── data/      # yfinance client + disk cache
└── frontend/src/
    ├── pages/         # HomePage — top-level state + orchestration
    ├── components/    # Ticker input, controls, charts, piano, transport
    ├── audio/         # AudioEngine — Tone.js wrapper
    ├── state/         # playbackStore (zustand)
    └── api/           # TanStack Query hooks, axios client, shared types
```

`docs/musical-features/` documents each musical feature (one file each), sorted into
`completed/` and `in-progress/`.

---

## 📄 License

Released under the [MIT License](LICENSE).

> ℹ️ Market data comes from Yahoo Finance via `yfinance` for research/educational use —
> review Yahoo's terms before any commercial or redistribution use of the underlying data.
> Audio and MIDI generated from that data are transformative works of the price facts.

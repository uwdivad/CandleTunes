# Repository Guidelines

## Project Structure & Module Organization

CandleTunes sonifies stock and crypto OHLCV data. The FastAPI backend lives in `backend/app/`: API routers are in `api/`, Pydantic schemas in `models/`, market-data and cache code in `data/`, and musical conversion logic in `sonify/`. Backend tests are in `backend/tests/`.

The React/TypeScript frontend lives in `frontend/src/`. Put reusable UI in `components/`, page orchestration in `pages/`, HTTP/query code in `api/`, playback logic in `audio/`, and shared client state in `state/`. Static files belong in `frontend/public/` or `frontend/src/assets/`.

## Build, Test, and Development Commands

Run commands from the indicated subdirectory.

```powershell
# backend/
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m pytest tests/test_scales.py

# frontend/
npm install
npm run dev
npm run build
npm run lint
```

The backend serves `http://localhost:8000`; Vite serves `http://localhost:5173`. `npm run build` performs TypeScript checking before producing the Vite bundle.

## Coding Style & Naming Conventions

Use four-space indentation and `snake_case` for Python functions, modules, and tests. Add type hints to public functions and keep sonification calculations pure where practical. No backend formatter is configured, so follow nearby code and PEP 8.

Use two-space indentation conventions already established by the TypeScript tooling, `PascalCase` for React components, `camelCase` for variables/functions, and `.tsx` for components. Run ESLint before submitting frontend changes. Keep `frontend/src/api/types.ts` synchronized with backend Pydantic models.

## Testing Guidelines

Backend tests use pytest. Name files `test_*.py` and tests `test_<behavior>`. Add focused coverage for pitch, timing, velocity, API validation, and error handling when those behaviors change. The frontend currently has no test runner; validate changes with `npm run build`, `npm run lint`, and a manual browser check.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as `Add backend debug logging...` and `Revamp UI/UX...`. Keep each commit scoped to one coherent change. Pull requests should explain user-visible behavior, list verification commands, link relevant issues, and include screenshots for UI changes. Call out API contract changes explicitly.

## Architecture & Agent Notes

Track indices are positional across requests, responses, instruments, colors, and charts; preserve this invariant. Read `AI_INSTRUCTIONS.md` and `CLAUDE.md` before substantial work. Significant code, architecture, or design changes must also be recorded under `ai_history/sessions/` and linked from `ai_history/index.md`.

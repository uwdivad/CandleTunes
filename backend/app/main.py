from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import assistant, auth, chart, midi, movers, sonify
from app.config import settings
from app.db.engine import init_db
from app.logging_config import log_call


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create assistant_runs / assistant_feedback tables if absent.
    init_db()
    yield


app = FastAPI(title="CandleTunes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(chart.router, prefix="/api")
app.include_router(sonify.router, prefix="/api")
app.include_router(midi.router, prefix="/api")
app.include_router(movers.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")


@app.get("/api/health")
@log_call
def health() -> dict[str, str]:
    return {"status": "ok"}


# Serve the built frontend (present only in the container image). Mounted last so
# the /api/* routes above take precedence; html=True serves index.html at "/".
if settings.static_dir.is_dir():
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

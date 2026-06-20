from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import assistant, auth, chart, midi, movers, sonify
from app.config import settings
from app.db.engine import init_db
from app.logging_config import log_call
from app.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create assistant_runs / assistant_feedback tables if absent.
    init_db()
    yield


app = FastAPI(title="CandleTunes API", lifespan=lifespan)

# Rate limiting: register the shared limiter, return 429 on overflow, and apply
# the default per-client limit to every route via middleware. Added before CORS
# below so CORS stays the outermost layer and 429 responses keep CORS headers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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

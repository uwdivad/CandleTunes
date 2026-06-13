from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chart, midi, movers, sonify
from app.config import settings

app = FastAPI(title="CandleMusic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chart.router, prefix="/api")
app.include_router(sonify.router, prefix="/api")
app.include_router(midi.router, prefix="/api")
app.include_router(movers.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

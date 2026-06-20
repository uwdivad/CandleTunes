from fastapi import APIRouter, HTTPException, Request, Response

from app.config import settings
from app.data.yfinance_client import fetch_ohlcv
from app.logging_config import log_call
from app.models.sonify import SonifyRequest, SonifyResponse
from app.rate_limit import limiter
from app.sonify.engine import sonify_composition

router = APIRouter()


@router.post("/sonify", response_model=SonifyResponse)
@limiter.limit(lambda *_: settings.rate_limit_sonify)
@log_call
def sonify(request: Request, response: Response, req: SonifyRequest) -> SonifyResponse:
    try:
        notes, track_infos, max_duration_sec = sonify_composition(
            req.tracks,
            req.bpm,
            req.total_duration_sec,
            req.notes_per_bar,
            req.scale,
            req.root_note,
            req.global_instrument,
            fetch_ohlcv,
            req.legato,
            req.swing,
            req.chord_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return SonifyResponse(
        notes=notes, tracks=track_infos, total_duration_sec=max_duration_sec
    )

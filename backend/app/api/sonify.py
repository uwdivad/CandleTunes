from fastapi import APIRouter, HTTPException

from app.data.yfinance_client import fetch_ohlcv
from app.logging_config import log_call
from app.models.sonify import SonifyRequest, SonifyResponse
from app.sonify.engine import sonify_composition

router = APIRouter()


@router.post("/sonify", response_model=SonifyResponse)
@log_call
def sonify(request: SonifyRequest) -> SonifyResponse:
    try:
        notes, track_infos, max_duration_sec = sonify_composition(
            request.tracks,
            request.bpm,
            request.total_duration_sec,
            request.notes_per_bar,
            request.scale,
            request.root_note,
            request.global_instrument,
            fetch_ohlcv,
            request.legato,
            request.swing,
            request.chord_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return SonifyResponse(
        notes=notes, tracks=track_infos, total_duration_sec=max_duration_sec
    )

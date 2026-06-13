from fastapi import APIRouter, HTTPException

from app.data.yfinance_client import fetch_ohlcv
from app.models.sonify import SonifyRequest, SonifyResponse
from app.sonify.engine import sonify_composition

router = APIRouter()


@router.post("/sonify", response_model=SonifyResponse)
def sonify(request: SonifyRequest) -> SonifyResponse:
    try:
        notes, track_infos = sonify_composition(
            request.tracks,
            request.total_duration_sec,
            request.notes_per_bar,
            request.scale,
            request.root_note,
            fetch_ohlcv,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return SonifyResponse(
        notes=notes, tracks=track_infos, total_duration_sec=request.total_duration_sec
    )

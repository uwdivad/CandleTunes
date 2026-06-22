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
    notes, track_infos, max_duration_sec, failed = sonify_composition(
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

    # Partial success: surface per-track failures in the response. Only fail the
    # whole request when nothing could be sonified.
    if not track_infos:
        detail = "; ".join(f"{f.ticker}: {f.error}" for f in failed) or "No tracks could be sonified"
        raise HTTPException(status_code=502, detail=detail)

    return SonifyResponse(
        notes=notes,
        tracks=track_infos,
        total_duration_sec=max_duration_sec,
        failed=failed,
    )

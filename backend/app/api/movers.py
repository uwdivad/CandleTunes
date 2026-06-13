from fastapi import APIRouter, HTTPException

from app.data.yfinance_client import fetch_top_movers
from app.models.movers import MoverItem, MoversResponse

router = APIRouter()


def _to_mover_item(quote: dict) -> MoverItem:
    return MoverItem(
        symbol=quote.get("symbol", ""),
        name=quote.get("shortName") or quote.get("longName") or quote.get("symbol", ""),
        price=float(quote.get("regularMarketPrice", 0)),
        change=float(quote.get("regularMarketChange", 0)),
        change_percent=float(quote.get("regularMarketChangePercent", 0)),
        volume=float(quote.get("regularMarketVolume", 0)),
    )


@router.get("/movers", response_model=MoversResponse)
def get_movers() -> MoversResponse:
    try:
        data = fetch_top_movers()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return MoversResponse(
        gainers=[_to_mover_item(q) for q in data["gainers"]],
        losers=[_to_mover_item(q) for q in data["losers"]],
    )

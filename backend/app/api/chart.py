from fastapi import APIRouter, HTTPException

from app.data.yfinance_client import fetch_ohlcv
from app.logging_config import log_call
from app.models.chart import ChartResponse, OHLCVBar

router = APIRouter()


@router.get("/chart/{ticker}", response_model=ChartResponse)
@log_call
def get_chart(ticker: str, start: str, end: str, interval: str = "1d") -> ChartResponse:
    try:
        df = fetch_ohlcv(ticker, start, end, interval)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    bars = [
        OHLCVBar(
            date=str(index.date()),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=float(row["Volume"]),
        )
        for index, row in df.iterrows()
    ]

    return ChartResponse(ticker=ticker, interval=interval, bars=bars)

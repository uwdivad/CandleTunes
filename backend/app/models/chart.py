from pydantic import BaseModel


class OHLCVBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class ChartResponse(BaseModel):
    ticker: str
    interval: str
    bars: list[OHLCVBar]

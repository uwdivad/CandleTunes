from pydantic import BaseModel


class MoverItem(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    volume: float


class MoversResponse(BaseModel):
    gainers: list[MoverItem]
    losers: list[MoverItem]

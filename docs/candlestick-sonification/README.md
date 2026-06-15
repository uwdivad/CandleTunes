# Candlestick-Driven Sonification

Design notes for making the **full candle** (Open / High / Low / Close + direction)
drive note formation, rather than primarily the close price.

Today the data layer already fetches full OHLCV from yfinance, and the chart already
renders candlesticks. But the sonification engine only partially uses the candle:

| Candle component | Current use in note formation |
|---|---|
| **Close** | Primary pitch driver (close → `[0,1]` level, blended 70/30 with z-scored log-returns, quantized to scale). |
| **Open** | Only with `notes_per_bar == 2`: each bar plays **open → close** as two pitches. |
| **High − Low** | Velocity only (40% weight) — wider candle = louder. Never affects pitch. |
| **Volume** | Velocity (60% weight). |
| **Direction** (green/red) | Unused. |

So with `notes_per_bar = 1` you effectively hear a line through the closes; the wicks
(high/low) never move pitch, and bull/bear direction is inaudible.

## Proposals

| # | Proposal | Status |
|---|----------|--------|
| 1 | [OHLC mode (`notes_per_bar = 4`)](proposals/01-ohlc-note-mode.md) | 💡 Idea |
| 2 | [Wick-range pitch accents](proposals/02-wick-pitch-accents.md) | 💡 Idea |
| 3 | [Candle direction → major/minor articulation](proposals/03-direction-articulation.md) | 💡 Idea |

The most idiomatic first step is **#1**, since the two-note open→close path in
`engine.py` (`notes_per_bar == 2`) already establishes the pattern of emitting multiple
pitched notes per bar within one note slot.

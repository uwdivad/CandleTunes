import numpy as np

from app.logging_config import log_call


@log_call
def _normalize(values: np.ndarray) -> np.ndarray:
    vmin, vmax = float(values.min()), float(values.max())
    rng = vmax - vmin
    if rng == 0:
        return np.full_like(values, 0.5, dtype=float)
    return (values - vmin) / rng


@log_call
def compute_velocity(volume: np.ndarray, hl_range_pct: np.ndarray) -> np.ndarray:
    """MIDI velocity (1-127) from a 0.6/0.4 blend of normalized volume and
    normalized high-low range. Falls back to pure volatility if volume is all-zero
    (some forex/crypto tickers report no volume)."""
    hl_norm = _normalize(hl_range_pct)
    if volume.sum() == 0:
        velocity_signal = hl_norm
    else:
        volume_norm = _normalize(volume)
        velocity_signal = 0.6 * volume_norm + 0.4 * hl_norm

    velocity = np.round(40 + velocity_signal * 80)
    return np.clip(velocity, 1, 127).astype(int)

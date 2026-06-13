import numpy as np

from app.logging_config import log_call


@log_call
def compute_log_returns(close: np.ndarray) -> np.ndarray:
    log_returns = np.zeros(len(close))
    if len(close) > 1:
        log_returns[1:] = np.log(close[1:] / close[:-1])
    return log_returns


@log_call
def robust_zscore_clip(values: np.ndarray) -> np.ndarray:
    """Z-score, clipped to [-3, 3] and rescaled to [-1, 1]."""
    mu = values.mean()
    sigma = values.std()
    if sigma == 0:
        sigma = 1e-9
    z = (values - mu) / sigma
    return np.clip(z, -3, 3) / 3.0


@log_call
def normalize_to_range(
    values: np.ndarray, vmin: float | None = None, vmax: float | None = None
) -> np.ndarray:
    """Normalize values to [0, 1] using the given (or values') min/max."""
    if vmin is None:
        vmin = float(values.min())
    if vmax is None:
        vmax = float(values.max())
    price_range = vmax - vmin
    if price_range == 0:
        price_range = 1e-9
    return (values - vmin) / price_range


@log_call
def quantize_pitch(level: float, z_clipped: float, scale_pitches: list[int]) -> int:
    """Combine chart-level position (70%) and return-direction (30%) into a single
    [0,1] signal, then quantize to the nearest pitch in `scale_pitches`."""
    combined = 0.7 * level + 0.3 * ((z_clipped + 1) / 2)
    combined = min(max(combined, 0.0), 1.0)
    m = len(scale_pitches)
    idx = round(combined * (m - 1))
    idx = min(max(idx, 0), m - 1)
    return scale_pitches[idx]

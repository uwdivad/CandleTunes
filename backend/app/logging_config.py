import functools
import logging

from app.config import settings


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # Scope DEBUG logging to this app's own loggers, leaving third-party
    # libraries (yfinance, peewee, etc.) at the root INFO level.
    logging.getLogger("app").setLevel(settings.log_level)


# Configure logging as soon as this module is imported, so @log_call produces
# output regardless of whether app.main has run (e.g. scripts, tests).
configure_logging()


def _truncate(value: object, max_len: int = 200) -> str:
    text = repr(value)
    if len(text) > max_len:
        return f"{text[:max_len]}...(truncated)"
    return text


def log_call(func):
    """Log a function's arguments and return value at DEBUG level."""
    logger = logging.getLogger(func.__module__)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if logger.isEnabledFor(logging.DEBUG):
            params = ", ".join(
                [_truncate(a) for a in args] + [f"{k}={_truncate(v)}" for k, v in kwargs.items()]
            )
            logger.debug("CALL %s(%s)", func.__qualname__, params)
        result = func(*args, **kwargs)
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("RETURN %s -> %s", func.__qualname__, _truncate(result))
        return result

    return wrapper

import functools
import logging
from logging.handlers import TimedRotatingFileHandler

from app.config import settings

_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format=_LOG_FORMAT)
    # Pin the console handler to log_level so DEBUG records propagating up from
    # the "app" logger reach the file handler without also printing to console.
    for handler in logging.getLogger().handlers:
        handler.setLevel(settings.log_level)

    app_logger = logging.getLogger("app")
    # Scope DEBUG logging to this app's own loggers, leaving third-party
    # libraries (yfinance, peewee, etc.) at the root INFO level. The logger
    # level must be the most verbose of any attached handler so records reach
    # the file handler (which may be DEBUG while the console stays INFO).
    levels = [logging.getLevelName(settings.log_level)]
    file_level = settings.log_file_level.strip()
    if file_level:
        levels.append(logging.getLevelName(file_level))
    app_logger.setLevel(min(level for level in levels if isinstance(level, int)))

    # Daily rolling file log, kept separate from the console handler so it can
    # capture DEBUG independently. Guard against duplicate handlers on reimport.
    if file_level and not any(
        isinstance(h, TimedRotatingFileHandler) for h in app_logger.handlers
    ):
        settings.log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = TimedRotatingFileHandler(
            settings.log_dir / "candletunes.log",
            when="midnight",
            backupCount=settings.log_file_backup_count,
            encoding="utf-8",
        )
        file_handler.suffix = "%Y-%m-%d"
        file_handler.setLevel(file_level)
        file_handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        app_logger.addHandler(file_handler)


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

from pydantic import BaseModel


class User(BaseModel):
    """An authenticated Google user, derived from a verified ID token."""

    sub: str  # Google's stable unique account identifier
    email: str
    name: str | None = None
    picture: str | None = None

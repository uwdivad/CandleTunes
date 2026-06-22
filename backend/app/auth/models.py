from pydantic import BaseModel


class User(BaseModel):
    """An authenticated Google user, derived from a verified ID token."""

    sub: str  # Google's stable unique account identifier
    email: str
    name: str | None = None
    picture: str | None = None


class GoogleAuthRequest(BaseModel):
    """Authorization code produced by the frontend's Google auth-code popup flow."""

    code: str


class GoogleAuthResponse(BaseModel):
    """ID token minted by exchanging the auth code, returned to the SPA to use as
    its Bearer credential (verified on every request by get_current_user)."""

    id_token: str

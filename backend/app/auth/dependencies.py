from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.auth.models import User
from app.config import settings

# Reusable verifier for the Google certs, cached across requests.
_request_transport = google_requests.Request()

# auto_error=False so a missing header yields our own 401 (with a clear message)
# rather than FastAPI's default 403.
_bearer = HTTPBearer(auto_error=False)


# NOTE: intentionally NOT wrapped in @log_call — that decorator logs arguments at
# DEBUG, and the argument here is a raw ID token that must never reach the logs.
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    """FastAPI dependency: require a valid Google ID token and return the user.

    Add `user: User = Depends(get_current_user)` to any endpoint to gate it
    behind a signed-in Google account.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured (GOOGLE_CLIENT_ID unset).",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = id_token.verify_oauth2_token(
            credentials.credentials,
            _request_transport,
            settings.google_client_id,
        )
    except ValueError:
        # Bad signature, wrong audience, expired, malformed, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not payload.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified.",
        )

    return User(
        sub=payload["sub"],
        email=payload["email"],
        name=payload.get("name"),
        picture=payload.get("picture"),
    )

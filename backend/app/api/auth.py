import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.auth.models import GoogleAuthRequest, GoogleAuthResponse, User
from app.config import settings
from app.logging_config import log_call

router = APIRouter()
logger = logging.getLogger(__name__)

# Google's OAuth 2.0 token endpoint, used to exchange an authorization code.
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


@router.get("/auth/me")
@log_call
def me(user: User = Depends(get_current_user)) -> User:
    """Return the signed-in user. Protected — serves as the reference example
    of gating an endpoint behind Google sign-in."""
    return user


# NOTE: intentionally NOT wrapped in @log_call — the request carries a one-time
# OAuth authorization code and the response carries an ID token; neither secret
# should reach the DEBUG arg/return log.
@router.post("/auth/google", response_model=GoogleAuthResponse)
def google_auth(req: GoogleAuthRequest) -> GoogleAuthResponse:
    """Exchange a Google authorization code (from the custom sign-in button's
    auth-code popup flow) for an ID token.

    The frontend's `useGoogleLogin({ flow: "auth-code" })` popup hands back a
    one-time code instead of an ID token; only this server-side exchange (which
    needs the client *secret*) can turn it into the ID token. The token is then
    stored and sent as the Bearer credential exactly like the old GSI flow, so
    `get_current_user` is unchanged.
    """
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured (GOOGLE_CLIENT_ID/SECRET unset).",
        )

    try:
        resp = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": req.code,
                # .strip() guards against a client id/secret stored with a stray
                # trailing newline (a common Secret Manager mistake) — Google
                # rejects those with invalid_client.
                "client_id": settings.google_client_id.strip(),
                "client_secret": settings.google_client_secret.strip(),
                # The JS popup auth-code flow performs no real redirect; Google
                # requires this sentinel value when exchanging a code minted
                # that way.
                "redirect_uri": "postmessage",
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Google's token endpoint.",
        ) from exc

    if resp.status_code != 200:
        # invalid_grant (expired/reused code), redirect_uri_mismatch,
        # invalid_client (wrong/malformed secret), etc. The OAuth error codes
        # aren't sensitive, so log the detail and surface the short code to the
        # caller — it's the only way to tell these failure modes apart.
        try:
            err = resp.json()
        except ValueError:
            err = {}
        code = err.get("error", "unknown")
        logger.warning(
            "Google code exchange failed: status=%s error=%s description=%s",
            resp.status_code,
            code,
            err.get("error_description"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authorization code exchange failed ({code}).",
        )

    id_token = resp.json().get("id_token")
    if not id_token:
        # The code was granted without the openid scope, so no ID token came back.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google did not return an ID token.",
        )

    return GoogleAuthResponse(id_token=id_token)

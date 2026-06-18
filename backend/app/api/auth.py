from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.logging_config import log_call

router = APIRouter()


@router.get("/auth/me")
@log_call
def me(user: User = Depends(get_current_user)) -> User:
    """Return the signed-in user. Protected — serves as the reference example
    of gating an endpoint behind Google sign-in."""
    return user

"""Shared FastAPI dependencies."""
from typing import Optional

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from .database import get_db
from .exceptions import AppError
from .models import User
from .services.auth import user_for_token


def get_token(authorization: Optional[str] = Header(default=None)) -> str:
    """The session token from "Authorization: Bearer <token>"."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    raise AppError(401, "not_authenticated", "Please sign in to continue.")


def get_current_user(token: str = Depends(get_token), db: Session = Depends(get_db)) -> User:
    """The signed-in user. Every protected endpoint depends on this."""
    user = user_for_token(db, token)
    if user is None:
        raise AppError(401, "not_authenticated", "Your session has expired. Please sign in again.")
    return user

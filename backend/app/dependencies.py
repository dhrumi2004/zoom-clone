"""Shared FastAPI dependencies."""
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DEFAULT_USER_EMAIL
from .database import get_db
from .exceptions import AppError
from .models import User


def get_current_user(db: Session = Depends(get_db)) -> User:
    """No login in this app: the seeded default user is always the signed-in user."""
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        raise AppError(500, "no_default_user", "Default user missing. Run: python -m app.seed --reset")
    return user

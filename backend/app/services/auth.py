"""Accounts and sign-in sessions."""
from datetime import timedelta
from typing import Optional, Tuple

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import SESSION_DAYS
from ..exceptions import AppError
from ..models import AuthSession, Channel, ChannelMember, ChannelType, User, UserProfile, UserSettings
from ..security import hash_password, hash_token, new_session_token, verify_password
from ..utils import random_avatar_color, utcnow
from .codes import generate_unique_meeting_code


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_session(db: Session, user: User) -> str:
    """Start a sign-in session; returns the token for the browser to keep."""
    token = new_session_token()
    db.add(AuthSession(user_id=user.id, token_hash=hash_token(token), expires_at=utcnow() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def signup(db: Session, name: str, email: str, password: str) -> Tuple[User, str]:
    email = normalize_email(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise AppError(409, "email_taken", "An account with this email already exists. Try signing in.")
    user = User(
        name=name,
        email=email,
        avatar_color=random_avatar_color(),
        personal_meeting_id=generate_unique_meeting_code(db),
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()
    db.add_all([UserSettings(user_id=user.id), UserProfile(user_id=user.id)])
    # Everyone joins the company-wide #general channel, like a new Zoom Workplace member.
    general = db.scalar(select(Channel).where(Channel.type == ChannelType.CHANNEL, Channel.name == "general"))
    if general is not None:
        db.add(ChannelMember(channel_id=general.id, user_id=user.id))
    db.commit()
    return user, create_session(db, user)


def login(db: Session, email: str, password: str) -> Tuple[User, str]:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    # Same message whether the email or the password is wrong, so emails can't be discovered.
    if user is None or not user.password_hash or not verify_password(password, user.password_hash):
        raise AppError(401, "invalid_credentials", "Incorrect email or password.")
    return user, create_session(db, user)


def logout(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    db.commit()


def user_for_token(db: Session, token: Optional[str]) -> Optional[User]:
    """The signed-in user for a session token, or None if it's unknown or expired."""
    if not token:
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is None:
        return None
    if session.expires_at <= utcnow():
        db.delete(session)
        db.commit()
        return None
    return session.user

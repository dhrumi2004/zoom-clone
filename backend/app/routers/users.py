from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import UserOut
from ..schemas.workspace import Badges, ProfileOut, ProfileUpdate, UserSettingsOut, UserSettingsUpdate
from ..services import mail as mail_service
from ..services import profile as service
from ..services import team_chat as chat_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> User:
    return service.update_profile(db, user, data)


@router.get("/me/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.get_profile(db, user)


@router.get("/me/settings", response_model=UserSettingsOut)
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.get_settings(db, user)


@router.patch("/me/settings", response_model=UserSettingsOut)
def update_settings(data: UserSettingsUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.update_settings(db, user, data)


@router.get("/me/badges", response_model=Badges)
def badges(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Unread counts for the Team Chat and Mail tabs."""
    return {"chat_unread": chat_service.unread_total(db, user), "mail_unread": mail_service.unread_inbox(db, user)}

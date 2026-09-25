"""Profile and personal settings of the signed-in user."""
from sqlalchemy.orm import Session

from ..models import User, UserProfile, UserSettings
from ..schemas.workspace import ProfileUpdate, UserSettingsUpdate


def get_profile(db: Session, user: User) -> UserProfile:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()
    return profile


def update_profile(db: Session, user: User, data: ProfileUpdate) -> User:
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "avatar_color"):
        if changes.get(field):
            setattr(user, field, changes[field])
    profile = get_profile(db, user)
    for field in ("job_title", "department", "phone", "location"):
        if field in changes:
            setattr(profile, field, changes[field] or None)
    db.commit()
    return user


def get_settings(db: Session, user: User) -> UserSettings:
    settings = db.get(UserSettings, user.id)
    if settings is None:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
    return settings


def update_settings(db: Session, user: User, data: UserSettingsUpdate) -> UserSettings:
    settings = get_settings(db, user)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(settings, field, value)
    db.commit()
    return settings

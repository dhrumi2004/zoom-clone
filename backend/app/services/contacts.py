"""Contacts: everyone in the directory, with the signed-in user's favorites."""
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..exceptions import NotFoundError
from ..models import Contact, User, UserProfile


def _to_out(user: User, profile: UserProfile, favorite: bool) -> dict:
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_color": user.avatar_color,
        "personal_meeting_id": user.personal_meeting_id,
        "is_favorite": favorite,
        "job_title": profile.job_title if profile else None,
        "department": profile.department if profile else None,
        "phone": profile.phone if profile else None,
        "location": profile.location if profile else None,
    }


def list_contacts(db: Session, owner: User) -> List[dict]:
    rows = db.execute(
        select(User, UserProfile, Contact.is_favorite)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .outerjoin(Contact, (Contact.contact_id == User.id) & (Contact.owner_id == owner.id))
        .where(User.id != owner.id)
        .order_by(User.name)
    ).all()
    return [_to_out(user, profile, bool(fav)) for user, profile, fav in rows]


def set_favorite(db: Session, owner: User, contact_id: int, favorite: bool) -> dict:
    user = db.get(User, contact_id)
    if user is None or user.id == owner.id:
        raise NotFoundError("Contact not found.")
    contact = db.scalar(select(Contact).where(Contact.owner_id == owner.id, Contact.contact_id == contact_id))
    if contact is None:
        contact = Contact(owner_id=owner.id, contact_id=contact_id)
        db.add(contact)
    contact.is_favorite = favorite
    db.commit()
    return _to_out(user, db.get(UserProfile, user.id), favorite)

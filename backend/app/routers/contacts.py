from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas.workspace import ContactOut, ContactUpdate
from ..services import contacts as service

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=List[ContactOut])
def list_contacts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_contacts(db, user)


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: int, data: ContactUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.set_favorite(db, user, contact_id, data.is_favorite)

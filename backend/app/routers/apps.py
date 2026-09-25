from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas.workspace import AppOut
from ..services import apps as service

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.get("", response_model=List[AppOut])
def list_apps(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_apps(db, user)


@router.put("/{key}", response_model=AppOut)
def install(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.set_installed(db, user, key, True)


@router.delete("/{key}", response_model=AppOut)
def uninstall(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.set_installed(db, user, key, False)

from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas.workspace import EmailCreate, EmailOut, EmailUpdate, MailList
from ..services import mail as service

router = APIRouter(prefix="/api/mail", tags=["mail"])


@router.get("", response_model=MailList)
def list_mail(
    folder: str = Query("inbox", pattern="^(inbox|sent|starred|trash)$"),
    q: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return {"items": service.list_mail(db, user, folder, q), "unread_inbox": service.unread_inbox(db, user)}


@router.post("", response_model=EmailOut, status_code=status.HTTP_201_CREATED)
def send(data: EmailCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.send_email(db, user, data)


@router.patch("/{email_id}", response_model=EmailOut)
def update(email_id: int, data: EmailUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.update_email(db, user, email_id, data)


@router.delete("/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(email_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    service.delete_email(db, user, email_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Mail: the signed-in user's mailbox. Sending stores a copy in Sent (and in the Inbox if sent to yourself)."""
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..exceptions import NotFoundError
from ..models import Email, MailFolder, User
from ..schemas.workspace import EmailCreate, EmailUpdate
from ..utils import utcnow

FOLDERS = {"inbox", "sent", "starred", "trash"}


def list_mail(db: Session, me: User, folder: str, query: Optional[str]) -> List[Email]:
    stmt = select(Email).where(Email.owner_id == me.id)
    if folder == "starred":
        stmt = stmt.where(Email.is_starred.is_(True), Email.folder != MailFolder.TRASH)
    else:
        stmt = stmt.where(Email.folder == MailFolder(folder if folder in FOLDERS else "inbox"))
    if query:
        like = f"%{query.strip()}%"
        stmt = stmt.where(or_(Email.subject.ilike(like), Email.body.ilike(like), Email.from_name.ilike(like), Email.to_emails.ilike(like)))
    return list(db.scalars(stmt.order_by(Email.sent_at.desc())).all())


def unread_inbox(db: Session, me: User) -> int:
    return db.scalar(
        select(func.count(Email.id)).where(Email.owner_id == me.id, Email.folder == MailFolder.INBOX, Email.is_read.is_(False))
    ) or 0


def get_email(db: Session, me: User, email_id: int) -> Email:
    email = db.get(Email, email_id)
    if email is None or email.owner_id != me.id:
        raise NotFoundError("Message not found.")
    return email


def send_email(db: Session, me: User, data: EmailCreate) -> Email:
    recipients = [str(r).lower() for r in data.to]
    common = dict(
        from_name=me.name,
        from_email=me.email,
        to_emails=", ".join(recipients),
        subject=data.subject.strip() or "(no subject)",
        body=data.body,
        sent_at=utcnow(),
    )
    sent = Email(owner_id=me.id, folder=MailFolder.SENT, is_read=True, **common)
    db.add(sent)
    if me.email.lower() in recipients:
        db.add(Email(owner_id=me.id, folder=MailFolder.INBOX, is_read=False, **common))
    db.commit()
    return sent


def update_email(db: Session, me: User, email_id: int, data: EmailUpdate) -> Email:
    email = get_email(db, me, email_id)
    if data.is_read is not None:
        email.is_read = data.is_read
    if data.is_starred is not None:
        email.is_starred = data.is_starred
    if data.action == "trash" and email.folder != MailFolder.TRASH:
        email.original_folder, email.folder = email.folder, MailFolder.TRASH
    elif data.action == "restore" and email.folder == MailFolder.TRASH:
        email.folder, email.original_folder = email.original_folder or MailFolder.INBOX, None
    db.commit()
    return email


def delete_email(db: Session, me: User, email_id: int) -> None:
    """Permanent delete (from Trash)."""
    db.delete(get_email(db, me, email_id))
    db.commit()

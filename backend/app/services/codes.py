"""Unique ID generation that checks the database for collisions."""
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from ..models import Meeting, User
from ..utils import generate_numeric_code


def generate_unique_meeting_code(db: Session) -> str:
    """10-digit Meeting ID not used by any meeting or Personal Meeting ID."""
    while True:
        code = generate_numeric_code(10)
        taken = db.scalar(
            select(
                or_(
                    exists().where(Meeting.meeting_code == code),
                    exists().where(User.personal_meeting_id == code),
                )
            )
        )
        if not taken:
            return code

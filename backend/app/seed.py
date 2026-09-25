"""Sample data for the dashboard.

Runs automatically on startup when the database is empty.
Reset manually with:  python -m app.seed --reset
"""
import sys
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DEFAULT_USER_EMAIL, DEFAULT_USER_NAME
from .database import Base, SessionLocal, engine
from .models import (
    ChatMessage,
    Meeting,
    MeetingSettings,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    User,
)
from .seed_workspace import seed_workspace_if_empty
from .services.codes import generate_unique_meeting_code
from .utils import AVATAR_COLORS, generate_passcode, utcnow

COLLEAGUES = [
    ("Aarav Shah", "aarav@zoomclone.dev"),
    ("Priya Patel", "priya@zoomclone.dev"),
    ("Rohan Mehta", "rohan@zoomclone.dev"),
    ("Sneha Iyer", "sneha@zoomclone.dev"),
    ("Karan Verma", "karan@zoomclone.dev"),
]

# (title, description, days from now, hour offset from next full hour, duration)
UPCOMING = [
    ("Design Sync", "Review new dashboard mockups.", 0, 2, 30),
    ("Daily Standup", "Quick updates: yesterday, today, blockers.", 1, 0, 15),
    ("Product Roadmap Review", "Q4 priorities and timeline.", 1, 4, 60),
    ("1:1 with Priya", None, 2, 1, 30),
    ("Client Demo - Acme Corp", "Walkthrough of the new meeting features.", 4, 3, 45),
    ("Sprint Planning", "Plan sprint 24 and estimate stories.", 7, 0, 90),
]

# (title, type, days ago, length in minutes, colleague indexes, guest names, chat lines)
RECENT = [
    (
        "Weekly Team Sync", MeetingType.SCHEDULED, 1, 42, [0, 1, 2], ["Alex (Guest)"],
        [(1, "Morning everyone!"), (0, "Sharing my screen now"), (None, "Thanks, notes will be in the doc.")],
    ),
    ("Quick call", MeetingType.INSTANT, 2, 12, [3], [], [(3, "Can you hear me?"), (None, "Yes, loud and clear")]),
    ("Bug Bash", MeetingType.SCHEDULED, 3, 65, [0, 2, 4], [], [(4, "Found one in the join flow")]),
    ("Interview - Frontend Engineer", MeetingType.SCHEDULED, 5, 50, [1], ["Candidate"], []),
    ("Instant Meeting", MeetingType.INSTANT, 6, 20, [2, 4], [], []),
]


def _next_full_hour(now: datetime) -> datetime:
    return now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)


def _create_user(db: Session, name: str, email: str, color: str) -> User:
    user = User(
        name=name,
        email=email,
        avatar_color=color,
        personal_meeting_id=generate_unique_meeting_code(db),
    )
    db.add(user)
    db.flush()  # makes the PMI visible to the next uniqueness check
    return user


def _create_meeting(db: Session, host: User, title: str, type_: MeetingType, **fields) -> Meeting:
    meeting = Meeting(
        meeting_code=generate_unique_meeting_code(db),
        title=title,
        host=host,
        type=type_,
        passcode=generate_passcode(),
        settings=MeetingSettings(),
        **fields,
    )
    db.add(meeting)
    db.flush()
    return meeting


def _add_past_session(
    meeting: Meeting,
    host: User,
    colleagues: List[User],
    attendee_idx: List[int],
    guest_names: List[str],
    chat: List[Tuple[Optional[int], str]],
) -> None:
    """Attach participants and chat to an ended meeting. Chat sender None = the host."""
    start, end = meeting.started_at, meeting.ended_at
    host_row = Participant(
        user=host, display_name=host.name, role=ParticipantRole.HOST, joined_at=start, left_at=end
    )
    meeting.participants.append(host_row)

    by_index = {}
    for offset, idx in enumerate(attendee_idx):
        user = colleagues[idx]
        row = Participant(
            user=user, display_name=user.name, joined_at=start + timedelta(minutes=offset + 1), left_at=end
        )
        meeting.participants.append(row)
        by_index[idx] = row
    for name in guest_names:
        meeting.participants.append(
            Participant(display_name=name, joined_at=start + timedelta(minutes=3), left_at=end)
        )

    for i, (sender_idx, text) in enumerate(chat):
        sender = host_row if sender_idx is None else by_index[sender_idx]
        meeting.messages.append(
            ChatMessage(sender=sender, content=text, sent_at=start + timedelta(minutes=5 + i * 2))
        )


def seed(db: Session) -> None:
    now = utcnow()

    host = _create_user(db, DEFAULT_USER_NAME, DEFAULT_USER_EMAIL, AVATAR_COLORS[0])
    colleagues = [
        _create_user(db, name, email, AVATAR_COLORS[i % len(AVATAR_COLORS)])
        for i, (name, email) in enumerate(COLLEAGUES, start=1)
    ]

    base = _next_full_hour(now)
    for title, description, days, hours, duration in UPCOMING:
        _create_meeting(
            db, host, title, MeetingType.SCHEDULED,
            description=description,
            status=MeetingStatus.SCHEDULED,
            scheduled_start=base + timedelta(days=days, hours=hours),
            duration_min=duration,
        )

    for title, type_, days_ago, length, attendee_idx, guests, chat in RECENT:
        started = (now - timedelta(days=days_ago)).replace(hour=10, minute=0, second=0, microsecond=0)
        meeting = _create_meeting(
            db, host, title, type_,
            status=MeetingStatus.ENDED,
            scheduled_start=started if type_ == MeetingType.SCHEDULED else None,
            duration_min=60 if type_ == MeetingType.SCHEDULED else None,
            started_at=started,
            ended_at=started + timedelta(minutes=length),
        )
        _add_past_session(meeting, host, colleagues, attendee_idx, guests, chat)

    db.commit()


def seed_if_empty(db: Session) -> bool:
    """Seed whatever is empty: meetings/users on a fresh database, workspace data (chat, mail, docs...)
    also for databases created before those features existed. Returns True if data was inserted."""
    inserted = False
    if db.scalar(select(User.id).limit(1)) is None:
        seed(db)
        inserted = True
    return seed_workspace_if_empty(db) or inserted


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
        seed_workspace_if_empty(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_database()
        print("Database reset and seeded.")
    else:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            print("Seeded." if seed_if_empty(db) else "Database already has data, nothing to do.")

"""Meeting business logic. Routers stay thin and call these functions."""
from datetime import timedelta
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..exceptions import AppError, NotFoundError
from ..models import (
    Meeting,
    MeetingSettings,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    User,
)
from ..schemas import InstantMeetingCreate, JoinRequest, ScheduledMeetingCreate, ScheduledMeetingUpdate
from ..utils import generate_passcode, utcnow
from .codes import generate_unique_meeting_code

# Scheduling slightly in the past is allowed so a form submitted at 10:00:30 for "10:00" still works.
SCHEDULE_GRACE = timedelta(minutes=5)
RECENT_LIMIT = 20


def normalize_code(raw: str) -> str:
    """'123 456 7890' or '123-456-7890' -> '1234567890'."""
    return "".join(ch for ch in raw if ch.isdigit())


def get_meeting_or_404(db: Session, raw_code: str) -> Meeting:
    meeting = db.scalar(
        select(Meeting)
        .where(Meeting.meeting_code == normalize_code(raw_code))
        .options(selectinload(Meeting.host), selectinload(Meeting.settings))
    )
    if meeting is None:
        raise NotFoundError("This meeting ID is not valid. Please check and try again.")
    return meeting


def require_owner(meeting: Meeting, user: User) -> None:
    if meeting.host_id != user.id:
        raise AppError(403, "not_host", "Only the host can do this.")


# ---------- Create ----------

def create_instant_meeting(db: Session, host: User, data: InstantMeetingCreate) -> Meeting:
    """Instant meetings go live immediately; the host joins right after via join_meeting."""
    now = utcnow()
    meeting = Meeting(
        meeting_code=generate_unique_meeting_code(db),
        title=data.title or f"{host.name}'s Zoom Meeting",
        host=host,
        type=MeetingType.INSTANT,
        status=MeetingStatus.LIVE,
        passcode=generate_passcode(),
        started_at=now,
        settings=MeetingSettings(**data.settings.model_dump()),
    )
    db.add(meeting)
    db.commit()
    return meeting


def schedule_meeting(db: Session, host: User, data: ScheduledMeetingCreate) -> Meeting:
    if data.scheduled_start < utcnow() - SCHEDULE_GRACE:
        raise AppError(422, "start_in_past", "The meeting start time must be in the future.")
    meeting = Meeting(
        meeting_code=generate_unique_meeting_code(db),
        title=data.title.strip(),
        description=data.description,
        host=host,
        type=MeetingType.SCHEDULED,
        status=MeetingStatus.SCHEDULED,
        scheduled_start=data.scheduled_start,
        duration_min=data.duration_min,
        passcode=data.passcode or generate_passcode(),
        settings=MeetingSettings(**data.settings.model_dump()),
    )
    db.add(meeting)
    db.commit()
    return meeting


# ---------- Update / delete ----------

def update_scheduled_meeting(db: Session, user: User, raw_code: str, data: ScheduledMeetingUpdate) -> Meeting:
    meeting = get_meeting_or_404(db, raw_code)
    require_owner(meeting, user)
    if meeting.status != MeetingStatus.SCHEDULED:
        raise AppError(409, "not_editable", "Only meetings that haven't started can be edited.")

    changes = data.model_dump(exclude_unset=True, exclude={"settings"})
    if "scheduled_start" in changes and changes["scheduled_start"] < utcnow() - SCHEDULE_GRACE:
        raise AppError(422, "start_in_past", "The meeting start time must be in the future.")
    for field, value in changes.items():
        if value is not None or field == "description":
            setattr(meeting, field, value)
    if data.settings is not None:
        for field, value in data.settings.model_dump().items():
            setattr(meeting.settings, field, value)

    db.commit()
    return meeting


def delete_meeting(db: Session, user: User, raw_code: str) -> None:
    meeting = get_meeting_or_404(db, raw_code)
    require_owner(meeting, user)
    if meeting.status == MeetingStatus.LIVE:
        raise AppError(409, "meeting_live", "End the meeting before deleting it.")
    db.delete(meeting)
    db.commit()


# ---------- Dashboard lists ----------

def list_upcoming(db: Session, user: User) -> List[Meeting]:
    """Live meetings first, then scheduled ones whose planned end is still in the future."""
    now = utcnow()
    meetings = db.scalars(
        select(Meeting)
        .where(Meeting.host_id == user.id, Meeting.status.in_([MeetingStatus.LIVE, MeetingStatus.SCHEDULED]))
        .options(selectinload(Meeting.host), selectinload(Meeting.settings), selectinload(Meeting.participants))
    ).all()
    visible = [m for m in meetings if m.status == MeetingStatus.LIVE or (m.end_time and m.end_time > now)]
    return sorted(visible, key=lambda m: (m.status != MeetingStatus.LIVE, m.scheduled_start or m.started_at))


def list_recent(db: Session, user: User) -> List[Meeting]:
    """Ended meetings the user hosted or attended, newest first."""
    attended = select(Participant.meeting_id).where(Participant.user_id == user.id)
    return list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.status == MeetingStatus.ENDED,
                or_(Meeting.host_id == user.id, Meeting.id.in_(attended)),
            )
            .order_by(Meeting.ended_at.desc())
            .limit(RECENT_LIMIT)
            .options(selectinload(Meeting.host), selectinload(Meeting.settings), selectinload(Meeting.participants))
        ).all()
    )


# ---------- Join / leave / end ----------

def check_can_join(meeting: Meeting, passcode: Optional[str], is_host: bool) -> None:
    """Guests need a meeting that hasn't ended and the right passcode. The host needs neither."""
    if is_host:
        return
    if meeting.status == MeetingStatus.ENDED:
        raise AppError(410, "meeting_ended", "This meeting has ended.")
    if passcode != meeting.passcode:
        if not passcode:
            raise AppError(401, "passcode_required", "Please enter the meeting passcode.")
        raise AppError(401, "wrong_passcode", "Wrong passcode. Please try again.")


def verify_join(db: Session, raw_code: str, passcode: Optional[str]) -> Meeting:
    """Same checks as joining as a guest, without creating a participant (used by the Join dialog)."""
    meeting = get_meeting_or_404(db, raw_code)
    check_can_join(meeting, passcode, is_host=False)
    return meeting


def join_meeting(db: Session, user: User, raw_code: str, data: JoinRequest) -> Participant:
    meeting = get_meeting_or_404(db, raw_code)
    is_host = data.as_host and meeting.host_id == user.id

    if data.as_host and not is_host:
        raise AppError(403, "not_host", "Only the host can start this meeting.")
    check_can_join(meeting, data.passcode, is_host)

    now = utcnow()
    if meeting.status != MeetingStatus.LIVE:
        # First join starts the meeting (or restarts an ended one for the host).
        meeting.status = MeetingStatus.LIVE
        meeting.started_at = now
        meeting.ended_at = None

    settings = meeting.settings
    participant = Participant(
        meeting=meeting,
        user_id=user.id if is_host else None,
        display_name=data.display_name,
        role=ParticipantRole.HOST if is_host else ParticipantRole.PARTICIPANT,
        joined_at=now,
        is_muted=settings.mute_on_entry and not is_host,
        is_video_off=not (settings.host_video_on if is_host else settings.participant_video_on),
    )
    db.add(participant)
    db.commit()
    return participant


def _active_in(meeting: Meeting):
    """WHERE clause for people currently in the meeting."""
    return (
        Participant.meeting_id == meeting.id,
        Participant.left_at.is_(None),
        Participant.is_removed.is_(False),
    )


def list_active_participants(db: Session, raw_code: str) -> List[Participant]:
    meeting = get_meeting_or_404(db, raw_code)
    return list(db.scalars(select(Participant).where(*_active_in(meeting)).order_by(Participant.joined_at)).all())


def _active_count(db: Session, meeting: Meeting) -> int:
    return db.scalar(select(func.count(Participant.id)).where(*_active_in(meeting))) or 0


def leave_meeting(db: Session, raw_code: str, participant_id: int) -> Meeting:
    """Mark one participant as gone. The meeting ends automatically when the last person leaves."""
    meeting = get_meeting_or_404(db, raw_code)
    participant: Optional[Participant] = db.get(Participant, participant_id)
    if participant is None or participant.meeting_id != meeting.id:
        raise NotFoundError("Participant not found in this meeting.")

    now = utcnow()
    if participant.left_at is None:
        participant.left_at = now
    db.flush()
    if meeting.status == MeetingStatus.LIVE and _active_count(db, meeting) == 0:
        meeting.status = MeetingStatus.ENDED
        meeting.ended_at = now
    db.commit()
    return meeting


def end_meeting(db: Session, user: User, raw_code: str) -> Meeting:
    """Host's "End meeting for all": everyone is marked as left."""
    meeting = get_meeting_or_404(db, raw_code)
    require_owner(meeting, user)
    return finish_meeting(db, meeting)


def finish_meeting(db: Session, meeting: Meeting) -> Meeting:
    """Mark a live meeting and everyone still in it as finished. Shared by REST and WebSocket."""
    if meeting.status != MeetingStatus.LIVE:
        raise AppError(409, "not_live", "This meeting is not in progress.")

    now = utcnow()
    for participant in meeting.participants:
        if participant.left_at is None:
            participant.left_at = now
    meeting.status = MeetingStatus.ENDED
    meeting.ended_at = now
    db.commit()
    return meeting

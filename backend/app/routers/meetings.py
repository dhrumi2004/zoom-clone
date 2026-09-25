"""HTTP layer for meetings. Business rules live in services/meetings.py."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Meeting, Participant, User
from ..schemas import (
    InstantMeetingCreate,
    JoinRequest,
    JoinResponse,
    LeaveRequest,
    MeetingOut,
    MeetingPublic,
    ParticipantList,
    ScheduledMeetingCreate,
    ScheduledMeetingUpdate,
    VerifyRequest,
)
from ..realtime.manager import manager
from ..services import meetings as service

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


# Dashboard lists (declared before /{code} so they aren't treated as a meeting code)
@router.get("/upcoming", response_model=List[MeetingOut])
def upcoming(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> List[Meeting]:
    return service.list_upcoming(db, user)


@router.get("/recent", response_model=List[MeetingOut])
def recent(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> List[Meeting]:
    return service.list_recent(db, user)


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


@router.get("/calendar", response_model=List[MeetingOut])
def calendar(
    start: datetime = Query(..., description="Range start (ISO, any timezone)"),
    end: datetime = Query(..., description="Range end (ISO, any timezone)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Meeting]:
    return service.list_in_range(db, user, _naive_utc(start), _naive_utc(end))


@router.post("/instant", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def create_instant(
    data: InstantMeetingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Meeting:
    return service.create_instant_meeting(db, user, data)


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def schedule(
    data: ScheduledMeetingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Meeting:
    return service.schedule_meeting(db, user, data)


@router.get("/{code}", response_model=MeetingPublic)
def get_meeting(code: str, db: Session = Depends(get_db)) -> Meeting:
    """Public (no sign-in): an invite link shows the meeting's title before asking you to sign in."""
    return service.get_meeting_or_404(db, code)


@router.get("/{code}/details", response_model=MeetingOut)
def get_meeting_details(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Meeting:
    """Owner-only view with passcode and invite link (edit form, in-meeting "Invite" popup)."""
    meeting = service.get_meeting_or_404(db, code)
    service.require_owner(meeting, user)
    return meeting


@router.patch("/{code}", response_model=MeetingOut)
def update_meeting(
    code: str,
    data: ScheduledMeetingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Meeting:
    return service.update_scheduled_meeting(db, user, code, data)


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    service.delete_meeting(db, user, code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{code}/verify", response_model=MeetingPublic)
def verify(
    code: str, data: VerifyRequest, db: Session = Depends(get_db), _user: User = Depends(get_current_user)
) -> Meeting:
    """Check the meeting exists, hasn't ended and the passcode is right, before showing the pre-join screen."""
    return service.verify_join(db, code, data.passcode, locked=manager.is_locked(service.normalize_code(code)))


@router.post("/{code}/join", response_model=JoinResponse)
def join(
    code: str, data: JoinRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    locked = manager.is_locked(service.normalize_code(code))  # the host's Security > Lock meeting
    participant: Participant = service.join_meeting(db, user, code, data, locked=locked)
    return {"participant": participant, "meeting": participant.meeting}


@router.post("/{code}/leave", response_model=MeetingPublic)
def leave(
    code: str, data: LeaveRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Meeting:
    service.get_own_participant(db, code, data.participant_id, user)
    return service.leave_meeting(db, code, data.participant_id)


@router.post("/{code}/end", response_model=MeetingOut)
def end(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Meeting:
    return service.end_meeting(db, user, code)


@router.get("/{code}/participants", response_model=ParticipantList)
def participants(code: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> dict:
    return {"participants": service.list_active_participants(db, code)}

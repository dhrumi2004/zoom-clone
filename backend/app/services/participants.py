"""Participant and chat database operations used by the WebSocket layer."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..exceptions import AppError, NotFoundError
from ..models import ChatMessage, Meeting, MeetingStatus, Participant, ParticipantRole
from ..utils import utcnow
from .meetings import get_meeting_or_404

CHAT_HISTORY_LIMIT = 100
MAX_CHAT_LENGTH = 2000


def get_active_participant(db: Session, raw_code: str, participant_id: int) -> Participant:
    """The participant must belong to this live meeting and must not have left or been removed."""
    meeting = get_meeting_or_404(db, raw_code)
    participant = db.get(Participant, participant_id)
    if participant is None or participant.meeting_id != meeting.id:
        raise NotFoundError("Participant not found in this meeting.")
    if meeting.status != MeetingStatus.LIVE:
        raise AppError(410, "meeting_ended", "This meeting has ended.")
    if participant.is_removed:
        raise AppError(403, "removed", "You were removed from this meeting.")
    if participant.left_at is not None:
        raise AppError(409, "already_left", "You already left this meeting. Please join again.")
    return participant


def active_participants(db: Session, meeting_id: int) -> List[Participant]:
    return list(
        db.scalars(
            select(Participant)
            .where(
                Participant.meeting_id == meeting_id,
                Participant.left_at.is_(None),
                Participant.is_removed.is_(False),
            )
            .order_by(Participant.joined_at)
        ).all()
    )


def set_media_state(
    db: Session, participant_id: int, is_muted: Optional[bool] = None, is_video_off: Optional[bool] = None
) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise NotFoundError("Participant not found.")
    if is_muted is not None:
        participant.is_muted = is_muted
    if is_video_off is not None:
        participant.is_video_off = is_video_off
    db.commit()
    return participant


def mute_all(db: Session, meeting_id: int) -> List[Participant]:
    """Mute every non-host who is currently unmuted. Returns the rows that changed."""
    changed = [
        p for p in active_participants(db, meeting_id) if p.role != ParticipantRole.HOST and not p.is_muted
    ]
    for participant in changed:
        participant.is_muted = True
    db.commit()
    return changed


def get_target(db: Session, meeting_id: int, target_id: int) -> Participant:
    """A participant the host wants to act on; must be in the same meeting and still present."""
    target = db.get(Participant, target_id)
    if target is None or target.meeting_id != meeting_id or not target.is_active:
        raise NotFoundError("That participant is no longer in the meeting.")
    return target


def remove_participant(db: Session, meeting_id: int, target_id: int) -> Participant:
    target = get_target(db, meeting_id, target_id)
    if target.role == ParticipantRole.HOST:
        raise AppError(403, "cannot_remove_host", "The host can't be removed.")
    target.is_removed = True
    target.left_at = utcnow()
    db.commit()
    return target


def save_chat_message(db: Session, participant_id: int, content: str) -> ChatMessage:
    content = content.strip()
    if not content:
        raise AppError(422, "empty_message", "Message can't be empty.")
    if len(content) > MAX_CHAT_LENGTH:
        raise AppError(422, "message_too_long", f"Messages are limited to {MAX_CHAT_LENGTH} characters.")
    participant = db.get(Participant, participant_id)
    message = ChatMessage(meeting_id=participant.meeting_id, sender=participant, content=content)
    db.add(message)
    db.commit()
    return message


def recent_messages(db: Session, meeting: Meeting) -> List[ChatMessage]:
    """Chat history for someone joining mid-meeting (only messages from the current session)."""
    query = select(ChatMessage).where(ChatMessage.meeting_id == meeting.id)
    if meeting.started_at is not None:
        query = query.where(ChatMessage.sent_at >= meeting.started_at)
    rows = db.scalars(
        query.order_by(ChatMessage.sent_at.desc()).limit(CHAT_HISTORY_LIMIT).options(selectinload(ChatMessage.sender))
    ).all()
    return list(reversed(rows))

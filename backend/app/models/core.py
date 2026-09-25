"""SQLAlchemy ORM models (the database schema).

users 1──* meetings 1──1 meeting_settings
                    1──* participants *──1 users (nullable: guests have no account)
                    1──* chat_messages *──1 participants
"""
import enum
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from ..utils import utcnow


class MeetingType(str, enum.Enum):
    INSTANT = "instant"
    SCHEDULED = "scheduled"


class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"  # created for the future, not started yet
    LIVE = "live"  # someone is in the meeting right now
    ENDED = "ended"


class ParticipantRole(str, enum.Enum):
    HOST = "host"
    PARTICIPANT = "participant"


class Recurrence(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


def _str_enum(enum_cls: type) -> Enum:
    """Store enums as their lowercase value in a VARCHAR column with a CHECK constraint."""
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    avatar_color: Mapped[str] = mapped_column(String(7))
    # Zoom's "Personal Meeting ID" (PMI)
    personal_meeting_id: Mapped[str] = mapped_column(String(11), unique=True)
    # "pbkdf2_sha256$<iterations>$<salt>$<hash>" (see security.py); never the plain password
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    hosted_meetings: Mapped[List["Meeting"]] = relationship(back_populates="host", cascade="all, delete-orphan")
    participations: Mapped[List["Participant"]] = relationship(back_populates="user")
    sessions: Mapped[List["AuthSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    """A signed-in browser. The browser keeps the random token; we store only its SHA-256,
    so a leaked database can't be used to log in. Signing out deletes the row."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("duration_min IS NULL OR duration_min > 0", name="ck_meetings_duration_positive"),
        # Speeds up the dashboard's "upcoming" and "recent" queries
        Index("ix_meetings_host_status_start", "host_id", "status", "scheduled_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public 10-digit Meeting ID shown to users and used in invite links
    meeting_code: Mapped[str] = mapped_column(String(11), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[MeetingType] = mapped_column(_str_enum(MeetingType))
    status: Mapped[MeetingStatus] = mapped_column(_str_enum(MeetingStatus), default=MeetingStatus.SCHEDULED)
    # Only set for scheduled meetings
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passcode: Mapped[str] = mapped_column(String(10))
    # Recurring meetings keep one Meeting ID; scheduled_start always holds the next occurrence.
    recurrence: Mapped[Recurrence] = mapped_column(_str_enum(Recurrence), default=Recurrence.NONE)
    recurrence_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    host: Mapped["User"] = relationship(back_populates="hosted_meetings")
    settings: Mapped["MeetingSettings"] = relationship(
        back_populates="meeting", uselist=False, cascade="all, delete-orphan"
    )
    participants: Mapped[List["Participant"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="ChatMessage.sent_at"
    )

    @property
    def participant_count(self) -> int:
        """Distinct people who joined (rejoins by the same account or name count once)."""
        return len({p.user_id or p.display_name for p in self.participants})

    @property
    def end_time(self) -> Optional[datetime]:
        """Planned end of a scheduled meeting."""
        if self.scheduled_start is None or self.duration_min is None:
            return None
        return self.scheduled_start + timedelta(minutes=self.duration_min)


class MeetingSettings(Base):
    """One row per meeting (1:1), kept separate so meeting options can grow without touching `meetings`."""

    __tablename__ = "meeting_settings"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    host_video_on: Mapped[bool] = mapped_column(Boolean, default=True)
    participant_video_on: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_chat: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_screen_share: Mapped[bool] = mapped_column(Boolean, default=True)
    # In-meeting Security menu: "Allow participants to unmute themselves / rename themselves"
    allow_unmute: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_rename: Mapped[bool] = mapped_column(Boolean, default=True)

    meeting: Mapped["Meeting"] = relationship(back_populates="settings")


class Participant(Base):
    """One row per join session. A person who leaves and rejoins gets a new row."""

    __tablename__ = "participants"
    __table_args__ = (Index("ix_participants_meeting_active", "meeting_id", "left_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    # NULL for guests who joined by link without an account
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[ParticipantRole] = mapped_column(_str_enum(ParticipantRole), default=ParticipantRole.PARTICIPANT)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_video_off: Mapped[bool] = mapped_column(Boolean, default=False)
    is_removed: Mapped[bool] = mapped_column(Boolean, default=False)

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")
    user: Mapped[Optional["User"]] = relationship(back_populates="participations")
    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="sender", cascade="all, delete-orphan", foreign_keys="ChatMessage.participant_id"
    )

    @property
    def is_active(self) -> bool:
        return self.left_at is None and not self.is_removed


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_meeting_sent", "meeting_id", "sent_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))
    # NULL = to everyone; otherwise a private message to one participant
    recipient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped["Meeting"] = relationship(back_populates="messages")
    sender: Mapped["Participant"] = relationship(back_populates="messages", foreign_keys=[participant_id])
    recipient: Mapped[Optional["Participant"]] = relationship(foreign_keys=[recipient_id])

    @property
    def sender_name(self) -> str:
        return self.sender.display_name

    @property
    def recipient_name(self) -> Optional[str]:
        return self.recipient.display_name if self.recipient else None


# ---------- Polls ----------

class PollStatus(str, enum.Enum):
    OPEN = "open"
    ENDED = "ended"


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("participants.id", ondelete="SET NULL"), nullable=True)
    question: Mapped[str] = mapped_column(String(300))
    anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[PollStatus] = mapped_column(_str_enum(PollStatus), default=PollStatus.OPEN)
    results_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    options: Mapped[List["PollOption"]] = relationship(
        back_populates="poll", cascade="all, delete-orphan", order_by="PollOption.position"
    )
    votes: Mapped[List["PollVote"]] = relationship(back_populates="poll", cascade="all, delete-orphan")


class PollOption(Base):
    __tablename__ = "poll_options"
    __table_args__ = (UniqueConstraint("poll_id", "position", name="uq_poll_options_position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("polls.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(String(200))

    poll: Mapped["Poll"] = relationship(back_populates="options")


class PollVote(Base):
    """One vote per participant per poll (single choice, like Zoom's default poll)."""

    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("poll_id", "participant_id", name="uq_poll_votes_one_per_person"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("polls.id", ondelete="CASCADE"))
    option_id: Mapped[int] = mapped_column(ForeignKey("poll_options.id", ondelete="CASCADE"))
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))
    voted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    poll: Mapped["Poll"] = relationship(back_populates="votes")

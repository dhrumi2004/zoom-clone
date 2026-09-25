"""Pydantic models: the shape of API requests and responses."""
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, computed_field, field_validator

from ..config import FRONTEND_URL
from ..models import MeetingStatus, MeetingType, ParticipantRole


def _to_utc_iso(value: datetime) -> str:
    """DB times are naive UTC; send them with a 'Z' so browsers convert to local time correctly."""
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


UTCDateTime = Annotated[datetime, PlainSerializer(_to_utc_iso, return_type=str)]


def build_invite_link(meeting_code: str, passcode: str) -> str:
    return f"{FRONTEND_URL}/j/{meeting_code}?pwd={passcode}"


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Users ----------

class UserOut(ORMModel):
    id: int
    name: str
    email: str
    avatar_color: str
    personal_meeting_id: str


class HostOut(ORMModel):
    id: int
    name: str
    avatar_color: str


# ---------- Meeting settings ----------

class MeetingSettingsIn(BaseModel):
    waiting_room: bool = False
    mute_on_entry: bool = False
    host_video_on: bool = True
    participant_video_on: bool = True
    allow_chat: bool = True
    allow_screen_share: bool = True


class MeetingSettingsOut(MeetingSettingsIn, ORMModel):
    pass


# ---------- Meetings: requests ----------

Title = Annotated[str, Field(min_length=1, max_length=200)]
Description = Annotated[str, Field(max_length=2000)]
Passcode = Annotated[str, Field(min_length=1, max_length=10, pattern=r"^[A-Za-z0-9]+$")]
Duration = Annotated[int, Field(ge=5, le=1440)]


def _as_naive_utc(value: datetime) -> datetime:
    """Accept any timezone from the browser, store as naive UTC. Naive input is treated as UTC."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


class InstantMeetingCreate(BaseModel):
    title: Optional[Title] = None  # defaults to "<name>'s Zoom Meeting"
    settings: MeetingSettingsIn = MeetingSettingsIn()


class ScheduledMeetingCreate(BaseModel):
    title: Title
    description: Optional[Description] = None
    scheduled_start: datetime
    duration_min: Duration = 60
    passcode: Optional[Passcode] = None  # generated if omitted
    settings: MeetingSettingsIn = MeetingSettingsIn()

    @field_validator("scheduled_start")
    @classmethod
    def _normalize_start(cls, value: datetime) -> datetime:
        return _as_naive_utc(value)


class ScheduledMeetingUpdate(BaseModel):
    """Every field optional: only the ones sent are changed."""

    title: Optional[Title] = None
    description: Optional[Description] = None
    scheduled_start: Optional[datetime] = None
    duration_min: Optional[Duration] = None
    passcode: Optional[Passcode] = None
    settings: Optional[MeetingSettingsIn] = None

    @field_validator("scheduled_start")
    @classmethod
    def _normalize_start(cls, value: Optional[datetime]) -> Optional[datetime]:
        return _as_naive_utc(value) if value else value


# ---------- Meetings: responses ----------

class MeetingPublic(ORMModel):
    """Safe to show anyone who knows the Meeting ID (no passcode)."""

    meeting_code: str
    title: str
    type: MeetingType
    status: MeetingStatus
    host: HostOut
    scheduled_start: Optional[UTCDateTime] = None
    duration_min: Optional[int] = None
    started_at: Optional[UTCDateTime] = None
    settings: MeetingSettingsOut


class MeetingOut(MeetingPublic):
    """Full details for the meeting's owner (dashboard lists, create/schedule responses)."""

    id: int
    description: Optional[str] = None
    passcode: str
    ended_at: Optional[UTCDateTime] = None
    created_at: UTCDateTime
    participant_count: int = 0

    @computed_field  # type: ignore[misc]
    @property
    def invite_link(self) -> str:
        return build_invite_link(self.meeting_code, self.passcode)


# ---------- Participants / joining ----------

class ParticipantOut(ORMModel):
    id: int
    user_id: Optional[int] = None
    display_name: str
    role: ParticipantRole
    joined_at: UTCDateTime
    is_muted: bool
    is_video_off: bool


class JoinRequest(BaseModel):
    display_name: Annotated[str, Field(min_length=1, max_length=100)]
    passcode: Optional[str] = None
    # "Start" from the dashboard joins as host; links and Meeting IDs join as a participant.
    as_host: bool = False

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be empty")
        return value


class JoinResponse(BaseModel):
    participant: ParticipantOut
    meeting: MeetingPublic


class VerifyRequest(BaseModel):
    passcode: Optional[str] = None


class LeaveRequest(BaseModel):
    participant_id: int


class ChatMessageOut(ORMModel):
    id: int
    participant_id: int
    sender_name: str
    content: str
    sent_at: UTCDateTime


class ParticipantList(BaseModel):
    participants: List[ParticipantOut]

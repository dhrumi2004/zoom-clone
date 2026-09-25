"""Request/response models for Team Chat, Mail, Docs, Whiteboards, Contacts, Apps and Settings."""
from typing import Annotated, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from ..models import ChannelType, MailFolder
from .core import ORMModel, UTCDateTime

Name = Annotated[str, Field(min_length=1, max_length=100)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


def _strip(value: Optional[str]) -> Optional[str]:
    return value.strip() if isinstance(value, str) else value


# ---------- Profile & settings ----------

class ProfileOut(ORMModel):
    job_title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[Name] = None
    avatar_color: Optional[HexColor] = None
    job_title: Optional[Annotated[str, Field(max_length=100)]] = None
    department: Optional[Annotated[str, Field(max_length=100)]] = None
    phone: Optional[Annotated[str, Field(max_length=30)]] = None
    location: Optional[Annotated[str, Field(max_length=100)]] = None

    @field_validator("name", "job_title", "department", "phone", "location")
    @classmethod
    def _strip_text(cls, value: Optional[str]) -> Optional[str]:
        return _strip(value)


class UserSettingsOut(ORMModel):
    start_with_video: bool
    mute_on_join: bool
    default_duration_min: int
    default_waiting_room: bool
    default_mute_on_entry: bool


class UserSettingsUpdate(BaseModel):
    start_with_video: Optional[bool] = None
    mute_on_join: Optional[bool] = None
    default_duration_min: Optional[Annotated[int, Field(ge=15, le=1440)]] = None
    default_waiting_room: Optional[bool] = None
    default_mute_on_entry: Optional[bool] = None


# ---------- Contacts ----------

class ContactOut(BaseModel):
    user_id: int
    name: str
    email: str
    avatar_color: str
    personal_meeting_id: str
    is_favorite: bool
    job_title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None


class ContactUpdate(BaseModel):
    is_favorite: bool


# ---------- Team Chat ----------

class MemberOut(BaseModel):
    id: int
    name: str
    avatar_color: str


class ChannelOut(BaseModel):
    id: int
    type: ChannelType
    name: str  # channel name, or the other person's name for a DM
    description: Optional[str] = None
    members: List[MemberOut]
    unread_count: int
    last_message: Optional[str] = None
    last_message_at: Optional[UTCDateTime] = None


class ChannelCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    description: Optional[Annotated[str, Field(max_length=300)]] = None
    member_ids: List[int] = []

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = value.strip().lstrip("#").strip()
        if not value:
            raise ValueError("Channel name can't be empty")
        return value


class DirectCreate(BaseModel):
    user_id: int


class ChannelMessageOut(BaseModel):
    id: int
    channel_id: int
    sender: Optional[MemberOut] = None
    content: str
    sent_at: UTCDateTime


class ChannelMessageCreate(BaseModel):
    content: Annotated[str, Field(min_length=1, max_length=4000)]

    @field_validator("content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message can't be empty")
        return value.strip()


# ---------- Mail ----------

class EmailOut(ORMModel):
    id: int
    folder: MailFolder
    from_name: str
    from_email: str
    to_emails: str
    subject: str
    body: str
    is_read: bool
    is_starred: bool
    sent_at: UTCDateTime


class MailList(BaseModel):
    items: List[EmailOut]
    unread_inbox: int


class EmailCreate(BaseModel):
    to: Annotated[List[EmailStr], Field(min_length=1, max_length=20)]
    subject: Annotated[str, Field(max_length=300)] = ""
    body: Annotated[str, Field(max_length=20000)] = ""


class EmailUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None
    # "trash" moves to Trash; "restore" puts it back where it was
    action: Optional[Annotated[str, Field(pattern="^(trash|restore)$")]] = None


# ---------- Docs & Whiteboards ----------

Title = Annotated[str, Field(min_length=1, max_length=200)]


class DocumentSummary(ORMModel):
    id: int
    title: str
    created_at: UTCDateTime
    updated_at: UTCDateTime


class DocumentOut(DocumentSummary):
    content: str


class DocumentCreate(BaseModel):
    title: Title = "Untitled document"
    content: Annotated[str, Field(max_length=500_000)] = ""


class DocumentUpdate(BaseModel):
    title: Optional[Title] = None
    content: Optional[Annotated[str, Field(max_length=500_000)]] = None


class WhiteboardSummary(ORMModel):
    id: int
    title: str
    created_at: UTCDateTime
    updated_at: UTCDateTime


class WhiteboardOut(WhiteboardSummary):
    data: str


class WhiteboardCreate(BaseModel):
    title: Title = "Untitled whiteboard"


class WhiteboardUpdate(BaseModel):
    title: Optional[Title] = None
    data: Optional[Annotated[str, Field(max_length=2_000_000)]] = None


# ---------- Apps ----------

class AppOut(BaseModel):
    key: str
    name: str
    developer: str
    category: str
    description: str
    color: str
    installed: bool


# ---------- Nav badges ----------

class Badges(BaseModel):
    chat_unread: int
    mail_unread: int

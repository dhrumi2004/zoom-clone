from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas.workspace import ChannelCreate, ChannelMessageCreate, ChannelMessageOut, ChannelOut, DirectCreate
from ..services import team_chat as service

router = APIRouter(prefix="/api/chat", tags=["team chat"])


@router.get("/channels", response_model=List[ChannelOut])
def list_channels(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_channels(db, user)


@router.post("/channels", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(data: ChannelCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.create_channel(db, user, data)


@router.post("/direct", response_model=ChannelOut)
def open_direct(data: DirectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Returns the existing DM with this person, or creates it."""
    return service.get_or_create_direct(db, user, data.user_id)


@router.get("/channels/{channel_id}/messages", response_model=List[ChannelMessageOut])
def list_messages(channel_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_messages(db, user, channel_id)


@router.post("/channels/{channel_id}/messages", response_model=ChannelMessageOut, status_code=status.HTTP_201_CREATED)
def send_message(channel_id: int, data: ChannelMessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.send_message(db, user, channel_id, data.content)

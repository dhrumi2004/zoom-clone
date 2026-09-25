"""Docs and Whiteboards share the same shape: list / create / get / update / delete."""
from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Document, User, Whiteboard
from ..schemas.workspace import (
    DocumentCreate,
    DocumentOut,
    DocumentSummary,
    DocumentUpdate,
    WhiteboardCreate,
    WhiteboardOut,
    WhiteboardSummary,
    WhiteboardUpdate,
)
from ..services import documents as service

docs = APIRouter(prefix="/api/docs", tags=["docs"])
boards = APIRouter(prefix="/api/whiteboards", tags=["whiteboards"])


@docs.get("", response_model=List[DocumentSummary])
def list_docs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_owned(db, Document, user)


@docs.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_doc(data: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.create_document(db, user, data.title, data.content)


@docs.get("/{doc_id}", response_model=DocumentOut)
def get_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.get_owned(db, Document, user, doc_id)


@docs.patch("/{doc_id}", response_model=DocumentOut)
def update_doc(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.update_document(db, user, doc_id, data.title, data.content)


@docs.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    service.delete_owned(db, Document, user, doc_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@boards.get("", response_model=List[WhiteboardSummary])
def list_boards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_owned(db, Whiteboard, user)


@boards.post("", response_model=WhiteboardOut, status_code=status.HTTP_201_CREATED)
def create_board(data: WhiteboardCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.create_whiteboard(db, user, data.title)


@boards.get("/{board_id}", response_model=WhiteboardOut)
def get_board(board_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.get_owned(db, Whiteboard, user, board_id)


@boards.patch("/{board_id}", response_model=WhiteboardOut)
def update_board(board_id: int, data: WhiteboardUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.update_whiteboard(db, user, board_id, data.title, data.data)


@boards.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(board_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    service.delete_owned(db, Whiteboard, user, board_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

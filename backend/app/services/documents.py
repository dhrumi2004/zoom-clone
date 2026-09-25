"""Docs and Whiteboards: simple owned documents."""
import json
from typing import List, Type, TypeVar, Union

import nh3
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..exceptions import AppError, NotFoundError
from ..models import Document, User, Whiteboard

# Formatting the Docs editor can produce; everything else (scripts, event handlers, styles) is stripped.
ALLOWED_TAGS = {"p", "br", "b", "strong", "i", "em", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "code", "pre", "div", "span"}
ALLOWED_ATTRIBUTES = {"a": {"href"}}

Owned = TypeVar("Owned", Document, Whiteboard)


def sanitize_html(html: str) -> str:
    return nh3.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, link_rel="noopener noreferrer")


def list_owned(db: Session, model: Type[Owned], me: User) -> List[Owned]:
    return list(db.scalars(select(model).where(model.owner_id == me.id).order_by(model.updated_at.desc())).all())


def get_owned(db: Session, model: Type[Owned], me: User, item_id: int) -> Owned:
    item = db.get(model, item_id)
    if item is None or item.owner_id != me.id:
        raise NotFoundError("Not found.")
    return item


def create_document(db: Session, me: User, title: str, content: str) -> Document:
    doc = Document(owner_id=me.id, title=title.strip() or "Untitled document", content=sanitize_html(content))
    db.add(doc)
    db.commit()
    return doc


def update_document(db: Session, me: User, doc_id: int, title: Union[str, None], content: Union[str, None]) -> Document:
    doc = get_owned(db, Document, me, doc_id)
    if title is not None:
        doc.title = title.strip() or "Untitled document"
    if content is not None:
        doc.content = sanitize_html(content)
    db.commit()
    return doc


def create_whiteboard(db: Session, me: User, title: str) -> Whiteboard:
    board = Whiteboard(owner_id=me.id, title=title.strip() or "Untitled whiteboard", data="[]")
    db.add(board)
    db.commit()
    return board


def update_whiteboard(db: Session, me: User, board_id: int, title: Union[str, None], data: Union[str, None]) -> Whiteboard:
    board = get_owned(db, Whiteboard, me, board_id)
    if title is not None:
        board.title = title.strip() or "Untitled whiteboard"
    if data is not None:
        try:
            strokes = json.loads(data)
            if not isinstance(strokes, list):
                raise ValueError
        except ValueError:
            raise AppError(422, "bad_whiteboard", "Whiteboard data must be a JSON list of strokes.")
        board.data = data
    db.commit()
    return board


def delete_owned(db: Session, model: Type[Owned], me: User, item_id: int) -> None:
    db.delete(get_owned(db, model, me, item_id))
    db.commit()

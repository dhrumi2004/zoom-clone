"""In-meeting polls: the host/co-host launches a question, participants vote once (they can change
their answer until it ends), the host sees live results and can share them with everyone."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..exceptions import AppError, NotFoundError
from ..models import Meeting, Participant, Poll, PollOption, PollStatus, PollVote

MAX_OPTIONS = 10


def create_poll(db: Session, meeting_id: int, creator_id: int, question: str, options: List[str], anonymous: bool) -> Poll:
    question = (question or "").strip()
    texts = [o.strip() for o in options if isinstance(o, str) and o.strip()]
    if not question or len(question) > 300:
        raise AppError(422, "bad_question", "Please enter a question (up to 300 characters).")
    if not 2 <= len(texts) <= MAX_OPTIONS or any(len(t) > 200 for t in texts):
        raise AppError(422, "bad_options", f"A poll needs 2 to {MAX_OPTIONS} answers.")
    poll = Poll(meeting_id=meeting_id, created_by=creator_id, question=question, anonymous=bool(anonymous))
    poll.options = [PollOption(position=i, text=t) for i, t in enumerate(texts)]
    db.add(poll)
    db.commit()
    return load_poll(db, meeting_id, poll.id)


def load_poll(db: Session, meeting_id: int, poll_id: int) -> Poll:
    poll = db.scalar(
        select(Poll)
        .where(Poll.id == poll_id, Poll.meeting_id == meeting_id)
        .options(selectinload(Poll.options), selectinload(Poll.votes))
    )
    if poll is None:
        raise NotFoundError("Poll not found.")
    return poll


def vote(db: Session, meeting_id: int, poll_id: int, participant_id: int, option_id: int) -> Poll:
    poll = load_poll(db, meeting_id, poll_id)
    if poll.status != PollStatus.OPEN:
        raise AppError(409, "poll_ended", "This poll has ended.")
    if option_id not in {o.id for o in poll.options}:
        raise AppError(422, "bad_option", "That answer isn't part of this poll.")
    existing = next((v for v in poll.votes if v.participant_id == participant_id), None)
    if existing:
        existing.option_id = option_id
    else:
        db.add(PollVote(poll_id=poll.id, option_id=option_id, participant_id=participant_id))
    db.commit()
    return load_poll(db, meeting_id, poll_id)


def end_poll(db: Session, meeting_id: int, poll_id: int) -> Poll:
    poll = load_poll(db, meeting_id, poll_id)
    poll.status = PollStatus.ENDED
    db.commit()
    return poll


def share_results(db: Session, meeting_id: int, poll_id: int, shared: bool) -> Poll:
    poll = load_poll(db, meeting_id, poll_id)
    poll.results_shared = shared
    db.commit()
    return poll


def session_polls(db: Session, meeting: Meeting) -> List[Poll]:
    """Polls launched since the meeting (re)started."""
    query = select(Poll).where(Poll.meeting_id == meeting.id).options(selectinload(Poll.options), selectinload(Poll.votes))
    if meeting.started_at is not None:
        query = query.where(Poll.created_at >= meeting.started_at)
    return list(db.scalars(query.order_by(Poll.created_at)).all())


def to_payload(db: Session, poll: Poll, viewer_id: int, is_moderator: bool) -> dict:
    """What one viewer may see: moderators always see results (and voter names unless anonymous);
    participants see results only after the host shares them."""
    show_results = is_moderator or poll.results_shared
    my_vote: Optional[int] = next((v.option_id for v in poll.votes if v.participant_id == viewer_id), None)
    names = {}
    if is_moderator and not poll.anonymous and poll.votes:
        ids = {v.participant_id for v in poll.votes}
        names = {p.id: p.display_name for p in db.scalars(select(Participant).where(Participant.id.in_(ids))).all()}
    options = []
    for o in poll.options:
        votes = [v for v in poll.votes if v.option_id == o.id]
        entry = {"id": o.id, "text": o.text}
        if show_results:
            entry["votes"] = len(votes)
            if names:
                entry["voters"] = [names.get(v.participant_id, "Someone") for v in votes]
        options.append(entry)
    return {
        "id": poll.id,
        "question": poll.question,
        "anonymous": poll.anonymous,
        "status": poll.status.value,
        "results_shared": poll.results_shared,
        "options": options,
        "total_votes": len(poll.votes) if show_results else None,
        "my_vote": my_vote,
    }

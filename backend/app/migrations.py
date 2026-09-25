"""Tiny schema upgrader for existing SQLite databases.

`Base.metadata.create_all` creates missing *tables* but never adds *columns* to tables that
already exist. Columns added after the first release are listed here and added with
ALTER TABLE on startup, so an existing database keeps its data.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

ADDED_COLUMNS = {
    "meeting_settings": [
        ("allow_unmute", "BOOLEAN NOT NULL DEFAULT 1"),
        ("allow_rename", "BOOLEAN NOT NULL DEFAULT 1"),
    ],
    "chat_messages": [("recipient_id", "INTEGER REFERENCES participants(id) ON DELETE CASCADE")],
    "meetings": [
        ("recurrence", "VARCHAR(20) NOT NULL DEFAULT 'none'"),
        ("recurrence_end", "DATE"),
    ],
}


def upgrade(engine: Engine) -> list:
    """Add any missing columns. Returns the list of columns that were added."""
    inspector = inspect(engine)
    added = []
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    added.append(f"{table}.{name}")
    return added

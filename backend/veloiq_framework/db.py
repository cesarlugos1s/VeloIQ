"""Database session management for VeloIQ™ framework apps.

The engine is set automatically when ``create_veloiq_app()`` runs.
Module code should use ``get_session`` as a FastAPI dependency::

    from fastapi import Depends
    from veloiq_framework.db import get_session
    from sqlmodel import Session, select

    @router.get("/")
    def list_items(session: Session = Depends(get_session)):
        return session.exec(select(MyModel)).all()
"""
from __future__ import annotations

from typing import Generator

from sqlalchemy import Engine
from sqlmodel import Session

_engine: Engine | None = None


def _set_engine(engine: Engine) -> None:
    global _engine
    _engine = engine


def get_engine() -> Engine:
    """Return the active SQLAlchemy engine set by ``create_veloiq_app()``."""
    if _engine is None:
        raise RuntimeError(
            "No database engine available. "
            "Ensure create_veloiq_app() has been called before any request is handled."
        )
    return _engine


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    if _engine is None:
        raise RuntimeError(
            "No database engine available. "
            "Ensure create_veloiq_app() has been called before any request is handled."
        )
    with Session(_engine) as session:
        yield session

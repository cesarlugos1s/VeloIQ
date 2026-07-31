"""Built-in contextual-help models: HelpDocument, HelpAction.

One HelpDocument per ``page_key`` (e.g. ``"task:list"``, ``"task:show"``),
rendered by the app-shell Help drawer. HelpAction rows are structured,
runnable action buttons attached to a document — never embedded inline in
the markdown ``body``.
"""
from typing import Optional

from sqlalchemy import Column, ForeignKey, String, Text
from sqlmodel import Field

from veloiq_framework.models import TimestampedModel


class HelpDocument(TimestampedModel, table=True):
    __tablename__ = "veloiq_help_document"

    page_key: str = Field(
        sa_column=Column(String(200), unique=True, nullable=False, index=True)
    )
    title: str = Field(default="", sa_column=Column(String(200)))
    body: str = Field(default="", sa_column=Column(Text))

    def __str__(self) -> str:
        return self.title or self.page_key


class HelpAction(TimestampedModel, table=True):
    __tablename__ = "veloiq_help_action"

    document_id: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("veloiq_help_document.id", ondelete="CASCADE")),
    )
    label: str = Field(default="", sa_column=Column(String(200)))
    action_key: str = Field(default="", sa_column=Column(String(200)))
    order: int = Field(default=0)

    def __str__(self) -> str:
        return self.label or self.action_key

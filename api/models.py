from datetime import datetime, UTC
from typing import Optional
import json

from sqlalchemy import (
    Integer, String, Text, DateTime, ForeignKey, Enum, JSON, event
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
import enum


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    chapters: Mapped[list["Chapter"]] = relationship(
        "Chapter", back_populates="project", cascade="all, delete-orphan",
        order_by="Chapter.order_index"
    )
    codex_entries: Mapped[list["CodexEntry"]] = relationship(
        "CodexEntry", back_populates="project", cascade="all, delete-orphan"
    )


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="chapters")
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene", back_populates="chapter", cascade="all, delete-orphan",
        order_by="Scene.order_index"
    )


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    chapter_id: Mapped[int] = mapped_column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="scenes")


class EntryType(str, enum.Enum):
    character = "character"
    location = "location"
    item = "item"
    lore = "lore"
    custom = "custom"


class CodexEntry(Base):
    __tablename__ = "codex_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    aliases: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="[]")
    entry_type: Mapped[str] = mapped_column(
        Enum(EntryType), nullable=False, default=EntryType.custom
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#eab308")
    entry_group: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    species: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="codex_entries")
    relations_from: Mapped[list["CodexRelation"]] = relationship(
        "CodexRelation", foreign_keys="CodexRelation.source_id",
        back_populates="source", cascade="all, delete-orphan"
    )
    relations_to: Mapped[list["CodexRelation"]] = relationship(
        "CodexRelation", foreign_keys="CodexRelation.target_id",
        back_populates="target", cascade="all, delete-orphan"
    )

    def get_aliases(self) -> list[str]:
        try:
            return json.loads(self.aliases or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    def set_aliases(self, aliases: list[str]) -> None:
        self.aliases = json.dumps(aliases)


class CodexRelation(Base):
    __tablename__ = "codex_relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("codex_entries.id", ondelete="CASCADE"))
    target_id: Mapped[int] = mapped_column(Integer, ForeignKey("codex_entries.id", ondelete="CASCADE"))
    relation_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    source: Mapped["CodexEntry"] = relationship(
        "CodexEntry", foreign_keys=[source_id], back_populates="relations_from"
    )
    target: Mapped["CodexEntry"] = relationship(
        "CodexEntry", foreign_keys=[target_id], back_populates="relations_to"
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    openrouter_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_model: Mapped[str] = mapped_column(
        String(100), default="anthropic/claude-3.5-sonnet"
    )
    theme: Mapped[str] = mapped_column(String(20), default="system")

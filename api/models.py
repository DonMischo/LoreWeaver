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

    time_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fragment_tabs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: ["tab-id", ...]
    book_meta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # JSON: BookMeta dict
    shared_codex_project_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # FK to projects.id (no cascade)

    acts: Mapped[list["Act"]] = relationship(
        "Act", back_populates="project", cascade="all, delete-orphan",
        order_by="Act.order_index"
    )
    codex_entries: Mapped[list["CodexEntry"]] = relationship(
        "CodexEntry", back_populates="project", cascade="all, delete-orphan"
    )
    fragments: Mapped[list["Fragment"]] = relationship(
        "Fragment", back_populates="project", cascade="all, delete-orphan"
    )


class Act(Base):
    """Top-level structural grouping within a project (## in source files)."""
    __tablename__ = "acts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="acts")
    chapters: Mapped[list["Chapter"]] = relationship(
        "Chapter", back_populates="act", cascade="all, delete-orphan",
        order_by="Chapter.order_index"
    )


class Chapter(Base):
    """Mid-level grouping within an act (### in source files)."""
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    act_id: Mapped[int] = mapped_column(Integer, ForeignKey("acts.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    act: Mapped["Act"] = relationship("Act", back_populates="chapters")
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene", back_populates="chapter", cascade="all, delete-orphan",
        order_by="Scene.order_index"
    )


class Scene(Base):
    """Smallest editable unit (#### in source files)."""
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    chapter_id: Mapped[int] = mapped_column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")
    scene_time: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    entry_group: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of group strings
    species:     Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subtype:     Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tags:        Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="[]")
    is_main_char: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inventory:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: CharacterInventory
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

    def get_tags(self) -> list[str]:
        try:
            return json.loads(self.tags or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    def set_tags(self, tags: list[str]) -> None:
        self.tags = json.dumps(tags)

    def get_groups(self) -> list[str]:
        try:
            val = json.loads(self.entry_group or "[]")
            if isinstance(val, list):
                return [str(v) for v in val if v]
            # Legacy: plain string value
            return [str(val)] if val else []
        except (json.JSONDecodeError, TypeError):
            return [self.entry_group] if self.entry_group else []

    def set_groups(self, groups: list[str]) -> None:
        self.entry_group = json.dumps(groups)


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


class Fragment(Base):
    """Small text piece stored in a project tab (snippets, ideas, archive, custom)."""
    __tablename__ = "fragments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    tab: Mapped[str] = mapped_column(String(100), default="snippets")
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="fragments")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    openrouter_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_model: Mapped[str] = mapped_column(
        String(100), default="anthropic/claude-3.5-sonnet"
    )
    theme: Mapped[str] = mapped_column(String(20), default="system")

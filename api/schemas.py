from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from models import EntryType


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Acts ──────────────────────────────────────────────────────────────────────

class ActBase(BaseModel):
    title: str
    order_index: int = 0


class ActCreate(ActBase):
    project_id: int


class ActUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None


class ActOut(ActBase):
    id: int
    project_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chapters ──────────────────────────────────────────────────────────────────

class ChapterBase(BaseModel):
    title: str
    order_index: int = 0


class ChapterCreate(ChapterBase):
    act_id: int


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None


class ChapterOut(ChapterBase):
    id: int
    act_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: int
    order_index: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


# ── Scenes ────────────────────────────────────────────────────────────────────

class SceneBase(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = ""
    order_index: int = 0


class SceneCreate(SceneBase):
    chapter_id: int


class SceneUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    order_index: Optional[int] = None
    word_count: Optional[int] = None


class SceneOut(SceneBase):
    id: int
    chapter_id: int
    word_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Codex Entries ─────────────────────────────────────────────────────────────

class CodexEntryBase(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    entry_type: EntryType = EntryType.custom
    description: Optional[str] = ""
    notes: Optional[str] = None
    color: str = "#eab308"
    group: Optional[str] = Field(None, alias=None)
    species: Optional[str] = None
    subtype: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class CodexEntryCreate(CodexEntryBase):
    project_id: int


class CodexEntryUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[list[str]] = None
    entry_type: Optional[EntryType] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    group: Optional[str] = None
    species: Optional[str] = None
    subtype: Optional[str] = None
    tags: Optional[list[str]] = None


class CodexEntryOut(CodexEntryBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_entry(cls, entry) -> "CodexEntryOut":
        data = {
            "id": entry.id,
            "project_id": entry.project_id,
            "name": entry.name,
            "aliases": entry.get_aliases(),
            "entry_type": entry.entry_type,
            "description": entry.description,
            "notes": entry.notes,
            "color": entry.color,
            "group": entry.entry_group,
            "species": entry.species,
            "subtype": entry.subtype,
            "tags": entry.get_tags(),
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        }
        return cls(**data)


# ── Codex Relations ───────────────────────────────────────────────────────────

class CodexRelationCreate(BaseModel):
    source_id: int
    target_id: int
    relation_type: Optional[str] = None


class CodexRelationOut(BaseModel):
    id: int
    source_id: int
    target_id: int
    relation_type: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    openrouter_api_key: Optional[str] = None
    default_model: Optional[str] = None
    theme: Optional[str] = None


class SettingsOut(BaseModel):
    id: int
    has_api_key: bool
    default_model: str
    theme: str

    model_config = {"from_attributes": True}


# ── AI ────────────────────────────────────────────────────────────────────────

class AIGenerateRequest(BaseModel):
    scene_id: int
    mode: str  # continue | rewrite | brainstorm | ask | custom
    custom_prompt: Optional[str] = None
    model: Optional[str] = None

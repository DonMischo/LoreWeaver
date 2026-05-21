import json
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, model_validator
from models import EntryType


# ── Projects ──────────────────────────────────────────────────────────────────

# ── Book metadata (EPUB Dublin Core fields) ───────────────────────────────────

class BookMeta(BaseModel):
    """Stores EPUB / Dublin Core metadata for a project."""
    author: Optional[str] = None           # dc:creator
    author_sort: Optional[str] = None      # sort key, e.g. "Tolkien, J.R.R."
    subtitle: Optional[str] = None         # secondary title line
    language: str = "en"                   # dc:language (BCP 47)
    publisher: Optional[str] = None        # dc:publisher
    published_date: Optional[str] = None   # dc:date (YYYY or YYYY-MM-DD)
    isbn: Optional[str] = None             # dc:identifier scheme=ISBN
    rights: Optional[str] = None           # dc:rights (copyright statement)
    series: Optional[str] = None           # calibre:series
    series_index: Optional[str] = None     # calibre:series_index
    genre: Optional[str] = None            # primary dc:subject
    subjects: list[str] = Field(default_factory=list)  # additional dc:subject tags
    synopsis: Optional[str] = None         # dc:description (distinct from project description)
    translator: Optional[str] = None       # dc:contributor role="trl"
    editor: Optional[str] = None           # dc:contributor role="edt"


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    copy_codex_from: Optional[int] = None   # project_id to deep-copy codex from
    share_codex_from: Optional[int] = None  # project_id to live-share codex with


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    book_meta: Optional[BookMeta] = None
    shared_codex_project_id: Optional[int] = None


class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    book_meta: Optional[BookMeta] = None
    shared_codex_project_id: Optional[int] = None
    cover_image: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _parse_book_meta(cls, data):
        if hasattr(data, "__dict__"):
            raw = getattr(data, "book_meta", None)
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    object.__setattr__(data, "book_meta", parsed)
                except Exception:
                    object.__setattr__(data, "book_meta", None)
        return data


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
    synopsis: Optional[str] = None
    order_index: Optional[int] = None
    word_count: Optional[int] = None
    scene_time: Optional[Any] = None  # JSON dict or None to clear
    chapter_id: Optional[int] = None  # for cross-column corkboard DnD
    subplot: Optional[str] = None
    global_order: Optional[int] = None
    stack_group: Optional[str] = None
    node_x: Optional[float] = None
    node_y: Optional[float] = None


class SceneOut(SceneBase):
    id: int
    chapter_id: int
    word_count: int
    synopsis: Optional[str] = None
    scene_time: Optional[Any] = None
    subplot: Optional[str] = None
    global_order: Optional[int] = None
    stack_group: Optional[str] = None
    node_x: Optional[float] = None
    node_y: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _parse_scene_time(cls, data):
        if hasattr(data, "__dict__"):
            raw = getattr(data, "scene_time", None)
            if isinstance(raw, str):
                try:
                    object.__setattr__(data, "scene_time", json.loads(raw))
                except Exception:
                    pass
        return data


# ── Codex Entries ─────────────────────────────────────────────────────────────

class CodexEntryBase(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    entry_type: EntryType = EntryType.custom
    description: Optional[str] = ""
    notes: Optional[str] = None
    color: str = "#eab308"
    groups: list[str] = Field(default_factory=list)
    species: Optional[str] = None
    subtype: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    is_main_char: bool = False
    inventory: Optional[Any] = None  # CharacterInventory JSON or None
    image_path: Optional[str] = None
    name_type: Optional[str] = None  # name generation style (NameType key)


class CodexEntryCreate(CodexEntryBase):
    project_id: int


class CodexEntryUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[list[str]] = None
    entry_type: Optional[EntryType] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    groups: Optional[list[str]] = None
    species: Optional[str] = None
    subtype: Optional[str] = None
    tags: Optional[list[str]] = None
    is_main_char: Optional[bool] = None
    inventory: Optional[Any] = None
    name_type: Optional[str] = None


class CodexEntryOut(CodexEntryBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_entry(cls, entry) -> "CodexEntryOut":
        inv = None
        if entry.inventory:
            try:
                inv = json.loads(entry.inventory)
            except (json.JSONDecodeError, TypeError):
                pass
        data = {
            "id": entry.id,
            "project_id": entry.project_id,
            "name": entry.name,
            "aliases": entry.get_aliases(),
            "entry_type": entry.entry_type,
            "description": entry.description,
            "notes": entry.notes,
            "color": entry.color,
            "groups": entry.get_groups(),
            "species": entry.species,
            "subtype": entry.subtype,
            "tags": entry.get_tags(),
            "is_main_char": bool(entry.is_main_char),
            "inventory": inv,
            "image_path": entry.image_path,
            "name_type": entry.name_type,
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


# ── Fragments ─────────────────────────────────────────────────────────────────

BUILTIN_TABS = ["snippets", "ideas", "archive"]

class FragmentCreate(BaseModel):
    tab: str = "snippets"
    title: Optional[str] = None
    content: Optional[str] = ""
    category: Optional[str] = None
    order_index: int = 0

class FragmentUpdate(BaseModel):
    tab: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    order_index: Optional[int] = None

class FragmentOut(BaseModel):
    id: int
    project_id: int
    tab: str
    title: Optional[str]
    content: Optional[str]
    category: Optional[str]
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class TabsUpdate(BaseModel):
    custom_tabs: list[str]  # names of custom (non-builtin) tabs


# ── Scene Commands ────────────────────────────────────────────────────────────

class SceneCommandIn(BaseModel):
    command_type: str            # "currency" | "item"
    character_id: int
    item_id: Optional[int] = None
    data: Optional[dict] = None  # {currencyName, delta} or {qty}
    order_index: int = 0


class SceneCommandSyncRequest(BaseModel):
    commands: list[SceneCommandIn]


class SceneCommandOut(BaseModel):
    id: int
    scene_id: int
    command_type: str
    character_id: int
    item_id: Optional[int]
    data: Optional[Any]
    scene_time: Optional[Any]
    order_index: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _parse_json(cls, data):
        if hasattr(data, "__dict__"):
            for field in ("data", "scene_time"):
                raw = getattr(data, field, None)
                if isinstance(raw, str):
                    try:
                        object.__setattr__(data, field, json.loads(raw))
                    except Exception:
                        pass
        return data


# ── Data directory ────────────────────────────────────────────────────────────

class DataDirUpdate(BaseModel):
    path: Optional[str] = None   # None = reset to default
    migrate: bool = False        # copy existing DB + uploads to new path


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    openrouter_api_key: Optional[str] = None
    default_model: Optional[str] = None
    default_chat_model: Optional[str] = None
    theme: Optional[str] = None
    enabled_models: Optional[list[str]] = None


class SettingsOut(BaseModel):
    id: int
    has_api_key: bool
    default_model: str
    default_chat_model: Optional[str] = None
    theme: str
    enabled_models: list[str]

    model_config = {"from_attributes": True}


# ── AI Prompts ────────────────────────────────────────────────────────────────

class AIPromptOut(BaseModel):
    id: int
    name: str
    description: str
    system: str
    user_template: str
    is_built_in: bool
    built_in_key: Optional[str]
    word_count: int

    model_config = {"from_attributes": True}

class AIPromptCreate(BaseModel):
    name: str
    description: str = ""
    system: str = ""
    user_template: str = ""
    word_count: int = 400

class AIPromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    user_template: Optional[str] = None
    word_count: Optional[int] = None


# ── AI ────────────────────────────────────────────────────────────────────────

class AIGenerateRequest(BaseModel):
    scene_id: int
    mode: str  # continue | rewrite | brainstorm | ask | custom
    custom_prompt: Optional[str] = None
    model: Optional[str] = None


class KiGenerateRequest(BaseModel):
    scene_id: int
    model: str
    codex_ids: list[int] = []
    extra_scene_ids: list[int] = []
    prompt: str = ""
    prompt_id: Optional[int] = None
    entry_type: str = ""
    word_count: Optional[int] = None  # per-node override; falls back to prompt's word_count


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    scene_id: int
    messages: list[ChatMessage]
    model: Optional[str] = None


class SceneVersionOut(BaseModel):
    id: int
    scene_id: int
    content_hash: str
    created_at: datetime
    model_config = {"from_attributes": True}

class SceneVersionDetail(SceneVersionOut):
    content: str

class CreateVersionRequest(BaseModel):
    content: str


# ── Mention stats ─────────────────────────────────────────────────────────────

class MentionStatOut(BaseModel):
    codex_id: int
    scene_id: Optional[int]   # None for project-level aggregates
    count: int
    model_config = {"from_attributes": True}


# ── Time Config ───────────────────────────────────────────────────────────────

class TimeUnit(BaseModel):
    id: str
    singular: str
    plural: str
    count_per_parent: Optional[int] = None  # None = top-level unit
    value_names: list[str] = Field(default_factory=list)
    enabled: bool = True


class DayNightConfig(BaseModel):
    hours_per_day: int = 24
    night_start_hour: float = 20.0   # 0–hours_per_day
    night_duration: float = 10.0     # hours of darkness


DEFAULT_TIME_UNITS: list[dict] = [
    {"id": "age",    "singular": "Age",    "plural": "Ages",    "count_per_parent": None, "value_names": [], "enabled": False},
    {"id": "year",   "singular": "Year",   "plural": "Years",   "count_per_parent": 1000, "value_names": [], "enabled": True},
    {"id": "season", "singular": "Season", "plural": "Seasons", "count_per_parent": 4,    "value_names": ["Spring","Summer","Autumn","Winter"], "enabled": False},
    {"id": "month",  "singular": "Month",  "plural": "Months",  "count_per_parent": 12,   "value_names": [], "enabled": True},
    {"id": "day",    "singular": "Day",    "plural": "Days",    "count_per_parent": 30,   "value_names": [], "enabled": True},
    {"id": "hour",   "singular": "Hour",   "plural": "Hours",   "count_per_parent": 24,   "value_names": [], "enabled": True},
    {"id": "minute", "singular": "Minute", "plural": "Minutes", "count_per_parent": 60,   "value_names": [], "enabled": False},
    {"id": "second", "singular": "Second", "plural": "Seconds", "count_per_parent": 60,   "value_names": [], "enabled": False},
]

DEFAULT_DAY_NIGHT: dict = {
    "hours_per_day": 24,
    "night_start_hour": 20.0,
    "night_duration": 10.0,
}


class TimeConfig(BaseModel):
    units: list[TimeUnit] = Field(default_factory=lambda: [TimeUnit(**u) for u in DEFAULT_TIME_UNITS])
    day_night: DayNightConfig = Field(default_factory=DayNightConfig)


class TimeConfigOut(TimeConfig):
    pass

# ── Export ────────────────────────────────────────────────────────────────────

from typing import Literal

class ExportOptions(BaseModel):
    format: Literal["md", "tex", "epub-style"] = "md"
    # Content selection — None means "all"
    scene_ids: Optional[list[int]] = None   # None = all scenes
    # Structural headings
    include_act_headings: bool = True
    include_chapter_headings: bool = True
    include_scene_headings: bool = True
    # Typography (LaTeX + EPUB)
    font: Optional[str] = None          # e.g. "EB Garamond"
    font_size: str = "12pt"             # "10pt" | "11pt" | "12pt"
    line_spacing: str = "1.5"           # "1" | "1.5" | "2"
    # LaTeX only
    paper_size: str = "a4paper"         # "a4paper" | "letterpaper"
    # EPUB style only
    text_color: str = "#1a1a1a"
    bg_color: str = "#ffffff"
    page_margin: str = "2em"
    # Author/metadata come from project.book_meta — not stored here

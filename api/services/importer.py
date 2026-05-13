"""
Markdown import parsers for story structure and codex entries.

Story heading hierarchy
───────────────────────
  #     Book / Project title  →  creates a new project on import
  ##    Act                   →  Act in the DB
  ###   Chapter               →  Chapter in the DB
  ####+ Scene                 →  Scene in the DB

Files that use only ## / ### (old two-level format) are also handled:
  ##  → Act
  ### → Scene inside a default "Chapter 1"

─── Native codex format ────────────────────────────────────────────────────────
## character: Aragorn
**Aliases:** Strider, Elessar
**Color:** #ef4444
...

─── Legacy YAML-frontmatter format (auto-detected) ────────────────────────────
---
type: character
name: Aragorn
...
---
Description here...
"""

import re
from dataclasses import dataclass, field
from typing import Optional

import yaml


# ── Named-color → hex mapping ─────────────────────────────────────────────────

_COLOR_MAP: dict[str, str] = {
    "yellow":  "#eab308",
    "red":     "#ef4444",
    "blue":    "#3b82f6",
    "green":   "#22c55e",
    "purple":  "#a855f7",
    "orange":  "#f97316",
    "pink":    "#ec4899",
    "teal":    "#14b8a6",
    "cyan":    "#06b6d4",
    "indigo":  "#6366f1",
    "rose":    "#f43f5e",
    "amber":   "#f59e0b",
    "lime":    "#84cc16",
    "sky":     "#0ea5e9",
    "white":   "#f8fafc",
    "gray":    "#6b7280",
    "grey":    "#6b7280",
    "black":   "#1e1e1e",
}

_VALID_TYPES = {"character", "location", "item", "lore", "custom"}


def _resolve_color(raw: str) -> str:
    if not raw:
        return "#eab308"
    raw = raw.strip()
    if raw.startswith("#"):
        return raw
    return _COLOR_MAP.get(raw.lower(), "#eab308")


# ── Shared data classes ───────────────────────────────────────────────────────

@dataclass
class ParsedCodexEntry:
    name: str
    entry_type: str = "custom"
    aliases: list[str] = field(default_factory=list)
    description: str = ""
    notes: Optional[str] = None
    color: str = "#eab308"
    group: Optional[str] = None
    species: Optional[str] = None


@dataclass
class ParsedScene:
    title: str
    content_md: str


@dataclass
class ParsedChapter:
    title: str
    scenes: list[ParsedScene] = field(default_factory=list)


@dataclass
class ParsedAct:
    title: str
    chapters: list[ParsedChapter] = field(default_factory=list)


# ── Format detection ──────────────────────────────────────────────────────────

def is_legacy_format(text: str) -> bool:
    """Return True if the file looks like YAML-frontmatter entries."""
    return bool(re.match(r"^\s*---\s*\n", text))


# ── Heading helpers ───────────────────────────────────────────────────────────

def _heading(line: str) -> tuple[int, str]:
    """Return (level, title) for a markdown heading line, else (0, '')."""
    m = re.match(r"^(#{1,6})\s+(.+)$", line)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return 0, ""


# ── Legacy YAML-frontmatter parser ────────────────────────────────────────────

def parse_legacy_codex_markdown(text: str) -> list[ParsedCodexEntry]:
    entries: list[ParsedCodexEntry] = []
    block_pattern = re.compile(
        r"---\s*\n(.*?)\n---[ \t]*\n?(.*?)(?=\n---\s*\n|\Z)",
        re.DOTALL,
    )
    for m in block_pattern.finditer(text):
        yaml_text = m.group(1).strip()
        body = m.group(2).strip()
        try:
            data = yaml.safe_load(yaml_text)
        except yaml.YAMLError:
            continue
        if not isinstance(data, dict):
            continue
        name = str(data.get("name", "")).strip()
        if not name:
            continue
        raw_type = str(data.get("type", "custom")).strip().lower()
        entry_type = raw_type if raw_type in _VALID_TYPES else "custom"
        raw_aliases = data.get("aliases", [])
        aliases = [str(a) for a in raw_aliases if str(a) != name] if isinstance(raw_aliases, list) else []
        entries.append(ParsedCodexEntry(
            name=name,
            entry_type=entry_type,
            aliases=aliases,
            description=body,
            color=_resolve_color(str(data.get("color", ""))),
            group=str(data["group"]).strip() if data.get("group") else None,
            species=str(data["species"]).strip() if data.get("species") else None,
        ))
    return entries


# ── Native codex format parser ────────────────────────────────────────────────

def _parse_native_codex_block(heading: str, body: str) -> ParsedCodexEntry:
    if ":" in heading:
        type_part, name_part = heading.split(":", 1)
        entry_type = type_part.strip().lower()
        name = name_part.strip()
        if entry_type not in _VALID_TYPES:
            name = heading.strip()
            entry_type = "custom"
    else:
        name = heading.strip()
        entry_type = "custom"

    entry = ParsedCodexEntry(name=name, entry_type=entry_type)
    remaining: list[str] = []
    notes_lines: list[str] = []
    in_notes = False

    for line in body.splitlines():
        if m := re.match(r"^\*\*Aliases?:\*\*\s*(.+)$", line, re.IGNORECASE):
            entry.aliases = [a.strip() for a in m.group(1).split(",") if a.strip()]
            continue
        if m := re.match(r"^\*\*Color:\*\*\s*(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)$", line, re.IGNORECASE):
            entry.color = _resolve_color(m.group(1))
            continue
        if m := re.match(r"^\*\*Group:\*\*\s*(.+)$", line, re.IGNORECASE):
            entry.group = m.group(1).strip()
            continue
        if m := re.match(r"^\*\*Species:\*\*\s*(.+)$", line, re.IGNORECASE):
            entry.species = m.group(1).strip()
            continue
        if m := re.match(r"^\*\*Notes?:\*\*\s*(.*)$", line, re.IGNORECASE):
            in_notes = True
            if m.group(1).strip():
                notes_lines.append(m.group(1).strip())
            continue
        if in_notes:
            notes_lines.append(line)
        else:
            remaining.append(line)

    entry.description = "\n".join(remaining).strip()
    entry.notes = "\n".join(notes_lines).strip() or None
    return entry


def parse_codex_markdown(text: str) -> list[ParsedCodexEntry]:
    """Auto-detect format and parse accordingly."""
    if is_legacy_format(text):
        return parse_legacy_codex_markdown(text)
    return _parse_native_codex_markdown(text)


def _parse_native_codex_markdown(text: str) -> list[ParsedCodexEntry]:
    entries: list[ParsedCodexEntry] = []
    current_heading: Optional[str] = None
    current_lines: list[str] = []

    def flush():
        if current_heading is not None:
            entries.append(_parse_native_codex_block(current_heading, "\n".join(current_lines)))

    for line in text.splitlines():
        level, title = _heading(line)
        if level == 1:
            continue  # skip top-level title
        if level == 2:
            flush()
            current_heading = title
            current_lines.clear()
            continue
        if current_heading is not None:
            current_lines.append(line)

    flush()
    return entries


# ── HTML conversion ───────────────────────────────────────────────────────────

def _md_to_html(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    paragraphs = re.split(r"\n{2,}", text)
    parts = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        para = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", para)
        para = re.sub(r"\*(.+?)\*", r"<em>\1</em>", para)
        para = para.replace("\n", "<br>")
        parts.append(f"<p>{para}</p>")
    return "".join(parts)


# ── Story parser ──────────────────────────────────────────────────────────────

def parse_story_markdown(text: str) -> tuple[Optional[str], list[ParsedAct]]:
    """
    Parse a 4-level story markdown file.

    Returns (book_title, [ParsedAct]).

    Heading mapping in source file:
      #    → book title  (optional — triggers new project creation on import)
      ##   → Act
      ###  → Chapter
      #### → Scene  (any deeper heading also counts as a scene)

    Fallback for old 2-level files (## Chapter / ### Scene):
      If no #### headings appear, ### headings are treated as Scenes inside a
      single default Chapter per Act.
    """
    lines = text.splitlines()

    # ── First pass: check for #### to decide whether ### = chapter or scene ──
    has_four_level = any(_heading(l)[0] >= 4 for l in lines)

    book_title: Optional[str] = None
    acts: list[ParsedAct] = []
    current_act: Optional[ParsedAct] = None
    current_chapter: Optional[ParsedChapter] = None
    current_scene: Optional[ParsedScene] = None
    current_lines: list[str] = []

    def flush_scene():
        nonlocal current_scene, current_lines
        if current_scene is not None and current_chapter is not None:
            current_scene.content_md = "\n".join(current_lines).strip()
            current_chapter.scenes.append(current_scene)
        current_scene = None
        current_lines.clear()

    def flush_chapter():
        flush_scene()
        nonlocal current_chapter
        if current_chapter is not None and current_act is not None:
            current_act.chapters.append(current_chapter)
        current_chapter = None

    def flush_act():
        flush_chapter()
        nonlocal current_act
        if current_act is not None:
            acts.append(current_act)
        current_act = None

    def ensure_act():
        nonlocal current_act
        if current_act is None:
            current_act = ParsedAct(title="")

    def ensure_chapter():
        ensure_act()
        nonlocal current_chapter
        if current_chapter is None:
            current_chapter = ParsedChapter(title="")

    for line in lines:
        level, title = _heading(line)

        if level == 1:
            flush_act()
            book_title = title
            continue

        if level == 2:
            flush_act()
            current_act = ParsedAct(title=title)
            continue

        if level == 3:
            if has_four_level:
                # ### = Chapter
                flush_chapter()
                ensure_act()
                current_chapter = ParsedChapter(title=title)
            else:
                # Old format: ### = Scene inside an implicit chapter
                flush_scene()
                ensure_act()
                if current_chapter is None:
                    current_chapter = ParsedChapter(title="")
                current_scene = ParsedScene(title=title, content_md="")
            continue

        if level >= 4:
            # #### = Scene
            flush_scene()
            ensure_chapter()
            current_scene = ParsedScene(title=title, content_md="")
            continue

        # Plain content line
        if current_scene is not None:
            current_lines.append(line)
        elif current_chapter is not None and line.strip():
            # Content directly under a chapter heading → auto-open default scene
            current_scene = ParsedScene(title="", content_md="")
            current_lines.append(line)

    flush_act()

    return book_title, acts

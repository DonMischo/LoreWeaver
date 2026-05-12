"""
Markdown import parsers for story structure and codex entries.

Story format (matches our export):
    # Project Title (optional, ignored)

    ## Chapter Title

    ### Scene Title
    Scene content paragraphs...

    ### Next Scene
    ...

Codex format:
    ## character: Aragorn
    **Aliases:** Strider, Elessar
    **Color:** #ef4444

    Description text here...

    **Notes:** Private notes here

    ## location: Rivendell
    ...

    Entry type prefix is optional — defaults to "custom" if omitted.
    A bare ## Heading with no colon is treated as entry name, type=custom.
"""

import re
from dataclasses import dataclass, field
from typing import Optional


# ── Story ─────────────────────────────────────────────────────────────────────

@dataclass
class ParsedScene:
    title: str
    content_md: str  # raw markdown content


@dataclass
class ParsedChapter:
    title: str
    scenes: list[ParsedScene] = field(default_factory=list)


def _md_to_html(text: str) -> str:
    """Convert basic markdown paragraphs to HTML for TipTap."""
    text = text.strip()
    if not text:
        return ""
    paragraphs = re.split(r"\n{2,}", text)
    html_parts = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        # Bold
        para = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", para)
        # Italic
        para = re.sub(r"\*(.+?)\*", r"<em>\1</em>", para)
        # Single newlines → <br>
        para = para.replace("\n", "<br>")
        html_parts.append(f"<p>{para}</p>")
    return "".join(html_parts)


def parse_story_markdown(text: str) -> list[ParsedChapter]:
    """Parse a markdown document into chapters and scenes."""
    chapters: list[ParsedChapter] = []
    current_chapter: Optional[ParsedChapter] = None
    current_scene: Optional[ParsedScene] = None
    current_lines: list[str] = []

    def flush_scene():
        nonlocal current_scene, current_lines
        if current_scene is not None and current_chapter is not None:
            current_scene.content_md = "\n".join(current_lines).strip()
            current_chapter.scenes.append(current_scene)
        current_scene = None
        current_lines = []

    def flush_chapter():
        flush_scene()
        nonlocal current_chapter
        if current_chapter is not None:
            chapters.append(current_chapter)
        current_chapter = None

    for line in text.splitlines():
        # H2 → chapter
        m2 = re.match(r"^##\s+(.+)$", line)
        if m2:
            flush_chapter()
            current_chapter = ParsedChapter(title=m2.group(1).strip())
            continue

        # H3 → scene
        m3 = re.match(r"^###\s+(.+)$", line)
        if m3:
            flush_scene()
            current_scene = ParsedScene(title=m3.group(1).strip(), content_md="")
            continue

        # H1 → skip (project title)
        if re.match(r"^#\s+", line):
            continue

        # Content line
        if current_scene is not None:
            current_lines.append(line)
        elif current_chapter is not None and line.strip():
            # Content before first ### → treat as an untitled scene
            current_scene = ParsedScene(title="", content_md="")
            current_lines.append(line)

    flush_chapter()

    # If no H2 headers found, treat the whole doc as one chapter of scenes
    if not chapters and current_lines:
        chapters.append(ParsedChapter(
            title="Imported Chapter",
            scenes=[ParsedScene(title="Imported Scene", content_md="\n".join(current_lines).strip())]
        ))

    return chapters


# ── Codex ─────────────────────────────────────────────────────────────────────

VALID_TYPES = {"character", "location", "item", "lore", "custom"}


@dataclass
class ParsedCodexEntry:
    name: str
    entry_type: str = "custom"
    aliases: list[str] = field(default_factory=list)
    description: str = ""
    notes: str = ""
    color: str = "#eab308"


def _parse_codex_block(heading: str, body: str) -> ParsedCodexEntry:
    """Parse a single codex entry block."""
    # Heading: "character: Aragorn" or just "Aragorn"
    if ":" in heading:
        type_part, name_part = heading.split(":", 1)
        entry_type = type_part.strip().lower()
        name = name_part.strip()
        if entry_type not in VALID_TYPES:
            name = heading.strip()
            entry_type = "custom"
    else:
        name = heading.strip()
        entry_type = "custom"

    entry = ParsedCodexEntry(name=name, entry_type=entry_type)

    # Parse special fields from body
    remaining_lines = []
    notes_lines = []
    in_notes = False

    for line in body.splitlines():
        # **Aliases:** Strider, Elessar
        m_alias = re.match(r"^\*\*Aliases?:\*\*\s*(.+)$", line, re.IGNORECASE)
        if m_alias:
            entry.aliases = [a.strip() for a in m_alias.group(1).split(",") if a.strip()]
            continue

        # **Color:** #hex
        m_color = re.match(r"^\*\*Color:\*\*\s*(#[0-9a-fA-F]{3,6})$", line, re.IGNORECASE)
        if m_color:
            entry.color = m_color.group(1)
            continue

        # **Notes:** start
        m_notes = re.match(r"^\*\*Notes?:\*\*\s*(.*)$", line, re.IGNORECASE)
        if m_notes:
            in_notes = True
            if m_notes.group(1).strip():
                notes_lines.append(m_notes.group(1).strip())
            continue

        if in_notes:
            notes_lines.append(line)
        else:
            remaining_lines.append(line)

    entry.description = "\n".join(remaining_lines).strip()
    entry.notes = "\n".join(notes_lines).strip() or None
    return entry


def parse_codex_markdown(text: str) -> list[ParsedCodexEntry]:
    """Parse a markdown document into codex entries."""
    entries: list[ParsedCodexEntry] = []
    current_heading: Optional[str] = None
    current_lines: list[str] = []

    def flush():
        if current_heading is not None:
            entries.append(_parse_codex_block(current_heading, "\n".join(current_lines)))
        current_lines.clear()

    for line in text.splitlines():
        # H1 → skip (document title)
        if re.match(r"^#\s+", line) and not re.match(r"^##", line):
            continue

        m = re.match(r"^##\s+(.+)$", line)
        if m:
            flush()
            current_heading = m.group(1).strip()
            current_lines.clear()
            continue

        if current_heading is not None:
            current_lines.append(line)

    flush()
    return entries

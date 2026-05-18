"""
Inline tag extraction from scene content.

Supported syntax:
  {time:day 6|Event Name}          — time + event anchor
  {time:year 1337, 6th month, day 7|Event Name}

Time components (any combination, any order, comma-separated):
  day N         → day
  Nth month     → month  (1st, 2nd, … or plain N month)
  year N        → year

Events with identical names across scenes are treated as the SAME event on the timeline.

Relations between codex entries are managed via the CodexRelation model, not inline tags.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

# ── Patterns ──────────────────────────────────────────────────────────────────

_REL_RE  = re.compile(r'\[rel:([^\]|]+?)(?:\|([^\]]*))?\]')
_TIME_RE = re.compile(r'\{time:([^}|]+?)(?:\|([^}]*))?\}')
_HTML_RE = re.compile(r'<[^>]+>')


def _strip_html(html: str) -> str:
    return _HTML_RE.sub(' ', html or '')


# ── Time parsing ──────────────────────────────────────────────────────────────

@dataclass
class ParsedTime:
    year:  Optional[int] = None
    month: Optional[int] = None
    day:   Optional[int] = None
    raw:   str = ""

    @property
    def sort_key(self) -> tuple[int, int, int]:
        return (self.year or 0, self.month or 0, self.day or 0)

    @property
    def display(self) -> str:
        parts: list[str] = []
        if self.year  is not None: parts.append(f"Year {self.year}")
        if self.month is not None: parts.append(f"{_ordinal(self.month)} month")
        if self.day   is not None: parts.append(f"Day {self.day}")
        return ", ".join(parts) if parts else self.raw

    def to_dict(self) -> dict:
        return {
            "year": self.year, "month": self.month, "day": self.day,
            "raw": self.raw, "display": self.display,
            "sort_key": list(self.sort_key),
        }


def _ordinal(n: int) -> str:
    suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10 if n % 100 not in (11,12,13) else 0, "th")
    return f"{n}{suffix}"


def parse_time_string(s: str) -> ParsedTime:
    t = ParsedTime(raw=s.strip())
    if m := re.search(r'\bday\s+(\d+)', s, re.I):
        t.day = int(m.group(1))
    if m := re.search(r'(\d+)(?:st|nd|rd|th)?\s+month', s, re.I):
        t.month = int(m.group(1))
    if m := re.search(r'\byear\s+(\d+)', s, re.I):
        t.year = int(m.group(1))
    return t


# ── Tag data classes ──────────────────────────────────────────────────────────

@dataclass
class RelTag:
    target:       str
    relation_type: str = ""
    scene_id:     int  = 0
    scene_title:  str  = ""
    chapter_title: str = ""


@dataclass
class TimeEvent:
    time:         ParsedTime
    event_name:   str
    scene_id:     int  = 0
    scene_title:  str  = ""
    chapter_title: str = ""
    chapter_order: int = 0
    scene_order:  int  = 0


# ── Extraction helpers ────────────────────────────────────────────────────────

def extract_rel_tags(html: str) -> list[tuple[str, str]]:
    """Return list of (target, relation_type) from raw HTML."""
    text = _strip_html(html)
    return [(m.group(1).strip(), (m.group(2) or "").strip()) for m in _REL_RE.finditer(text)]


def extract_time_events(html: str) -> list[tuple[ParsedTime, str]]:
    """Return list of (ParsedTime, event_name) from raw HTML."""
    text = _strip_html(html)
    results = []
    for m in _TIME_RE.finditer(text):
        pt = parse_time_string(m.group(1))
        name = (m.group(2) or "").strip()
        results.append((pt, name))
    return results


# ── Project-wide aggregation ──────────────────────────────────────────────────

def build_relations_graph(project, codex_entries: list) -> dict:
    """
    Combine explicit codex relations + [rel:] inline tags into a graph.
    Returns {"nodes": [...], "edges": [...]}
    """
    from models import CodexEntry

    # Build lookup: name / alias → CodexEntry
    entry_by_name: dict[str, CodexEntry] = {}
    for e in codex_entries:
        entry_by_name[e.name.lower()] = e
        for alias in e.get_aliases():
            entry_by_name[alias.lower()] = e

    nodes_seen: dict[str, dict] = {}
    edges: list[dict] = []

    def ensure_node(name: str, codex_id: Optional[int] = None,
                    entry_type: str = "custom", color: str = "#6b7280"):
        key = name.lower()
        if key not in nodes_seen:
            nodes_seen[key] = {"id": name, "codex_id": codex_id,
                               "entry_type": entry_type, "color": color}

    # 1. Seed nodes from codex entries
    for e in codex_entries:
        ensure_node(e.name, e.id, e.entry_type, e.color)

    # 2. Explicit codex relations
    for e in codex_entries:
        for rel in e.relations_from:
            target = rel.target
            ensure_node(e.name, e.id, e.entry_type, e.color)
            ensure_node(target.name, target.id, target.entry_type, target.color)
            edges.append({
                "source": e.name,
                "target": target.name,
                "type": rel.relation_type or "",
                "relation_id": rel.id,
                "scene_title": "",
                "via": "codex",
            })

    return {"nodes": list(nodes_seen.values()), "edges": edges}


def build_timeline(project) -> dict:
    """
    Extract all {time:...|event} tags from all scenes, sorted chronologically.
    """
    events: list[TimeEvent] = []

    for act in sorted(project.acts, key=lambda a: a.order_index):
        for chapter in sorted(act.chapters, key=lambda c: c.order_index):
            for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                for pt, name in extract_time_events(scene.content or ""):
                    events.append(TimeEvent(
                        time=pt,
                        event_name=name or pt.raw,
                        scene_id=scene.id,
                        scene_title=scene.title or "Scene",
                        chapter_title=chapter.title,
                        chapter_order=act.order_index * 10000 + chapter.order_index,
                        scene_order=scene.order_index,
                    ))

    events.sort(key=lambda e: (e.time.sort_key, e.chapter_order, e.scene_order))

    return {
        "events": [
            {
                "time": e.time.to_dict(),
                "event_name": e.event_name,
                "scene_id": e.scene_id,
                "scene_title": e.scene_title,
                "chapter_title": e.chapter_title,
            }
            for e in events
        ]
    }

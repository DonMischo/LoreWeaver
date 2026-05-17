import json
from html.parser import HTMLParser
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Scene, SceneCommand, CodexEntry, Act, Chapter
from schemas import SceneCommandSyncRequest, SceneCommandOut

router = APIRouter(tags=["scene_commands"])


# ── HTML command extractor ────────────────────────────────────────────────────

class _CommandExtractor(HTMLParser):
    """Extracts currency/item command attrs from TipTap-serialised scene HTML."""

    def __init__(self):
        super().__init__()
        self.commands: list[dict] = []
        self._order = 0

    def handle_starttag(self, tag: str, attrs):
        if tag != "div":
            return
        d = dict(attrs)
        dtype = d.get("data-type")
        if dtype == "currency":
            self.commands.append({
                "command_type": "currency",
                "character_id": int(d.get("data-char-id") or 0),
                "item_id": None,
                "data": json.dumps({
                    "currencyName": d.get("data-currency-name", ""),
                    "delta": int(d.get("data-delta") or 0),
                }),
                "order_index": self._order,
            })
            self._order += 1
        elif dtype == "item":
            raw_item = int(d.get("data-item-id") or 0)
            self.commands.append({
                "command_type": "item",
                "character_id": int(d.get("data-char-id") or 0),
                "item_id": raw_item or None,
                "data": json.dumps({"qty": int(d.get("data-qty") or 1)}),
                "order_index": self._order,
            })
            self._order += 1


@router.post("/api/projects/{project_id}/commands/resync")
def resync_all_project_commands(project_id: int, db: Session = Depends(get_db)):
    """Re-extract commands from every scene's HTML and rebuild SceneCommand records.

    Fixes the case where the 2-second debounced sync never fired (e.g. user
    navigated away before it triggered).  Safe to call repeatedly — idempotent.
    """
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Act.project_id == project_id)
        .all()
    )

    for scene in scenes:
        db.query(SceneCommand).filter(SceneCommand.scene_id == scene.id).delete()
        if not scene.content:
            continue
        extractor = _CommandExtractor()
        extractor.feed(scene.content)
        for cmd in extractor.commands:
            db.add(SceneCommand(
                scene_id=scene.id,
                command_type=cmd["command_type"],
                character_id=cmd["character_id"],
                item_id=cmd["item_id"],
                data=cmd["data"],
                scene_time=scene.scene_time,
                order_index=cmd["order_index"],
            ))

    db.commit()
    return {"ok": True}



@router.post("/api/scenes/{scene_id}/commands/sync", response_model=list[SceneCommandOut])
def sync_scene_commands(
    scene_id: int,
    body: SceneCommandSyncRequest,
    db: Session = Depends(get_db),
):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    # Replace all commands for this scene atomically
    db.query(SceneCommand).filter(SceneCommand.scene_id == scene_id).delete()

    new_cmds: list[SceneCommand] = []
    for cmd in body.commands:
        sc = SceneCommand(
            scene_id=scene_id,
            command_type=cmd.command_type,
            character_id=cmd.character_id,
            item_id=cmd.item_id,
            data=json.dumps(cmd.data) if cmd.data else None,
            scene_time=scene.scene_time,  # snapshot current scene time
            order_index=cmd.order_index,
        )
        db.add(sc)
        new_cmds.append(sc)

    db.commit()
    for sc in new_cmds:
        db.refresh(sc)
    return new_cmds


@router.get("/api/projects/{project_id}/command-history")
def get_command_history(
    project_id: int,
    command_type: Optional[str] = None,
    character_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Return all tracked commands for a project, grouped by scene, ordered chronologically."""
    # Gather all scene_ids that belong to this project
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Act.project_id == project_id)
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    scene_ids = [s.id for s in scenes]
    scene_map = {s.id: s for s in scenes}

    q = db.query(SceneCommand).filter(SceneCommand.scene_id.in_(scene_ids))
    if command_type:
        q = q.filter(SceneCommand.command_type == command_type)
    if character_id:
        q = q.filter(SceneCommand.character_id == character_id)

    commands = q.order_by(SceneCommand.scene_id, SceneCommand.order_index).all()

    # Group by scene
    grouped: dict[int, list] = {}
    for cmd in commands:
        grouped.setdefault(cmd.scene_id, []).append({
            "id": cmd.id,
            "command_type": cmd.command_type,
            "character_id": cmd.character_id,
            "item_id": cmd.item_id,
            "data": json.loads(cmd.data) if cmd.data else None,
            "scene_time": json.loads(cmd.scene_time) if cmd.scene_time else None,
            "order_index": cmd.order_index,
        })

    result = []
    for s in scenes:
        if s.id not in grouped:
            continue
        result.append({
            "scene_id": s.id,
            "scene_title": s.title or "Untitled",
            "scene_time": json.loads(s.scene_time) if s.scene_time else None,
            "commands": grouped[s.id],
        })

    return result


def _get_project_scenes_ordered(scene_id: int, db: Session):
    """Helper: return (project_id, ordered Scene list, scene_position dict) for a scene's project."""
    project_id = (
        db.query(Act.project_id)
        .join(Chapter, Chapter.act_id == Act.id)
        .join(Scene, Scene.chapter_id == Chapter.id)
        .filter(Scene.id == scene_id)
        .scalar()
    )
    if not project_id:
        return None, [], {}
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Act.project_id == project_id)
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    pos = {s.id: i for i, s in enumerate(scenes)}
    return project_id, scenes, pos


@router.get("/api/scenes/{scene_id}/item-log")
def get_item_log(
    scene_id: int,
    item_id: int = Query(...),
    character_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get/lost log for an item-character pair across all scenes, in story order."""
    _, scenes, pos = _get_project_scenes_ordered(scene_id, db)
    scene_map = {s.id: s for s in scenes}

    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "item",
            SceneCommand.item_id == item_id,
            SceneCommand.character_id == character_id,
        )
        .all()
    )

    result = []
    for cmd in sorted(cmds, key=lambda c: (pos.get(c.scene_id, 9999), c.order_index)):
        s = scene_map.get(cmd.scene_id)
        if not s:
            continue
        data = json.loads(cmd.data) if cmd.data else {}
        qty = int(data.get("qty", 1))
        result.append({
            "scene_id": cmd.scene_id,
            "scene_title": s.title or "Untitled Scene",
            "qty": qty,
            "is_current_scene": cmd.scene_id == scene_id,
        })
    return result


@router.get("/api/scenes/{scene_id}/currency-balance")
def get_currency_balance(
    scene_id: int,
    character_id: int = Query(...),
    currency_name: str = Query(...),
    db: Session = Depends(get_db),
):
    """Running balance for a character's currency from all scenes before this one."""
    _, scenes, pos = _get_project_scenes_ordered(scene_id, db)

    current_pos = pos.get(scene_id, -1)
    before_ids = {s.id for s in scenes if pos.get(s.id, 9999) < current_pos}

    if not before_ids:
        return {"balance": 0}

    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "currency",
            SceneCommand.character_id == character_id,
            SceneCommand.scene_id.in_(before_ids),
        )
        .all()
    )

    total = 0
    for cmd in cmds:
        data = json.loads(cmd.data) if cmd.data else {}
        if (data.get("currencyName") or "").strip() == currency_name:
            total += int(data.get("delta", 0))
    return {"balance": total}


@router.get("/api/codex/{character_id}/currencies")
def get_character_currencies(character_id: int, db: Session = Depends(get_db)):
    """All distinct currency names for a character (native + command-detected)."""
    names: set[str] = set()

    # Native currencies from inventory
    entry = db.get(CodexEntry, character_id)
    if entry and entry.inventory:
        try:
            inv = json.loads(entry.inventory)
            for c in inv.get("currencies", []):
                n = (c.get("name") or "").strip()
                if n:
                    names.add(n)
        except (json.JSONDecodeError, TypeError, KeyError):
            pass

    # Command-detected currencies
    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.character_id == character_id,
            SceneCommand.command_type == "currency",
        )
        .all()
    )
    for cmd in cmds:
        data = json.loads(cmd.data) if cmd.data else {}
        n = (data.get("currencyName") or "").strip()
        if n:
            names.add(n)

    return sorted(names)


@router.get("/api/projects/{project_id}/item-log")
def get_project_item_log(
    project_id: int,
    item_id: int = Query(...),
    character_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Full gain/loss log for an item-character pair across all project scenes in story order."""
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Act.project_id == project_id)
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    pos = {s.id: i for i, s in enumerate(scenes)}
    scene_map = {s.id: s for s in scenes}

    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "item",
            SceneCommand.item_id == item_id,
            SceneCommand.character_id == character_id,
        )
        .all()
    )

    result = []
    running = 0
    for cmd in sorted(cmds, key=lambda c: (pos.get(c.scene_id, 9999), c.order_index)):
        s = scene_map.get(cmd.scene_id)
        if not s:
            continue
        data = json.loads(cmd.data) if cmd.data else {}
        delta = int(data.get("qty", 1))
        running += delta
        result.append({
            "scene_id": cmd.scene_id,
            "scene_title": s.title or "Untitled",
            "delta": delta,
            "total": running,
        })
    return result


@router.get("/api/projects/{project_id}/currency-log")
def get_project_currency_log(
    project_id: int,
    character_id: int = Query(...),
    currency_name: str = Query(...),
    db: Session = Depends(get_db),
):
    """Full delta log for a character's currency across all project scenes in story order."""
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Act.project_id == project_id)
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    pos = {s.id: i for i, s in enumerate(scenes)}
    scene_map = {s.id: s for s in scenes}

    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "currency",
            SceneCommand.character_id == character_id,
        )
        .all()
    )

    result = []
    running = 0
    for cmd in sorted(cmds, key=lambda c: (pos.get(c.scene_id, 9999), c.order_index)):
        data = json.loads(cmd.data) if cmd.data else {}
        if (data.get("currencyName") or "").strip() != currency_name:
            continue
        s = scene_map.get(cmd.scene_id)
        if not s:
            continue
        delta = int(data.get("delta", 0))
        running += delta
        result.append({
            "scene_id": cmd.scene_id,
            "scene_title": s.title or "Untitled",
            "delta": delta,
            "balance": running,
        })
    return result


@router.get("/api/codex/{character_id}/item-log")
def get_character_item_log(
    character_id: int,
    item_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Full gain/loss log for an item-character pair in story order (no project filter)."""
    cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "item",
            SceneCommand.item_id == item_id,
            SceneCommand.character_id == character_id,
        )
        .all()
    )
    if not cmds:
        return []

    scene_ids = list({c.scene_id for c in cmds})
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Scene.id.in_(scene_ids))
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    pos = {s.id: i for i, s in enumerate(scenes)}
    scene_map = {s.id: s for s in scenes}

    result = []
    running = 0
    for cmd in sorted(cmds, key=lambda c: (pos.get(c.scene_id, 9999), c.order_index)):
        s = scene_map.get(cmd.scene_id)
        if not s:
            continue
        data = json.loads(cmd.data) if cmd.data else {}
        delta = int(data.get("qty", 1))
        running += delta
        result.append({
            "scene_id": cmd.scene_id,
            "scene_title": s.title or "Untitled",
            "delta": delta,
            "total": running,
        })
    return result


@router.get("/api/codex/{character_id}/currency-log")
def get_character_currency_log(
    character_id: int,
    currency_name: str = Query(...),
    db: Session = Depends(get_db),
):
    """Full delta log for a character's currency in story order (no project filter)."""
    all_cmds = (
        db.query(SceneCommand)
        .filter(
            SceneCommand.command_type == "currency",
            SceneCommand.character_id == character_id,
        )
        .all()
    )

    # Filter to the requested currency and keep parsed data alongside
    matching: list[tuple[SceneCommand, dict]] = []
    for cmd in all_cmds:
        data = json.loads(cmd.data) if cmd.data else {}
        if (data.get("currencyName") or "").strip() == currency_name:
            matching.append((cmd, data))

    if not matching:
        return []

    scene_ids = list({cmd.scene_id for cmd, _ in matching})
    scenes = (
        db.query(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Act, Chapter.act_id == Act.id)
        .filter(Scene.id.in_(scene_ids))
        .order_by(Act.order_index, Chapter.order_index, Scene.order_index)
        .all()
    )
    pos = {s.id: i for i, s in enumerate(scenes)}
    scene_map = {s.id: s for s in scenes}

    result = []
    running = 0
    for cmd, data in sorted(matching, key=lambda x: (pos.get(x[0].scene_id, 9999), x[0].order_index)):
        s = scene_map.get(cmd.scene_id)
        if not s:
            continue
        delta = int(data.get("delta", 0))
        running += delta
        result.append({
            "scene_id": cmd.scene_id,
            "scene_title": s.title or "Untitled",
            "delta": delta,
            "balance": running,
        })
    return result


@router.get("/api/codex/{character_id}/inventory-summary")
def get_inventory_summary(character_id: int, db: Session = Depends(get_db)):
    """Combined inventory: native base (from CodexEntry.inventory) + scene command deltas.

    Native items are shown even when total reaches 0 (item was lost in the story).
    """
    # ── Native base ───────────────────────────────────────────────────────────
    entry = db.get(CodexEntry, character_id)
    native_items: dict[int, int] = {}       # item_id -> base qty
    native_currencies: dict[str, int] = {}  # name    -> base amount
    if entry and entry.inventory:
        try:
            inv = json.loads(entry.inventory)
            for p in inv.get("possessions", []):
                eid = int(p.get("entry_id", 0))
                if eid:
                    native_items[eid] = int(p.get("quantity", 0))
            for c in inv.get("currencies", []):
                name = (c.get("name") or "").strip()
                if name:
                    native_currencies[name] = int(c.get("amount", 0))
        except (json.JSONDecodeError, TypeError, KeyError, ValueError):
            pass

    # ── Command deltas ────────────────────────────────────────────────────────
    cmds = (
        db.query(SceneCommand)
        .filter(SceneCommand.character_id == character_id)
        .all()
    )
    cmd_items: dict[int, int] = {}
    cmd_currencies: dict[str, int] = {}
    for cmd in cmds:
        data = json.loads(cmd.data) if cmd.data else {}
        if cmd.command_type == "item" and cmd.item_id:
            qty = int(data.get("qty", 1))
            cmd_items[cmd.item_id] = cmd_items.get(cmd.item_id, 0) + qty
        elif cmd.command_type == "currency":
            name = (data.get("currencyName") or "").strip()
            delta = int(data.get("delta", 0))
            if name:
                cmd_currencies[name] = cmd_currencies.get(name, 0) + delta

    # ── Combine ───────────────────────────────────────────────────────────────
    items = []
    for item_id in set(native_items) | set(cmd_items):
        native = native_items.get(item_id, 0)
        total  = native + cmd_items.get(item_id, 0)
        # Keep native entries even at 0 (lost item), drop command-only zeros
        if total != 0 or native > 0:
            items.append({"item_id": item_id, "qty": total})

    currencies = []
    for name in set(native_currencies) | set(cmd_currencies):
        total = native_currencies.get(name, 0) + cmd_currencies.get(name, 0)
        currencies.append({"name": name, "balance": total})

    return {"items": items, "currencies": currencies}

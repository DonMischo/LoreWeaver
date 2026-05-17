import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Scene, SceneCommand, CodexEntry, Act, Chapter
from schemas import SceneCommandSyncRequest, SceneCommandOut

router = APIRouter(tags=["scene_commands"])


def _get_project_id_for_scene(scene_id: int, db: Session) -> Optional[int]:
    return (
        db.query(Act.project_id)
        .join(Chapter, Chapter.act_id == Act.id)
        .join(Scene, Scene.chapter_id == Chapter.id)
        .filter(Scene.id == scene_id)
        .scalar()
    )


def _get_all_project_commands(project_id: int, db: Session):
    """Return all SceneCommands for a project (auto-flush sees pending session changes)."""
    return (
        db.query(SceneCommand)
        .join(Scene, Scene.id == SceneCommand.scene_id)
        .join(Chapter, Chapter.id == Scene.chapter_id)
        .join(Act, Act.id == Chapter.act_id)
        .filter(Act.project_id == project_id)
        .all()
    )


def _sync_character_inventories(project_id: int, db: Session) -> None:
    """Recompute CodexEntry.inventory (possessions + currencies) from scene commands."""
    cmds = _get_all_project_commands(project_id, db)

    char_items: dict[int, dict[int, int]] = {}       # char_id -> {item_id -> net qty}
    char_currencies: dict[int, dict[str, int]] = {}  # char_id -> {name -> balance}

    for cmd in cmds:
        if cmd.character_id <= 0:
            continue
        data = json.loads(cmd.data) if cmd.data else {}
        if cmd.command_type == "item" and cmd.item_id:
            qty = int(data.get("qty", 1))
            char_items.setdefault(cmd.character_id, {})
            char_items[cmd.character_id][cmd.item_id] = (
                char_items[cmd.character_id].get(cmd.item_id, 0) + qty
            )
        elif cmd.command_type == "currency":
            name = (data.get("currencyName") or "").strip()
            delta = int(data.get("delta", 0))
            if name:
                char_currencies.setdefault(cmd.character_id, {})
                char_currencies[cmd.character_id][name] = (
                    char_currencies[cmd.character_id].get(name, 0) + delta
                )

    for char_id in set(char_items) | set(char_currencies):
        entry = db.get(CodexEntry, char_id)
        if not entry:
            continue
        possessions = [
            {"entry_id": k, "quantity": v}
            for k, v in char_items.get(char_id, {}).items()
            if v != 0
        ]
        currencies = [
            {"name": k, "amount": v}
            for k, v in char_currencies.get(char_id, {}).items()
        ]
        entry.inventory = json.dumps({"possessions": possessions, "currencies": currencies})


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

    project_id = _get_project_id_for_scene(scene_id, db)
    if project_id:
        _sync_character_inventories(project_id, db)

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
    """All distinct currency names for a character, read from CodexEntry.inventory."""
    entry = db.get(CodexEntry, character_id)
    if not entry or not entry.inventory:
        return []
    try:
        inv = json.loads(entry.inventory)
        return sorted(c["name"] for c in inv.get("currencies", []) if c.get("name"))
    except (json.JSONDecodeError, TypeError, KeyError):
        return []


@router.get("/api/codex/{character_id}/inventory-summary")
def get_inventory_summary(character_id: int, db: Session = Depends(get_db)):
    """Net item quantities and currency balances for a character across all scenes."""
    cmds = (
        db.query(SceneCommand)
        .filter(SceneCommand.character_id == character_id)
        .all()
    )

    item_totals: dict[int, int] = {}
    currency_totals: dict[str, int] = {}

    for cmd in cmds:
        data = json.loads(cmd.data) if cmd.data else {}
        if cmd.command_type == "item" and cmd.item_id:
            qty = int(data.get("qty", 1))
            item_totals[cmd.item_id] = item_totals.get(cmd.item_id, 0) + qty
        elif cmd.command_type == "currency":
            name = (data.get("currencyName") or "").strip()
            delta = int(data.get("delta", 0))
            if name:
                currency_totals[name] = currency_totals.get(name, 0) + delta

    return {
        "items": [
            {"item_id": k, "qty": v}
            for k, v in item_totals.items()
            if v != 0
        ],
        "currencies": [
            {"name": k, "balance": v}
            for k, v in currency_totals.items()
        ],
    }

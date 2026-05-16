import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Scene, SceneCommand, CodexEntry, Act, Chapter, Project
from schemas import SceneCommandSyncRequest, SceneCommandOut

router = APIRouter(tags=["scene_commands"])


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

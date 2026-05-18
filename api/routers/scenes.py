import re
import json
import hashlib
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Chapter, Scene, SceneVersion
from schemas import SceneCreate, SceneOut, SceneUpdate, ReorderRequest, SceneVersionOut, SceneVersionDetail, CreateVersionRequest


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

router = APIRouter(tags=["scenes"])


def _auto_title(content: str) -> str:
    text = re.sub(r"<[^>]+>", "", content or "").strip()
    return text[:50] if text else "Untitled Scene"


def _count_words(content: str) -> int:
    text = re.sub(r"<[^>]+>", "", content or "")
    return len(text.split())


@router.get("/api/chapters/{chapter_id}/scenes", response_model=list[SceneOut])
def list_scenes(chapter_id: int, db: Session = Depends(get_db)):
    if not db.get(Chapter, chapter_id):
        raise HTTPException(404, "Chapter not found")
    return db.query(Scene).filter(Scene.chapter_id == chapter_id).order_by(Scene.order_index).all()


@router.post("/api/scenes", response_model=SceneOut, status_code=201)
def create_scene(body: SceneCreate, db: Session = Depends(get_db)):
    if not db.get(Chapter, body.chapter_id):
        raise HTTPException(404, "Chapter not found")
    data = body.model_dump()
    if not data.get("title") and data.get("content"):
        data["title"] = _auto_title(data["content"])
    data["word_count"] = _count_words(data.get("content", ""))
    scene = Scene(**data)
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.get("/api/scenes/{scene_id}", response_model=SceneOut)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    return scene


@router.patch("/api/scenes/{scene_id}", response_model=SceneOut)
def update_scene(scene_id: int, body: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    data = body.model_dump(exclude_none=True)
    if "content" in data:
        if not scene.title and not body.title:
            scene.title = _auto_title(data["content"])
        data["word_count"] = _count_words(data["content"])
    # Handle scene_time separately — None means "clear it", so bypass exclude_none
    if "scene_time" in body.model_fields_set:
        st = body.scene_time
        data["scene_time"] = json.dumps(st) if st is not None else None
    for k, v in data.items():
        setattr(scene, k, v)
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/api/scenes/{scene_id}", status_code=204)
def delete_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    db.delete(scene)
    db.commit()


@router.post("/api/scenes/reorder", status_code=204)
def reorder_scenes(body: ReorderRequest, db: Session = Depends(get_db)):
    for item in body.items:
        scene = db.get(Scene, item.id)
        if scene:
            scene.order_index = item.order_index
    db.commit()


# ── Scene Versions ────────────────────────────────────────────────────────────

def _prune_versions(scene_id: int, db: Session) -> None:
    """Keep max 30 versions. If >30 exist, apply 30-day rule first, then hard-cap at 30."""
    versions = (
        db.query(SceneVersion)
        .filter(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.created_at.desc())
        .all()
    )
    if len(versions) <= 30:
        return
    # Step 1: delete versions older than 30 days
    cutoff = _now() - timedelta(days=30)
    for v in versions:
        if v.created_at < cutoff:
            db.delete(v)
    db.flush()
    # Step 2: hard-cap at 30 (delete oldest first)
    remaining = (
        db.query(SceneVersion)
        .filter(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.created_at.desc())
        .all()
    )
    for v in remaining[30:]:
        db.delete(v)
    db.flush()


@router.post("/api/scenes/{scene_id}/versions", status_code=201)
def create_scene_version(scene_id: int, body: CreateVersionRequest, db: Session = Depends(get_db)):
    """Snapshot current scene content. Skips if content is identical to latest version."""
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    content = body.content or ""
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    # Dedup: skip if latest snapshot has same content
    latest = (
        db.query(SceneVersion)
        .filter(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.created_at.desc())
        .first()
    )
    if latest and latest.content_hash == content_hash:
        return SceneVersionOut.model_validate(latest)

    version = SceneVersion(scene_id=scene_id, content=content, content_hash=content_hash)
    db.add(version)
    db.flush()
    _prune_versions(scene_id, db)
    db.commit()
    db.refresh(version)
    return SceneVersionOut.model_validate(version)


@router.get("/api/scenes/{scene_id}/versions", response_model=list[SceneVersionOut])
def list_scene_versions(scene_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SceneVersion)
        .filter(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.created_at.desc())
        .all()
    )


@router.get("/api/scenes/{scene_id}/versions/{version_id}", response_model=SceneVersionDetail)
def get_scene_version(scene_id: int, version_id: int, db: Session = Depends(get_db)):
    v = db.query(SceneVersion).filter(
        SceneVersion.id == version_id,
        SceneVersion.scene_id == scene_id,
    ).first()
    if not v:
        raise HTTPException(404, "Version not found")
    return v


@router.post("/api/scenes/{scene_id}/versions/{version_id}/restore", response_model=SceneVersionDetail)
def restore_scene_version(scene_id: int, version_id: int, db: Session = Depends(get_db)):
    """Snapshot current content, then restore the given version."""
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    target = db.query(SceneVersion).filter(
        SceneVersion.id == version_id,
        SceneVersion.scene_id == scene_id,
    ).first()
    if not target:
        raise HTTPException(404, "Version not found")

    # Snapshot current content before overwriting (with dedup)
    current_hash = hashlib.sha256((scene.content or "").encode("utf-8")).hexdigest()
    latest = (
        db.query(SceneVersion)
        .filter(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.created_at.desc())
        .first()
    )
    if not latest or latest.content_hash != current_hash:
        snap = SceneVersion(scene_id=scene_id, content=scene.content or "", content_hash=current_hash)
        db.add(snap)
        db.flush()
        _prune_versions(scene_id, db)

    # Restore
    scene.content = target.content
    db.commit()
    db.refresh(target)
    return target

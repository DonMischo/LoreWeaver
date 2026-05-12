import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Chapter, Scene
from schemas import SceneCreate, SceneOut, SceneUpdate, ReorderRequest

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

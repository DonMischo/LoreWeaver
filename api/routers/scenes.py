import re
import json
import hashlib
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import Chapter, Scene, SceneVersion, MentionStat, CodexEntry
from schemas import SceneCreate, SceneOut, SceneUpdate, ReorderRequest, SceneVersionOut, SceneVersionDetail, CreateVersionRequest, MentionStatOut


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ── Mention scanning ──────────────────────────────────────────────────────────

def _scan_mentions(content: str, entries: list[CodexEntry]) -> dict[int, int]:
    """Return {codex_id: count} for every entry that appears in content."""
    plain = re.sub(r"<[^>]+>", "", content or "")
    counts: dict[int, int] = {}
    for entry in entries:
        names = [entry.name] + (json.loads(entry.aliases or "[]") if entry.aliases else [])
        names = [n for n in names if n]
        if not names:
            continue
        pattern = r"\b(?:" + "|".join(re.escape(n) for n in names) + r")\b"
        c = len(re.findall(pattern, plain, re.IGNORECASE))
        if c:
            counts[entry.id] = c
    return counts


def _update_mention_stats(scene_id: int, content: str, db: Session) -> None:
    """Rescan a scene and upsert mention_stats rows. Called after every content save."""
    # Resolve project_id via scene→chapter→act chain
    row = db.execute(
        text("""
            SELECT a.project_id
            FROM scenes s
            JOIN chapters c ON c.id = s.chapter_id
            JOIN acts a     ON a.id = c.act_id
            WHERE s.id = :sid
        """),
        {"sid": scene_id},
    ).first()
    if not row:
        return
    project_id = row[0]

    entries = db.query(CodexEntry).filter(CodexEntry.project_id == project_id).all()
    counts = _scan_mentions(content, entries)

    # Replace all existing stats for this scene
    db.query(MentionStat).filter(MentionStat.scene_id == scene_id).delete()
    for codex_id, count in counts.items():
        db.add(MentionStat(scene_id=scene_id, codex_id=codex_id, count=count))
    db.flush()

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
    db.flush()  # gives scene.id before commit so mention scan can reference it
    _update_mention_stats(scene.id, data.get("content") or "", db)
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
    if "content" in data:
        _update_mention_stats(scene_id, data["content"], db)
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


# ── Mention stats endpoints ───────────────────────────────────────────────────

@router.get("/api/scenes/{scene_id}/mention-stats", response_model=list[MentionStatOut])
def get_scene_mention_stats(scene_id: int, db: Session = Depends(get_db)):
    """Return mention counts for every codex entry in this scene."""
    rows = db.query(MentionStat).filter(MentionStat.scene_id == scene_id).all()
    return [MentionStatOut(codex_id=r.codex_id, scene_id=r.scene_id, count=r.count) for r in rows]


@router.get("/api/projects/{project_id}/mention-stats", response_model=list[MentionStatOut])
def get_project_mention_stats(project_id: int, db: Session = Depends(get_db)):
    """Return aggregated mention counts across all scenes for a project."""
    rows = db.execute(
        text("""
            SELECT ms.codex_id, SUM(ms.count) AS total
            FROM mention_stats ms
            JOIN scenes s   ON s.id  = ms.scene_id
            JOIN chapters c ON c.id  = s.chapter_id
            JOIN acts a     ON a.id  = c.act_id
            WHERE a.project_id = :pid
            GROUP BY ms.codex_id
            ORDER BY total DESC
        """),
        {"pid": project_id},
    ).fetchall()
    return [MentionStatOut(codex_id=r[0], scene_id=None, count=r[1]) for r in rows]


@router.post("/api/projects/{project_id}/mentions/rescan")
def rescan_project_mentions(project_id: int, db: Session = Depends(get_db)):
    """Rebuild mention_stats for every scene in the project.
    Safe to call at any time — replaces all existing stats for affected scenes."""
    rows = db.execute(
        text("""
            SELECT s.id, s.content
            FROM scenes s
            JOIN chapters c ON c.id = s.chapter_id
            JOIN acts     a ON a.id = c.act_id
            WHERE a.project_id = :pid
        """),
        {"pid": project_id},
    ).fetchall()
    for scene_id, content in rows:
        _update_mention_stats(scene_id, content or "", db)
    db.commit()
    return {"scanned": len(rows)}

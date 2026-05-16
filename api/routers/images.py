import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from models import Project, CodexEntry

router = APIRouter(tags=["images"])

UPLOAD_DIR = "uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _save_upload(file: UploadFile, subdir: str, stem: str) -> str:
    """Save uploaded file and return the relative path stored in DB."""
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    dest_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(dest_dir, exist_ok=True)
    rel_path = f"{UPLOAD_DIR}/{subdir}/{stem}{ext}"
    with open(rel_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return rel_path


def _delete_file(path: str) -> None:
    if path and os.path.exists(path):
        os.remove(path)


# ── Project cover ─────────────────────────────────────────────────────────────

@router.post("/api/projects/{project_id}/cover")
def upload_project_cover(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported image type. Use JPG, PNG, WebP, or GIF.")
    _delete_file(project.cover_image or "")
    project.cover_image = _save_upload(file, f"projects/{project_id}", "cover")
    db.commit()
    return {"cover_image": project.cover_image}


@router.delete("/api/projects/{project_id}/cover", status_code=204)
def delete_project_cover(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    _delete_file(project.cover_image or "")
    project.cover_image = None
    db.commit()


# ── Codex entry image ─────────────────────────────────────────────────────────

@router.post("/api/codex/{entry_id}/image")
def upload_codex_image(
    entry_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    entry = db.get(CodexEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Codex entry not found")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported image type. Use JPG, PNG, WebP, or GIF.")
    _delete_file(entry.image_path or "")
    entry.image_path = _save_upload(file, f"codex/{entry_id}", "image")
    db.commit()
    return {"image_path": entry.image_path}


@router.delete("/api/codex/{entry_id}/image", status_code=204)
def delete_codex_image(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(CodexEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Codex entry not found")
    _delete_file(entry.image_path or "")
    entry.image_path = None
    db.commit()

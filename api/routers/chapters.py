from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Chapter, Project
from schemas import ChapterCreate, ChapterOut, ChapterUpdate, ReorderRequest

router = APIRouter(tags=["chapters"])


@router.get("/api/projects/{project_id}/chapters", response_model=list[ChapterOut])
def list_chapters(project_id: int, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    return db.query(Chapter).filter(Chapter.project_id == project_id).order_by(Chapter.order_index).all()


@router.post("/api/chapters", response_model=ChapterOut, status_code=201)
def create_chapter(body: ChapterCreate, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    chapter = Chapter(**body.model_dump())
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.patch("/api/chapters/{chapter_id}", response_model=ChapterOut)
def update_chapter(chapter_id: int, body: ChapterUpdate, db: Session = Depends(get_db)):
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(chapter, k, v)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.delete("/api/chapters/{chapter_id}", status_code=204)
def delete_chapter(chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    db.delete(chapter)
    db.commit()


@router.post("/api/chapters/reorder", status_code=204)
def reorder_chapters(body: ReorderRequest, db: Session = Depends(get_db)):
    for item in body.items:
        chapter = db.get(Chapter, item.id)
        if chapter:
            chapter.order_index = item.order_index
    db.commit()

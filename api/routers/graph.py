from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Project, Act, Chapter, CodexEntry
from services.tags import build_relations_graph, build_timeline

router = APIRouter(prefix="/api/projects", tags=["graph"])


def _load_project(project_id: int, db: Session):
    project = (
        db.query(Project)
        .options(
            selectinload(Project.acts)
            .selectinload(Act.chapters)
            .selectinload(Chapter.scenes),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def _load_codex(project_id: int, db: Session):
    return (
        db.query(CodexEntry)
        .options(
            selectinload(CodexEntry.relations_from).selectinload("target"),
        )
        .filter(CodexEntry.project_id == project_id)
        .all()
    )


@router.get("/{project_id}/graph")
def get_relations_graph(project_id: int, db: Session = Depends(get_db)):
    project = _load_project(project_id, db)
    codex = _load_codex(project_id, db)
    return build_relations_graph(project, codex)


@router.get("/{project_id}/timeline")
def get_timeline(project_id: int, db: Session = Depends(get_db)):
    project = _load_project(project_id, db)
    return build_timeline(project)

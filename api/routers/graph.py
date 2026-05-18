from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Project, Act, Chapter, CodexEntry, CodexRelation
from services.tags import build_relations_graph

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
            selectinload(CodexEntry.relations_from).selectinload(CodexRelation.target),
        )
        .filter(CodexEntry.project_id == project_id)
        .all()
    )


@router.get("/{project_id}/graph")
def get_relations_graph(project_id: int, db: Session = Depends(get_db)):
    project = _load_project(project_id, db)
    codex_owner_id = project.shared_codex_project_id or project_id
    codex = _load_codex(codex_owner_id, db)
    return build_relations_graph(project, codex)



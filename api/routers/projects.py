from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, CodexEntry, CodexRelation
from schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.updated_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"copy_codex_from"})
    project = Project(**data)

    # Copy time config from source project if requested
    source_id = body.copy_codex_from
    if source_id:
        source = db.get(Project, source_id)
        if not source:
            raise HTTPException(404, f"Source project {source_id} not found")
        if source.time_config:
            project.time_config = source.time_config

    db.add(project)
    db.commit()
    db.refresh(project)

    # Deep-copy codex entries + relations from source project
    if source_id:
        source_entries = (
            db.query(CodexEntry)
            .filter(CodexEntry.project_id == source_id)
            .all()
        )
        old_to_new: dict[int, int] = {}
        for src in source_entries:
            new_entry = CodexEntry(
                project_id=project.id,
                name=src.name,
                aliases=src.aliases,
                entry_type=src.entry_type,
                description=src.description,
                notes=src.notes,
                color=src.color,
                entry_group=src.entry_group,
                species=src.species,
                subtype=src.subtype,
                tags=src.tags,
            )
            db.add(new_entry)
            db.flush()  # get new id without full commit
            old_to_new[src.id] = new_entry.id

        # Copy relations where both endpoints are within the copied set
        source_relations = (
            db.query(CodexRelation)
            .filter(
                CodexRelation.source_id.in_(old_to_new.keys()),
                CodexRelation.target_id.in_(old_to_new.keys()),
            )
            .all()
        )
        for rel in source_relations:
            new_rel = CodexRelation(
                source_id=old_to_new[rel.source_id],
                target_id=old_to_new[rel.target_id],
                relation_type=rel.relation_type,
            )
            db.add(new_rel)

        db.commit()
        db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()

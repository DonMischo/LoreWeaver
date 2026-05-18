import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, CodexEntry, CodexRelation, Act, Chapter, Scene
from schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.updated_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"copy_codex_from", "share_codex_from"})
    project = Project(**data)

    copy_id  = body.copy_codex_from
    share_id = body.share_codex_from

    if share_id:
        # Live-share: point to the canonical codex owner
        source = db.get(Project, share_id)
        if not source:
            raise HTTPException(404, f"Source project {share_id} not found")
        # Follow chain: if source is itself sharing, point to its owner
        owner_id = source.shared_codex_project_id or source.id
        project.shared_codex_project_id = owner_id
        # Inherit time config from codex owner
        owner = db.get(Project, owner_id)
        if owner and owner.time_config:
            project.time_config = owner.time_config
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    if copy_id:
        source = db.get(Project, copy_id)
        if not source:
            raise HTTPException(404, f"Source project {copy_id} not found")
        if source.time_config:
            project.time_config = source.time_config

    db.add(project)
    db.commit()
    db.refresh(project)

    # Deep-copy codex entries + relations from source project
    if copy_id:
        # Resolve to actual codex owner in case source is sharing
        actual_copy_id = source.shared_codex_project_id or copy_id  # type: ignore[possibly-undefined]
        source_entries = (
            db.query(CodexEntry)
            .filter(CodexEntry.project_id == actual_copy_id)
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
                species=src.species,
                subtype=src.subtype,
                tags=src.tags,
                is_main_char=src.is_main_char,
                inventory=src.inventory,
            )
            new_entry.set_groups(src.get_groups())
            db.add(new_entry)
            db.flush()
            old_to_new[src.id] = new_entry.id

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
    data = body.model_dump(exclude_none=True)
    # Serialize nested model to JSON string for TEXT column
    if "book_meta" in data:
        data["book_meta"] = json.dumps(data["book_meta"])
    for k, v in data.items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    # Block deletion if other projects live-share this project's codex
    sharers = db.query(Project).filter(Project.shared_codex_project_id == project_id).count()
    if sharers > 0:
        raise HTTPException(
            409,
            f"Cannot delete: {sharers} other project(s) share this project's codex. "
            "Remove the sharing link from those projects first."
        )
    db.delete(project)
    db.commit()


@router.get("/{project_id}/scenes")
def list_project_scenes(project_id: int, db: Session = Depends(get_db)):
    """Flat list of all scenes in a project, ordered by act/chapter/scene position."""
    acts = (
        db.query(Act)
        .filter(Act.project_id == project_id)
        .order_by(Act.order_index)
        .all()
    )
    result = []
    for act in acts:
        chapters = sorted(act.chapters, key=lambda c: c.order_index)
        for chapter in chapters:
            scenes = sorted(chapter.scenes, key=lambda s: s.order_index)
            for scene in scenes:
                result.append({
                    "id": scene.id,
                    "title": scene.title or "Untitled Scene",
                    "chapter_title": chapter.title,
                    "act_title": act.title,
                })
    return result

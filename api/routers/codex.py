from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import CodexEntry, CodexRelation, Project
from schemas import (
    CodexEntryCreate, CodexEntryOut, CodexEntryUpdate,
    CodexRelationCreate, CodexRelationOut,
)

router = APIRouter(tags=["codex"])


@router.get("/api/projects/{project_id}/codex", response_model=list[CodexEntryOut])
def list_codex(project_id: int, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    entries = db.query(CodexEntry).filter(CodexEntry.project_id == project_id).all()
    return [CodexEntryOut.from_orm_entry(e) for e in entries]


@router.post("/api/codex", response_model=CodexEntryOut, status_code=201)
def create_codex_entry(body: CodexEntryCreate, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    data = body.model_dump()
    aliases = data.pop("aliases", [])
    tags    = data.pop("tags", [])
    group   = data.pop("group", None)
    data["entry_group"] = group
    entry = CodexEntry(**data)
    entry.set_aliases(aliases)
    entry.set_tags(tags)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return CodexEntryOut.from_orm_entry(entry)


@router.get("/api/codex/{entry_id}", response_model=CodexEntryOut)
def get_codex_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(CodexEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Codex entry not found")
    return CodexEntryOut.from_orm_entry(entry)


@router.patch("/api/codex/{entry_id}", response_model=CodexEntryOut)
def update_codex_entry(entry_id: int, body: CodexEntryUpdate, db: Session = Depends(get_db)):
    entry = db.get(CodexEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Codex entry not found")
    data = body.model_dump(exclude_none=True)
    if "aliases" in data:
        entry.set_aliases(data.pop("aliases"))
    if "tags" in data:
        entry.set_tags(data.pop("tags"))
    if "group" in data:
        entry.entry_group = data.pop("group")
    for k, v in data.items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return CodexEntryOut.from_orm_entry(entry)


@router.delete("/api/codex/{entry_id}", status_code=204)
def delete_codex_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(CodexEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Codex entry not found")
    db.delete(entry)
    db.commit()


# ── Relations ─────────────────────────────────────────────────────────────────

@router.get("/api/codex/{entry_id}/relations")
def get_entry_relations(entry_id: int, db: Session = Depends(get_db)):
    """Return all relations for an entry (as source or target), with resolved names."""
    entry = (
        db.query(CodexEntry)
        .options(
            selectinload(CodexEntry.relations_from).selectinload(CodexRelation.target),
            selectinload(CodexEntry.relations_to).selectinload(CodexRelation.source),
        )
        .filter(CodexEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Codex entry not found")

    result = []
    for rel in entry.relations_from:
        result.append({
            "id": rel.id,
            "source_id": rel.source_id,
            "target_id": rel.target_id,
            "other_id": rel.target_id,
            "other_name": rel.target.name,
            "other_color": rel.target.color,
            "other_type": rel.target.entry_type,
            "relation_type": rel.relation_type or "",
            "direction": "from",
        })
    for rel in entry.relations_to:
        result.append({
            "id": rel.id,
            "source_id": rel.source_id,
            "target_id": rel.target_id,
            "other_id": rel.source_id,
            "other_name": rel.source.name,
            "other_color": rel.source.color,
            "other_type": rel.source.entry_type,
            "relation_type": rel.relation_type or "",
            "direction": "to",
        })
    return result


@router.post("/api/codex/relations", response_model=CodexRelationOut, status_code=201)
def create_relation(body: CodexRelationCreate, db: Session = Depends(get_db)):
    if not db.get(CodexEntry, body.source_id):
        raise HTTPException(404, "Source entry not found")
    if not db.get(CodexEntry, body.target_id):
        raise HTTPException(404, "Target entry not found")
    # Prevent duplicates
    existing = (
        db.query(CodexRelation)
        .filter(CodexRelation.source_id == body.source_id, CodexRelation.target_id == body.target_id)
        .first()
    )
    if existing:
        existing.relation_type = body.relation_type
        db.commit()
        db.refresh(existing)
        return existing
    rel = CodexRelation(**body.model_dump())
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.delete("/api/codex/relations/{relation_id}", status_code=204)
def delete_relation(relation_id: int, db: Session = Depends(get_db)):
    rel = db.get(CodexRelation, relation_id)
    if not rel:
        raise HTTPException(404, "Relation not found")
    db.delete(rel)
    db.commit()

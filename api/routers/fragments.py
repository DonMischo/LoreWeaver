import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Fragment
from schemas import FragmentCreate, FragmentOut, FragmentUpdate, TabsUpdate, BUILTIN_TABS

router = APIRouter(tags=["fragments"])


def _get_custom_tabs(project: Project) -> list[str]:
    if project.fragment_tabs:
        try:
            return json.loads(project.fragment_tabs)
        except Exception:
            pass
    return []


def _all_tabs(project: Project) -> list[str]:
    return BUILTIN_TABS + _get_custom_tabs(project)


# ── Tab management ────────────────────────────────────────────────────────────

@router.get("/api/projects/{project_id}/fragment-tabs")
def get_tabs(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return {
        "builtin": BUILTIN_TABS,
        "custom": _get_custom_tabs(project),
        "all": _all_tabs(project),
    }


@router.patch("/api/projects/{project_id}/fragment-tabs")
def update_tabs(project_id: int, body: TabsUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    # Normalise: strip blanks, deduplicate, exclude builtins
    custom = list(dict.fromkeys(
        t.strip() for t in body.custom_tabs
        if t.strip() and t.strip().lower() not in BUILTIN_TABS
    ))
    project.fragment_tabs = json.dumps(custom)
    db.commit()
    return {
        "builtin": BUILTIN_TABS,
        "custom": custom,
        "all": BUILTIN_TABS + custom,
    }


# ── Fragment CRUD ─────────────────────────────────────────────────────────────

@router.get("/api/projects/{project_id}/fragments", response_model=list[FragmentOut])
def list_fragments(project_id: int, tab: str | None = None, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    q = db.query(Fragment).filter(Fragment.project_id == project_id)
    if tab:
        q = q.filter(Fragment.tab == tab)
    return q.order_by(Fragment.tab, Fragment.order_index, Fragment.created_at).all()


@router.post("/api/projects/{project_id}/fragments", response_model=FragmentOut, status_code=201)
def create_fragment(project_id: int, body: FragmentCreate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    # Validate tab exists
    if body.tab not in _all_tabs(project):
        raise HTTPException(400, f"Unknown tab '{body.tab}'")
    fragment = Fragment(project_id=project_id, **body.model_dump())
    db.add(fragment)
    db.commit()
    db.refresh(fragment)
    return fragment


@router.patch("/api/fragments/{fragment_id}", response_model=FragmentOut)
def update_fragment(fragment_id: int, body: FragmentUpdate, db: Session = Depends(get_db)):
    fragment = db.get(Fragment, fragment_id)
    if not fragment:
        raise HTTPException(404, "Fragment not found")
    if body.tab is not None:
        project = db.get(Project, fragment.project_id)
        if body.tab not in _all_tabs(project):
            raise HTTPException(400, f"Unknown tab '{body.tab}'")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(fragment, k, v)
    db.commit()
    db.refresh(fragment)
    return fragment


@router.delete("/api/fragments/{fragment_id}", status_code=204)
def delete_fragment(fragment_id: int, db: Session = Depends(get_db)):
    fragment = db.get(Fragment, fragment_id)
    if not fragment:
        raise HTTPException(404, "Fragment not found")
    db.delete(fragment)
    db.commit()

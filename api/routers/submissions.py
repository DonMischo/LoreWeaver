"""Query / submission tracker — literary agents and publishers."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import QuerySubmission
from schemas import QuerySubmissionCreate, QuerySubmissionUpdate, QuerySubmissionOut

router = APIRouter(tags=["submissions"])


@router.get("/api/projects/{project_id}/submissions", response_model=list[QuerySubmissionOut])
def list_submissions(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(QuerySubmission)
        .filter(QuerySubmission.project_id == project_id)
        .order_by(QuerySubmission.date_sent.desc().nullslast(), QuerySubmission.created_at.desc())
        .all()
    )


@router.post("/api/projects/{project_id}/submissions", response_model=QuerySubmissionOut, status_code=201)
def create_submission(project_id: int, data: QuerySubmissionCreate, db: Session = Depends(get_db)):
    item = QuerySubmission(project_id=project_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/api/submissions/{item_id}", response_model=QuerySubmissionOut)
def update_submission(item_id: int, data: QuerySubmissionUpdate, db: Session = Depends(get_db)):
    item = db.get(QuerySubmission, item_id)
    if not item:
        raise HTTPException(404, "Submission not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/submissions/{item_id}", status_code=204)
def delete_submission(item_id: int, db: Session = Depends(get_db)):
    item = db.get(QuerySubmission, item_id)
    if not item:
        raise HTTPException(404, "Submission not found")
    db.delete(item)
    db.commit()

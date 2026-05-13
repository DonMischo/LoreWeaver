import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Project, Act, Chapter
from schemas import ExportOptions
from services.export import export_markdown, export_latex, export_epub_style

router = APIRouter(prefix="/api/projects", tags=["export"])


def _safe_filename(title: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", title)


def _load_project(project_id: int, db: Session) -> Project:
    project = (
        db.query(Project)
        .options(
            selectinload(Project.acts)
            .selectinload(Act.chapters)
            .selectinload(Chapter.scenes)
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.post("/{project_id}/export")
def export_project(
    project_id: int,
    opts: ExportOptions,
    db: Session = Depends(get_db),
):
    project = _load_project(project_id, db)
    safe_name = _safe_filename(project.title)

    if opts.format == "md":
        content = export_markdown(project, opts)
        return Response(
            content=content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.md"'},
        )

    if opts.format == "tex":
        content = export_latex(project, opts)
        return Response(
            content=content,
            media_type="application/x-tex",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.tex"'},
        )

    if opts.format == "epub-style":
        content = export_epub_style(project, opts)
        return Response(
            content=content,
            media_type="text/css",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}-style.css"'},
        )

    raise HTTPException(400, "Unknown format")


@router.get("/{project_id}/export/structure")
def export_structure(project_id: int, db: Session = Depends(get_db)):
    """Return acts → chapters → scenes hierarchy for the export dialog."""
    project = (
        db.query(Project)
        .options(
            selectinload(Project.acts)
            .selectinload(Act.chapters)
            .selectinload(Chapter.scenes)
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")

    return {
        "title": project.title,
        "acts": [
            {
                "id": act.id,
                "title": act.title,
                "order_index": act.order_index,
                "chapters": [
                    {
                        "id": ch.id,
                        "title": ch.title,
                        "order_index": ch.order_index,
                        "scenes": [
                            {"id": s.id, "title": s.title or "Untitled Scene", "order_index": s.order_index}
                            for s in sorted(ch.scenes, key=lambda s: s.order_index)
                        ],
                    }
                    for ch in sorted(act.chapters, key=lambda c: c.order_index)
                ],
            }
            for act in sorted(project.acts, key=lambda a: a.order_index)
        ],
    }

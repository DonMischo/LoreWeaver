import re
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Project
from services.export import export_markdown, export_latex

router = APIRouter(prefix="/api/projects", tags=["export"])


def _safe_filename(title: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", title)


@router.get("/{project_id}/export")
def export_project(
    project_id: int,
    format: str = Query("md", pattern="^(md|tex)$"),
    db: Session = Depends(get_db),
):
    from models import Act, Chapter
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

    safe_name = _safe_filename(project.title)

    if format == "md":
        content = export_markdown(project)
        return Response(
            content=content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.md"'},
        )
    else:
        content = export_latex(project)
        return Response(
            content=content,
            media_type="application/x-tex",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.tex"'},
        )

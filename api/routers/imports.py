from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Chapter, Scene, CodexEntry
from services.importer import parse_story_markdown, parse_codex_markdown, _md_to_html

router = APIRouter(prefix="/api/projects", tags=["import"])


@router.post("/{project_id}/import/story")
async def import_story(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")

    content = (await file.read()).decode("utf-8", errors="replace")
    parsed_chapters = parse_story_markdown(content)

    if not parsed_chapters:
        raise HTTPException(400, "No chapters found in the file. Use ## for chapters and ### for scenes.")

    # Get current max order_index
    existing = db.query(Chapter).filter(Chapter.project_id == project_id).count()

    created_chapters = 0
    created_scenes = 0

    for i, pc in enumerate(parsed_chapters):
        chapter = Chapter(
            project_id=project_id,
            title=pc.title,
            order_index=existing + i,
        )
        db.add(chapter)
        db.flush()  # get chapter.id

        for j, ps in enumerate(pc.scenes):
            html_content = _md_to_html(ps.content_md)
            import re
            word_count = len(re.sub(r"<[^>]+>", "", html_content).split())
            title = ps.title or None

            scene = Scene(
                chapter_id=chapter.id,
                title=title,
                content=html_content,
                order_index=j,
                word_count=word_count,
            )
            db.add(scene)
            created_scenes += 1

        created_chapters += 1

    db.commit()
    return {
        "message": f"Imported {created_chapters} chapter(s) and {created_scenes} scene(s).",
        "chapters": created_chapters,
        "scenes": created_scenes,
    }


@router.post("/{project_id}/import/codex")
async def import_codex(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")

    content = (await file.read()).decode("utf-8", errors="replace")
    parsed_entries = parse_codex_markdown(content)

    if not parsed_entries:
        raise HTTPException(400, "No entries found. Use ## headings like '## character: Name'.")

    created = 0
    skipped = 0

    for pe in parsed_entries:
        if not pe.name:
            skipped += 1
            continue

        entry = CodexEntry(
            project_id=project_id,
            name=pe.name,
            entry_type=pe.entry_type,
            description=pe.description,
            notes=pe.notes,
            color=pe.color,
        )
        entry.set_aliases(pe.aliases)
        db.add(entry)
        created += 1

    db.commit()
    return {
        "message": f"Imported {created} codex entr{'y' if created == 1 else 'ies'}.",
        "created": created,
        "skipped": skipped,
    }

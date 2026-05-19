import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Act, Chapter, Scene, CodexEntry
from services.importer import parse_story_markdown, parse_codex_markdown, _md_to_html

router = APIRouter(prefix="/api/projects", tags=["import"])


def _word_count(html: str) -> int:
    return len(re.sub(r"<[^>]+>", "", html).split())


@router.post("/{project_id}/import/story")
async def import_story(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    source_project = db.get(Project, project_id)
    if not source_project:
        raise HTTPException(404, "Project not found")

    content = (await file.read()).decode("utf-8", errors="replace")
    _, parsed_acts = parse_story_markdown(content)

    if not parsed_acts:
        raise HTTPException(400, "No content found. Use ## for acts, ### for chapters, #### for scenes.")

    target_project = source_project

    # ── Append after existing acts ────────────────────────────────────────────
    existing_act_count = db.query(Act).filter(Act.project_id == target_project.id).count()

    created_acts = created_chapters = created_scenes = 0

    for act_i, pa in enumerate(parsed_acts):
        act = Act(
            project_id=target_project.id,
            title=pa.title or f"Act {existing_act_count + act_i + 1}",
            order_index=existing_act_count + act_i,
        )
        db.add(act)
        db.flush()
        created_acts += 1

        for ch_i, pc in enumerate(pa.chapters):
            chapter = Chapter(
                act_id=act.id,
                title=pc.title or f"Chapter {ch_i + 1}",
                order_index=ch_i,
            )
            db.add(chapter)
            db.flush()
            created_chapters += 1

            for sc_i, ps in enumerate(pc.scenes):
                html = _md_to_html(ps.content_md)
                scene = Scene(
                    chapter_id=chapter.id,
                    title=ps.title or None,
                    content=html,
                    order_index=sc_i,
                    word_count=_word_count(html),
                )
                db.add(scene)
                created_scenes += 1

    db.commit()

    msg = f"Imported {created_acts} act(s), {created_chapters} chapter(s), {created_scenes} scene(s)."

    return {
        "message": msg,
        "project_id": target_project.id,
        "acts": created_acts,
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
        raise HTTPException(400, "No entries found. Supports YAML-frontmatter (---) or ## heading format.")

    created = skipped = 0
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
            species=pe.species,
        )
        entry.set_aliases(pe.aliases)
        if pe.group:
            entry.set_groups([pe.group])
        db.add(entry)
        created += 1

    db.commit()
    return {
        "message": f"Imported {created} codex entr{'y' if created == 1 else 'ies'}.",
        "created": created,
        "skipped": skipped,
    }

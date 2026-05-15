import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Scene, Act, Chapter
from schemas import TimeConfig, TimeConfigOut, DEFAULT_TIME_UNITS, DEFAULT_DAY_NIGHT

router = APIRouter(tags=["time"])


def _get_or_default(project: Project) -> TimeConfig:
    if project.time_config:
        try:
            data = json.loads(project.time_config)
            return TimeConfig(**data)
        except Exception:
            pass
    return TimeConfig()


@router.get("/api/projects/{project_id}/time-config", response_model=TimeConfigOut)
def get_time_config(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _get_or_default(project)


@router.patch("/api/projects/{project_id}/time-config", response_model=TimeConfigOut)
def update_time_config(project_id: int, body: TimeConfig, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    project.time_config = body.model_dump_json()
    db.commit()
    return body


def _sibling_project_ids(project: Project, db: Session) -> list[int]:
    """Return all project IDs sharing the same codex (owner + all its sharers)."""
    owner_id = project.shared_codex_project_id or project.id
    sharers = db.query(Project.id).filter(Project.shared_codex_project_id == owner_id).all()
    return list({owner_id} | {row.id for row in sharers})


@router.get("/api/projects/{project_id}/timeline")
def get_timeline(project_id: int, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")

    config = _get_or_default(project)
    enabled_units = [u for u in config.units if u.enabled]

    # Determine which projects to scan (self only, or full shared-codex family)
    sibling_ids = _sibling_project_ids(project, db)
    is_shared = len(sibling_ids) > 1
    projects_to_scan: list[Project] = []
    for pid in sibling_ids:
        p = db.get(Project, pid)
        if p:
            projects_to_scan.append(p)

    # Collect all scenes with scene_time set, in story order across all sibling projects
    entries = []
    for proj in projects_to_scan:
        for act in sorted(proj.acts, key=lambda a: a.order_index):
            for chapter in sorted(act.chapters, key=lambda c: c.order_index):
                for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                    if not scene.scene_time:
                        continue
                    try:
                        time_data = json.loads(scene.scene_time)
                    except Exception:
                        continue

                    sort_key = [time_data.get(u.id, 0) for u in enabled_units]

                    parts = []
                    for u in enabled_units:
                        val = time_data.get(u.id)
                        if val is None:
                            continue
                        if u.value_names and 1 <= val <= len(u.value_names):
                            parts.append(u.value_names[val - 1])
                        else:
                            parts.append(f"{u.singular} {val}")
                    time_display = ", ".join(parts) if parts else "—"

                    hour_unit = next((u for u in enabled_units if u.id == "hour"), None)
                    hour_val = time_data.get("hour")
                    day_night_label = None
                    if hour_unit and hour_val is not None:
                        dn = config.day_night
                        night_end = (dn.night_start_hour + dn.night_duration) % dn.hours_per_day
                        if dn.night_start_hour < night_end:
                            is_night = dn.night_start_hour <= hour_val < night_end
                        else:
                            is_night = hour_val >= dn.night_start_hour or hour_val < night_end
                        day_night_label = "Night" if is_night else "Day"

                    entry = {
                        "scene_id":      scene.id,
                        "scene_title":   scene.title or "Untitled Scene",
                        "act_title":     act.title,
                        "chapter_title": chapter.title,
                        "scene_time":    time_data,
                        "time_display":  time_display,
                        "day_night":     day_night_label,
                        "sort_key":      sort_key,
                    }
                    if is_shared:
                        entry["project_id"]    = proj.id
                        entry["project_title"] = proj.title
                    entries.append(entry)

    entries.sort(key=lambda e: e["sort_key"])

    return {
        "config":    config.model_dump(),
        "entries":   entries,
        "is_shared": is_shared,
    }

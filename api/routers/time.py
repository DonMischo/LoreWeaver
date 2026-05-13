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

    # Collect all scenes with scene_time set, in story order
    entries = []
    for act in sorted(project.acts, key=lambda a: a.order_index):
        for chapter in sorted(act.chapters, key=lambda c: c.order_index):
            for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                if not scene.scene_time:
                    continue
                try:
                    time_data = json.loads(scene.scene_time)
                except Exception:
                    continue

                # Build sort key: list of values for each enabled unit (largest→smallest)
                sort_key = [time_data.get(u.id, 0) for u in enabled_units]

                # Build human-readable display
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

                # Day/night label for hour
                hour_unit = next((u for u in enabled_units if u.id == "hour"), None)
                hour_val = time_data.get("hour")
                day_night_label = None
                if hour_unit and hour_val is not None:
                    dn = config.day_night
                    night_end = (dn.night_start_hour + dn.night_duration) % dn.hours_per_day
                    if dn.night_start_hour < night_end:
                        is_night = dn.night_start_hour <= hour_val < night_end
                    else:  # wraps midnight
                        is_night = hour_val >= dn.night_start_hour or hour_val < night_end
                    day_night_label = "Night" if is_night else "Day"

                entries.append({
                    "scene_id":      scene.id,
                    "scene_title":   scene.title or "Untitled Scene",
                    "act_title":     act.title,
                    "chapter_title": chapter.title,
                    "scene_time":    time_data,
                    "time_display":  time_display,
                    "day_night":     day_night_label,
                    "sort_key":      sort_key,
                })

    # Sort by sort_key
    entries.sort(key=lambda e: e["sort_key"])

    return {
        "config": config.model_dump(),
        "entries": entries,
    }

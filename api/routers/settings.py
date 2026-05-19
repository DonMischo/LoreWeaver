import json
import os
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from crypto import encrypt, decrypt
from database import get_db, DEFAULT_AI_PROMPTS
from models import UserSettings, AIPrompt
from schemas import SettingsOut, SettingsUpdate, AIPromptOut, AIPromptCreate, AIPromptUpdate, DataDirUpdate

# ── Shared LoreWeaver config (~/.loreweaver/config.json) ──────────────────────
# Both this API and the Electron main process read/write this file so the
# chosen data directory survives restarts in any run mode.

LW_CONFIG_FILE = Path.home() / ".loreweaver" / "config.json"

def _read_lw_config() -> dict:
    try:
        return json.loads(LW_CONFIG_FILE.read_text("utf-8"))
    except Exception:
        return {}

def _write_lw_config(data: dict) -> None:
    LW_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LW_CONFIG_FILE.write_text(json.dumps(data, indent=2), "utf-8")

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> UserSettings:
    settings = db.query(UserSettings).first()
    if not settings:
        settings = UserSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _settings_out(s: UserSettings) -> SettingsOut:
    try:
        enabled = json.loads(s.enabled_models or "[]")
    except (json.JSONDecodeError, TypeError):
        enabled = []
    return SettingsOut(
        id=s.id,
        has_api_key=bool(s.openrouter_api_key),
        default_model=s.default_model,
        default_chat_model=s.default_chat_model or None,
        theme=s.theme,
        enabled_models=enabled,
    )


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _settings_out(_get_or_create_settings(db))


@router.post("", response_model=SettingsOut)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if body.openrouter_api_key:  # non-empty string → update; empty/None → keep existing key
        s.openrouter_api_key = encrypt(body.openrouter_api_key)
    if body.default_model is not None:
        s.default_model = body.default_model
    if body.default_chat_model is not None:
        s.default_chat_model = body.default_chat_model or None
    if body.theme is not None:
        s.theme = body.theme
    if body.enabled_models is not None:
        s.enabled_models = json.dumps(body.enabled_models)
    db.commit()
    db.refresh(s)
    return _settings_out(s)


@router.get("/data-dir/pick")
def pick_data_dir():
    """Open a native folder-picker dialog on the server machine (dev / local use)."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        chosen = filedialog.askdirectory(title="Choose LoreWeaver Data Folder")
        root.destroy()
        return {"path": chosen or None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not open folder dialog: {exc}")


@router.get("/data-dir")
def get_data_dir():
    cfg = _read_lw_config()
    return {
        "current": os.getcwd(),
        "configured": cfg.get("dataDir"),
    }


@router.post("/data-dir")
def set_data_dir(body: DataDirUpdate):
    cfg = _read_lw_config()

    if body.path and body.migrate:
        src = Path(os.getcwd())
        dst = Path(body.path)
        dst.mkdir(parents=True, exist_ok=True)
        (dst / "uploads").mkdir(exist_ok=True)

        db_src = src / "loreweaver.db"
        if db_src.exists():
            shutil.copy2(db_src, dst / "loreweaver.db")

        uploads_src = src / "uploads"
        if uploads_src.exists():
            for item in uploads_src.iterdir():
                dest_item = dst / "uploads" / item.name
                if item.is_dir():
                    shutil.copytree(item, dest_item, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, dest_item)

    if body.path:
        cfg["dataDir"] = body.path
    else:
        cfg.pop("dataDir", None)
    _write_lw_config(cfg)
    return {"current": os.getcwd(), "configured": body.path or None}


@router.get("/models")
def get_available_models(db: Session = Depends(get_db)):
    """Proxy the OpenRouter model list so the API key stays server-side."""
    s = _get_or_create_settings(db)
    if not s.openrouter_api_key:
        return []
    try:
        api_key = decrypt(s.openrouter_api_key)
        resp = httpx.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        models = [
            {"id": m["id"], "name": m.get("name") or m["id"]}
            for m in data.get("data", [])
            if m.get("id")
        ]
        return sorted(models, key=lambda m: m["name"].lower())
    except Exception:
        return []


# ── AI Prompts ────────────────────────────────────────────────────────────────

def _prompt_out(p: AIPrompt) -> AIPromptOut:
    return AIPromptOut(
        id=p.id,
        name=p.name,
        description=p.description or "",
        system=p.system or "",
        user_template=p.user_template or "",
        is_built_in=bool(p.is_built_in),
        built_in_key=p.built_in_key,
        word_count=p.word_count if p.word_count is not None else 400,
    )


@router.get("/prompts", response_model=list[AIPromptOut])
def list_prompts(db: Session = Depends(get_db)):
    return [_prompt_out(p) for p in db.query(AIPrompt).all()]


@router.post("/prompts", response_model=AIPromptOut)
def create_prompt(body: AIPromptCreate, db: Session = Depends(get_db)):
    p = AIPrompt(
        name=body.name,
        description=body.description,
        system=body.system,
        user_template=body.user_template,
        is_built_in=0,
        built_in_key=None,
        word_count=body.word_count,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _prompt_out(p)


@router.put("/prompts/{prompt_id}", response_model=AIPromptOut)
def update_prompt(prompt_id: int, body: AIPromptUpdate, db: Session = Depends(get_db)):
    p = db.get(AIPrompt, prompt_id)
    if not p:
        raise HTTPException(404, "Prompt not found")
    if body.name is not None:
        p.name = body.name
    if body.description is not None:
        p.description = body.description
    if body.system is not None:
        p.system = body.system
    if body.user_template is not None:
        p.user_template = body.user_template
    if body.word_count is not None:
        p.word_count = body.word_count
    db.commit()
    db.refresh(p)
    return _prompt_out(p)


@router.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    p = db.get(AIPrompt, prompt_id)
    if not p:
        raise HTTPException(404, "Prompt not found")
    if p.is_built_in:
        raise HTTPException(400, "Cannot delete built-in prompts")
    db.delete(p)
    db.commit()


@router.post("/prompts/{prompt_id}/revert", response_model=AIPromptOut)
def revert_prompt(prompt_id: int, db: Session = Depends(get_db)):
    p = db.get(AIPrompt, prompt_id)
    if not p or not p.built_in_key:
        raise HTTPException(404, "Prompt not found or not a built-in")
    default = next((d for d in DEFAULT_AI_PROMPTS if d["built_in_key"] == p.built_in_key), None)
    if not default:
        raise HTTPException(404, "No default found for this prompt")
    p.name = default["name"]
    p.description = default["description"]
    p.system = default["system"]
    p.user_template = default["user_template"]
    db.commit()
    db.refresh(p)
    return _prompt_out(p)

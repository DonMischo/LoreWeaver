from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crypto import encrypt, decrypt
from database import get_db
from models import UserSettings
from schemas import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> UserSettings:
    settings = db.query(UserSettings).first()
    if not settings:
        settings = UserSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return SettingsOut(
        id=s.id,
        has_api_key=bool(s.openrouter_api_key),
        default_model=s.default_model,
        theme=s.theme,
    )


@router.post("", response_model=SettingsOut)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if body.openrouter_api_key is not None:
        s.openrouter_api_key = encrypt(body.openrouter_api_key) if body.openrouter_api_key else None
    if body.default_model is not None:
        s.default_model = body.default_model
    if body.theme is not None:
        s.theme = body.theme
    db.commit()
    db.refresh(s)
    return SettingsOut(
        id=s.id,
        has_api_key=bool(s.openrouter_api_key),
        default_model=s.default_model,
        theme=s.theme,
    )

"""
Grammar-check proxy — forwards requests to a LanguageTool instance.

POST /api/grammar/check
  body: { text: str, language: str }
  → proxied to LanguageTool /v2/check, returns matches[]

GET /api/grammar/languages
  → proxied to LanguageTool /v2/languages, returns list of supported languages
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from database import get_db
from models import UserSettings

router = APIRouter(prefix="/api/grammar", tags=["grammar"])


def _get_lt_url(db: Session) -> str:
    s = db.query(UserSettings).first()
    if not s or not s.grammar_check_enabled:
        raise HTTPException(503, "Grammar check is not enabled in settings")
    return (s.grammar_check_url or "http://localhost:8081").rstrip("/")


class CheckRequest(BaseModel):
    text: str
    language: str = "auto"   # "auto" | "en-US" | "de-DE" | …


@router.post("/check")
async def check_grammar(body: CheckRequest, db: Session = Depends(get_db)):
    lt_url = _get_lt_url(db)
    payload = {
        "text": body.text,
        "language": body.language,
        "enabledOnly": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(f"{lt_url}/v2/check", data=payload)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        raise HTTPException(503, "LanguageTool is not reachable. Is the container running?")
    except httpx.ReadTimeout:
        raise HTTPException(503, "LanguageTool took too long to respond. It may still be loading ngram models — try again in a moment.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"LanguageTool error: {exc.response.status_code}")


@router.get("/languages")
async def list_languages(db: Session = Depends(get_db)):
    lt_url = _get_lt_url(db)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{lt_url}/v2/languages")
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        raise HTTPException(503, "LanguageTool is not reachable")

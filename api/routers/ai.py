import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx

from crypto import decrypt
from database import get_db
from models import Scene, Chapter, Act, Project, UserSettings, CodexEntry
from schemas import AIGenerateRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

MODE_SYSTEM_PROMPTS = {
    "continue": "You are a creative writing assistant. Continue the story naturally, matching the existing tone and style.",
    "rewrite": "You are a creative writing assistant. Rewrite the provided text to improve it while preserving the core meaning and plot.",
    "brainstorm": "You are a creative writing assistant. Generate creative ideas and suggestions based on the provided context.",
    "ask": "You are a creative writing assistant. Answer the question thoughtfully based on the story context provided.",
    "custom": "You are a creative writing assistant helping with a creative writing project.",
}


def _build_context(scene: Scene, db: Session) -> str:
    chapter = db.get(Chapter, scene.chapter_id)
    act = db.get(Act, chapter.act_id)
    project = db.get(Project, act.project_id)

    codex_entries = db.query(CodexEntry).filter(CodexEntry.project_id == project.id).all()
    codex_text = ""
    if codex_entries:
        lines = ["## World Information (Codex)"]
        for entry in codex_entries:
            aliases = entry.get_aliases()
            alias_str = f" (also: {', '.join(aliases)})" if aliases else ""
            lines.append(f"**{entry.name}** [{entry.entry_type}]{alias_str}: {entry.description or ''}")
        codex_text = "\n".join(lines)

    # Gather all scenes across acts→chapters, in order, stopping at current scene
    all_acts = db.query(Act).filter(Act.project_id == project.id).order_by(Act.order_index).all()
    all_chapters = [
        ch
        for a in all_acts
        for ch in sorted(a.chapters, key=lambda c: c.order_index)
    ]

    prev_scenes_text = ""
    found = False
    prev_scenes = []
    for ch in all_chapters:
        for sc in ch.scenes:
            if sc.id == scene.id:
                found = True
                break
            prev_scenes.append(sc)
        if found:
            break

    recent_prev = prev_scenes[-2:]
    if recent_prev:
        lines = ["## Previous Scenes"]
        for sc in recent_prev:
            lines.append(f"### {sc.title or 'Scene'}")
            import re
            lines.append(re.sub(r"<[^>]+>", "", sc.content or ""))
        prev_scenes_text = "\n".join(lines)

    import re
    current_content = re.sub(r"<[^>]+>", "", scene.content or "")

    parts = [f"# Project: {project.title}"]
    if codex_text:
        parts.append(codex_text)
    if prev_scenes_text:
        parts.append(prev_scenes_text)
    parts.append(f"## Current Scene: {scene.title or 'Scene'}")
    parts.append(current_content)

    return "\n\n".join(parts)


async def _stream_openrouter(api_key: str, model: str, messages: list[dict]):
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "LoreWeaver",
            },
            json={"model": model, "messages": messages, "stream": True},
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                yield f"data: {json.dumps({'error': body.decode()})}\n\n"
                return
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    yield f"{line}\n\n"


@router.post("/generate")
async def generate(body: AIGenerateRequest, db: Session = Depends(get_db)):
    scene = db.get(Scene, body.scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    api_key = decrypt(settings.openrouter_api_key)
    model = body.model or settings.default_model
    context = _build_context(scene, db)
    system_prompt = MODE_SYSTEM_PROMPTS.get(body.mode, MODE_SYSTEM_PROMPTS["custom"])

    user_message = context
    if body.mode == "custom" and body.custom_prompt:
        user_message = f"{context}\n\n## Instruction\n{body.custom_prompt}"
    elif body.mode == "ask" and body.custom_prompt:
        user_message = f"{context}\n\n## Question\n{body.custom_prompt}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    return StreamingResponse(
        _stream_openrouter(api_key, model, messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

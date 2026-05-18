import json
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx

from crypto import decrypt
from database import get_db
from models import Scene, Chapter, Act, Project, UserSettings, CodexEntry, AIPrompt
from schemas import AIGenerateRequest, KiGenerateRequest, ChatRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# BCP 47 base tag → full language name
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English", "de": "German", "fr": "French", "es": "Spanish",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ru": "Russian",
    "ja": "Japanese", "zh": "Chinese", "ko": "Korean", "pl": "Polish",
    "sv": "Swedish", "da": "Danish", "fi": "Finnish", "nb": "Norwegian",
    "no": "Norwegian", "cs": "Czech", "sk": "Slovak", "hu": "Hungarian",
    "ro": "Romanian", "tr": "Turkish", "ar": "Arabic", "he": "Hebrew",
    "uk": "Ukrainian", "bg": "Bulgarian", "hr": "Croatian", "sr": "Serbian",
    "el": "Greek", "ca": "Catalan", "lt": "Lithuanian", "lv": "Latvian",
    "et": "Estonian", "sl": "Slovenian", "mt": "Maltese", "ga": "Irish",
}


def _project_language(scene: Scene, db: Session) -> str:
    """Return the full language name for the project this scene belongs to."""
    chapter = db.get(Chapter, scene.chapter_id)
    act = db.get(Act, chapter.act_id) if chapter else None
    project = db.get(Project, act.project_id) if act else None
    lang_code = "en"
    if project and project.book_meta:
        try:
            meta = json.loads(project.book_meta)
            lang_code = meta.get("language") or "en"
        except (json.JSONDecodeError, TypeError):
            pass
    base = lang_code.split("-")[0].lower()
    return LANGUAGE_NAMES.get(base, lang_code)

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

    all_acts = db.query(Act).filter(Act.project_id == project.id).order_by(Act.order_index).all()
    all_chapters = [
        ch
        for a in all_acts
        for ch in sorted(a.chapters, key=lambda c: c.order_index)
    ]

    prev_scenes = []
    found = False
    for ch in all_chapters:
        for sc in ch.scenes:
            if sc.id == scene.id:
                found = True
                break
            prev_scenes.append(sc)
        if found:
            break

    prev_scenes_text = ""
    recent_prev = prev_scenes[-2:]
    if recent_prev:
        lines = ["## Previous Scenes"]
        for sc in recent_prev:
            lines.append(f"### {sc.title or 'Scene'}")
            lines.append(re.sub(r"<[^>]+>", "", sc.content or ""))
        prev_scenes_text = "\n".join(lines)

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


def _build_ki_context(scene: Scene, body: KiGenerateRequest, db: Session) -> dict[str, str]:
    """Build placeholder values for Ki prompt templates."""
    scene_content = re.sub(r"<[^>]+>", "", scene.content or "")
    scene_title = scene.title or "Untitled Scene"

    codex_lines: list[str] = []
    if body.codex_ids:
        entries = db.query(CodexEntry).filter(CodexEntry.id.in_(body.codex_ids)).all()
        for e in entries:
            aliases = e.get_aliases()
            alias_str = f" (also: {', '.join(aliases)})" if aliases else ""
            codex_lines.append(f"**{e.name}** [{e.entry_type}]{alias_str}: {e.description or ''}")
    codex_text = "\n".join(codex_lines) if codex_lines else "No codex entries selected."

    extra_lines: list[str] = []
    if body.extra_scene_ids:
        extra = db.query(Scene).filter(Scene.id.in_(body.extra_scene_ids)).all()
        for sc in extra:
            extra_lines.append(f"### {sc.title or 'Untitled Scene'}")
            extra_lines.append(re.sub(r"<[^>]+>", "", sc.content or ""))
    extra_text = "\n".join(extra_lines) if extra_lines else "No additional scenes selected."

    return {
        "SCENE_CONTENT": scene_content,
        "SCENE_TITLE": scene_title,
        "CODEX_ENTRIES": codex_text,
        "EXTRA_SCENES": extra_text,
        "USER_PROMPT": body.prompt or "",
        "USER_NOTES": body.prompt or "",
        "ENTRY_TYPE": body.entry_type or "character",
        "LANGUAGE": _project_language(scene, db),
    }


def _fill_placeholders(template: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        template = template.replace(f"{{{{{key}}}}}", value)
    return template


@router.post("/ki")
async def ki_generate(body: KiGenerateRequest, db: Session = Depends(get_db)):
    """Non-streaming AI generation for the /ki editor command."""
    scene = db.get(Scene, body.scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    api_key = decrypt(settings.openrouter_api_key)
    model = body.model or settings.default_model

    if body.prompt_id:
        # Use a stored prompt template
        prompt_row = db.get(AIPrompt, body.prompt_id)
        if not prompt_row:
            raise HTTPException(404, "Prompt not found")
        ctx = _build_ki_context(scene, body, db)
        effective_wc = body.word_count if body.word_count is not None else (prompt_row.word_count or 400)
        ctx["WORD_COUNT"] = str(effective_wc)
        system = _fill_placeholders(prompt_row.system or "You are a creative writing assistant.", ctx)
        user_msg = _fill_placeholders(prompt_row.user_template or "", ctx)
    else:
        # Legacy inline behaviour
        parts: list[str] = []
        if body.codex_ids:
            entries = db.query(CodexEntry).filter(CodexEntry.id.in_(body.codex_ids)).all()
            if entries:
                lines = ["## World Information (Codex)"]
                for e in entries:
                    aliases = e.get_aliases()
                    alias_str = f" (also: {', '.join(aliases)})" if aliases else ""
                    lines.append(f"**{e.name}** [{e.entry_type}]{alias_str}: {e.description or ''}")
                parts.append("\n".join(lines))
        if body.extra_scene_ids:
            extra = db.query(Scene).filter(Scene.id.in_(body.extra_scene_ids)).all()
            if extra:
                lines = ["## Reference Scenes"]
                for sc in extra:
                    lines.append(f"### {sc.title or 'Untitled Scene'}")
                    lines.append(re.sub(r"<[^>]+>", "", sc.content or ""))
                parts.append("\n".join(lines))
        current_text = re.sub(r"<[^>]+>", "", scene.content or "")
        parts.append(f"## Current Scene: {scene.title or 'Untitled Scene'}\n{current_text}")
        context = "\n\n".join(parts)
        system = "You are a creative writing assistant. Write naturally, matching the existing tone and style."
        user_msg = f"{context}\n\n## Instruction\n{body.prompt}" if body.prompt else context

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "LoreWeaver",
            },
            json={"model": model, "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ], "stream": False},
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)

    return {"text": resp.json()["choices"][0]["message"]["content"]}


@router.post("/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """Multi-turn chat about the current scene."""
    scene = db.get(Scene, body.scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    api_key = decrypt(settings.openrouter_api_key)
    model = body.model or settings.default_model
    language = _project_language(scene, db)
    scene_content = re.sub(r"<[^>]+>", "", scene.content or "")

    system = (
        "You are a creative writing assistant helping an author develop their story. "
        "The author is currently working on the following scene:\n\n"
        f"--- Scene: {scene.title or 'Untitled'} ---\n"
        f"{scene_content}\n"
        "--- End of Scene ---\n\n"
        "Discuss ideas, answer questions, suggest improvements, and explore story possibilities. "
        f"Be conversational, specific, and helpful. Respond in {language}."
    )

    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    return StreamingResponse(
        _stream_openrouter(api_key, model, messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

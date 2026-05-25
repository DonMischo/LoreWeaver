import json
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx

from crypto import decrypt
from database import get_db
from models import Scene, Chapter, Act, Project, UserSettings, CodexEntry, AIPrompt
from schemas import AIGenerateRequest, KiGenerateRequest, ChatRequest, TranslateRequest, StructureRequest

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
                "X-Title": "Foliantica",
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


# JSON schema hints used when create_entry=True
_ENTRY_JSON_SCHEMAS: dict[str, str] = {
    "character": (
        '{\n'
        '  "name": "full name",\n'
        '  "entry_type": "character",\n'
        '  "aliases": ["alias or nickname"],\n'
        '  "species": "species or race",\n'
        '  "tags": ["tag1", "tag2"],\n'
        '  "description": "Alter: ...\\n\\nAppearance:\\nHaut: ...\\nAugen: ...\\nHaar: ...\\nKörperbau: ...\\n\\nPersonality:\\ntraits:\\n- ...\\n- ...\\n\\nAbilities:\\n- ...\\n\\nBackground:\\n- ..."\n'
        '}'
    ),
    "location": (
        '{\n'
        '  "name": "location name",\n'
        '  "entry_type": "location",\n'
        '  "aliases": [],\n'
        '  "subtype": "type of location (city, forest, ruin…)",\n'
        '  "tags": ["tag1"],\n'
        '  "description": "Geography:\\n...\\n\\nAtmosphere:\\n...\\n\\nNotable features:\\n- ...\\n\\nInhabitants:\\n...\\n\\nHistory:\\n..."\n'
        '}'
    ),
    "item": (
        '{\n'
        '  "name": "item name",\n'
        '  "entry_type": "item",\n'
        '  "aliases": [],\n'
        '  "subtype": "item type (weapon, artifact, tool…)",\n'
        '  "tags": [],\n'
        '  "description": "Appearance:\\n...\\n\\nFunction:\\n...\\n\\nOwner:\\n...\\n\\nHistory:\\n...\\n\\nSignificance:\\n..."\n'
        '}'
    ),
    "lore": (
        '{\n'
        '  "name": "concept or system name",\n'
        '  "entry_type": "lore",\n'
        '  "aliases": [],\n'
        '  "subtype": "magic system / religion / event / faction…",\n'
        '  "tags": [],\n'
        '  "description": "Description:\\n...\\n\\nScope:\\n...\\n\\nOrigin:\\n...\\n\\nKnown facts:\\n- ...\\n\\nOpen questions:\\n..."\n'
        '}'
    ),
}


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
        language = ctx["LANGUAGE"]
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
        language = _project_language(scene, db)

    # create_entry mode: override system to demand structured JSON output
    if body.create_entry:
        entry_type = (body.entry_type or "character").lower()
        schema = _ENTRY_JSON_SCHEMAS.get(entry_type, _ENTRY_JSON_SCHEMAS["character"])
        system += (
            f"\n\nCRITICAL OUTPUT FORMAT: Your ENTIRE response must be a single valid JSON object. "
            f"No markdown code fences, no preamble, no commentary outside the JSON. "
            f"Use exactly this structure for a {entry_type}:\n{schema}\n"
            f"Write every descriptive text value in {language}. "
            f"The description field uses labelled sections separated by blank lines, matching the schema above. "
            f"Extract only what is present in the source — do not invent facts."
        )

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Foliantica",
            },
            json={"model": model, "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ], "stream": False},
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)

    return {"text": resp.json()["choices"][0]["message"]["content"]}


@router.post("/translate")
async def translate_text(body: TranslateRequest, db: Session = Depends(get_db)):
    """Translate a block of text using the configured AI model."""
    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    api_key = decrypt(settings.openrouter_api_key)
    model = body.model or settings.default_codex_model or settings.default_model
    if not model:
        raise HTTPException(400, "No AI model configured")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Foliantica",
            },
            json={
                "model": model,
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            f"You are a professional literary translator. "
                            f"Translate the provided text into {body.target_language}. "
                            f"Preserve the original formatting exactly — keep all section headers, "
                            f"bullet points, newlines, and structural elements intact. "
                            f"Preserve the meaning, tone, and style. "
                            f"Return only the translated text, no preamble or explanation."
                        ),
                    },
                    {"role": "user", "content": body.text},
                ],
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"OpenRouter error: {resp.text}")

    translated = resp.json()["choices"][0]["message"]["content"].strip()
    return {"text": translated}


# Section templates per entry type (English keys; AI translates headers to the text's language)
_STRUCTURE_SECTIONS: dict[str, list[str]] = {
    "character": ["Age", "Appearance", "Personality", "Abilities", "Social", "Background"],
    "location":  ["Geography", "Atmosphere", "Notable features", "Inhabitants", "History"],
    "item":      ["Appearance", "Function", "Owner", "History", "Significance"],
    "lore":      ["Description", "Scope", "Origin", "Known facts", "Open questions"],
    "custom":    ["Description", "Details", "History", "Notes"],
}


@router.post("/structure")
async def structure_text(body: StructureRequest, db: Session = Depends(get_db)):
    """Reorganize free-form description text into typed sections for a codex entry."""
    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    api_key = decrypt(settings.openrouter_api_key)
    model = body.model or settings.default_codex_model or settings.default_model
    if not model:
        raise HTTPException(400, "No AI model configured")

    entry_type = (body.entry_type or "custom").lower()
    sections = _STRUCTURE_SECTIONS.get(entry_type, _STRUCTURE_SECTIONS["custom"])
    sections_list = "\n".join(f"- {s}" for s in sections)

    # ── Language directive — top of prompt so the model cannot miss it ──────────
    if body.target_language:
        lang_directive = (
            f"OUTPUT LANGUAGE: {body.target_language}\n"
            f"You MUST write every single word of your response in {body.target_language}. "
            f"This includes section headers, sub-labels, all body text, and the tag/group "
            f"suggestions. Translate the source material into {body.target_language} as you "
            f"reorganise it.\n\n"
        )
    else:
        lang_directive = (
            "OUTPUT LANGUAGE: same as the input text "
            "(auto-detect the source language and match it throughout, including suggestions).\n\n"
        )

    # ── Entry-type-specific notes ─────────────────────────────────────────────
    type_notes = ""
    if entry_type == "character":
        type_notes = (
            "\nAppearance sub-labels (each followed by colon, translated to output language): "
            "Skin, Eyes, Hair, Build"
            "\nPersonality: list each trait as a bullet point starting with '- '"
        )

    # ── Minimal format example (colon + empty section) ────────────────────────
    ex_a = sections[0]
    ex_b = sections[1] if len(sections) > 1 else sections[0]
    format_example = f"{ex_a}:\ncontent goes here\n\n{ex_b}:\n"

    # ── Subtype guidance (not relevant for characters) ────────────────────────
    subtype_rule = (
        "- suggested_subtype: the single most fitting type classification found in the text "
        f"(e.g. for {entry_type}: a descriptive noun like 'garden', 'ruins', 'artifact'…); "
        "null if nothing clear\n"
        if entry_type != "character"
        else "- suggested_subtype: null (not applicable for characters)\n"
    )

    system_content = (
        f"{lang_directive}"
        f"Reorganise the following {entry_type} codex entry into these fixed sections "
        f"(create ALL of them, in this order):\n"
        f"{sections_list}"
        f"{type_notes}\n\n"
        f"=== RESPONSE FORMAT ===\n"
        f"Use EXACTLY these two delimiter lines and nothing else around them:\n\n"
        f"<<<TEXT>>>\n"
        f"[the reorganised description here]\n"
        f"<<<SUGGESTIONS>>>\n"
        f'[a single JSON object on one line: {{"suggested_tags":["tag"],"suggested_groups":["Group"],"suggested_subtype":"type or null"}}]\n\n'
        f"--- Format rules for <<<TEXT>>> ---\n"
        f"- Every section header ends with a colon (:) on its own line\n"
        f"- Content follows on the next line(s); sections separated by one blank line\n"
        f"- Empty sections: header with colon only, no placeholder text\n"
        f"- Do NOT invent content — only reorganise what is in the source\n"
        f"- Preserve all original information\n\n"
        f"Example of correct <<<TEXT>>> format:\n"
        f"{format_example}\n"
        f"--- Rules for <<<SUGGESTIONS>>> JSON ---\n"
        f"- suggested_tags: up to 8 lowercase keywords/descriptors extracted from the text\n"
        f"- suggested_groups: organisations, factions, institutions the entry belongs to "
        f"(proper names, max 5)\n"
        f"{subtype_rule}"
        f"- Return valid JSON on a single line; do not wrap in code fences"
    )

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Foliantica",
            },
            json={
                "model": model,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system_content},
                    {"role": "user",   "content": body.text},
                ],
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"OpenRouter error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # ── Split on delimiter ────────────────────────────────────────────────────
    structured_text = raw
    sugg_tags: list[str] = []
    sugg_groups: list[str] = []
    sugg_subtype: str | None = None

    if "<<<SUGGESTIONS>>>" in raw:
        text_part, sugg_part = raw.split("<<<SUGGESTIONS>>>", 1)
        structured_text = text_part.replace("<<<TEXT>>>", "").strip()
        sugg_raw = re.sub(r"```(?:json)?\s*|\s*```", "", sugg_part).strip()
        try:
            sugg = json.loads(sugg_raw)
            sugg_tags   = [str(t).lower().strip() for t in sugg.get("suggested_tags", []) if t]
            sugg_groups = [str(g).strip() for g in sugg.get("suggested_groups", []) if g]
            raw_st = sugg.get("suggested_subtype")
            sugg_subtype = str(raw_st).strip() if raw_st and str(raw_st).lower() != "null" else None
        except (json.JSONDecodeError, ValueError):
            pass
    elif "<<<TEXT>>>" in raw:
        structured_text = raw.replace("<<<TEXT>>>", "").strip()

    return {
        "text": structured_text,
        "suggested_tags": sugg_tags,
        "suggested_groups": sugg_groups,
        "suggested_subtype": sugg_subtype,
    }


@router.post("/scenes/{scene_id}/synopsis")
async def generate_synopsis(scene_id: int, db: Session = Depends(get_db)):
    """Generate a short synopsis for a scene using AI. Returns {synopsis: str}."""
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    settings = db.query(UserSettings).first()
    if not settings or not settings.openrouter_api_key:
        raise HTTPException(400, "OpenRouter API key not configured")

    content = re.sub(r"<[^>]+>", "", scene.content or "").strip()
    if not content:
        raise HTTPException(400, "Scene has no content to summarize")

    api_key = decrypt(settings.openrouter_api_key)
    model = settings.default_synopsis_model or settings.default_model
    lang = _project_language(scene, db)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Foliantica",
            },
            json={
                "model": model,
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            f"You are a writing assistant. Write a concise 1–3 sentence synopsis of the scene. "
                            f"Focus on what happens — the key action, conflict, or revelation. "
                            f"Write in {lang}. Return only the synopsis, no preamble."
                        ),
                    },
                    {"role": "user", "content": content[:4000]},
                ],
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"OpenRouter error: {resp.text}")

    synopsis = resp.json()["choices"][0]["message"]["content"].strip()
    return {"synopsis": synopsis}


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

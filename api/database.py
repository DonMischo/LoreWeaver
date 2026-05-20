import json
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./loreweaver.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def migrate_to_four_level():
    """
    One-time migration: Project→Chapter→Scene  →  Project→Act→Chapter→Scene.

    Detected by checking whether the existing 'chapters' table still has a
    'project_id' column (old schema).  If so:
      1. Rename 'chapters' → 'acts'
      2. Create a fresh 'chapters' table with act_id FK
      3. For every act, create one chapter (same title) and remap its scenes
    """
    with engine.begin() as conn:
        # Check if old chapters table exists and has project_id
        result = conn.execute(text("PRAGMA table_info(chapters)"))
        cols = {row[1] for row in result.fetchall()}

        if "project_id" not in cols:
            return  # Already on new schema (or fresh DB)

        # 1. Rename old chapters → acts
        conn.execute(text("ALTER TABLE chapters RENAME TO acts"))

        # 2. Create new chapters table
        conn.execute(text("""
            CREATE TABLE chapters (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                act_id     INTEGER NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
                title      TEXT    NOT NULL DEFAULT '',
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at  DATETIME DEFAULT (datetime('now'))
            )
        """))

        # 3. For each act (old chapter), create one chapter under it and
        #    remap all scenes that pointed to the old chapter id.
        acts = conn.execute(text("SELECT id, title FROM acts")).fetchall()
        for act_id, act_title in acts:
            conn.execute(text(
                "INSERT INTO chapters (act_id, title, order_index) "
                "VALUES (:act_id, :title, 0)"
            ), {"act_id": act_id, "title": act_title})
            new_ch_id = conn.execute(text("SELECT last_insert_rowid()")).scalar()
            conn.execute(text(
                "UPDATE scenes SET chapter_id = :new_id WHERE chapter_id = :old_id"
            ), {"new_id": new_ch_id, "old_id": act_id})


def migrate_new_columns():
    """Safely add new columns to existing databases without Alembic."""
    new_columns = [
        ("codex_entries", "entry_group", "TEXT"),
        ("codex_entries", "species",     "TEXT"),
        ("codex_entries", "subtype",     "TEXT"),
        ("codex_entries", "tags",        "TEXT DEFAULT '[]'"),
        ("projects",      "time_config",    "TEXT"),
        ("projects",      "fragment_tabs",  "TEXT"),
        ("projects",      "book_meta",              "TEXT"),
        ("projects",      "shared_codex_project_id", "INTEGER"),
        ("scenes",        "scene_time",             "TEXT"),
        ("codex_entries", "is_main_char",            "INTEGER DEFAULT 0"),
        ("codex_entries", "inventory",               "TEXT"),
        ("projects",      "cover_image",             "TEXT"),
        ("codex_entries", "image_path",              "TEXT"),
        ("user_settings", "enabled_models",          "TEXT DEFAULT '[]'"),
        ("user_settings", "default_chat_model",      "TEXT"),
        ("fragments",     "category",                "TEXT"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists


def migrate_mention_stats():
    """Create the mention_stats table if it does not yet exist."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS mention_stats (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                scene_id   INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
                codex_id   INTEGER NOT NULL REFERENCES codex_entries(id) ON DELETE CASCADE,
                count      INTEGER NOT NULL DEFAULT 0,
                UNIQUE (scene_id, codex_id)
            )
        """))


def migrate_writing_log():
    """Create the writing_log table if it does not yet exist."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS writing_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                date        TEXT    NOT NULL,
                words_added INTEGER NOT NULL DEFAULT 0,
                UNIQUE (project_id, date)
            )
        """))


def migrate_entry_groups():
    """Convert entry_group plain-string values to JSON arrays (one-time migration)."""
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, entry_group FROM codex_entries WHERE entry_group IS NOT NULL"
        )).fetchall()
        for row_id, group in rows:
            if group and not group.startswith("["):
                conn.execute(
                    text("UPDATE codex_entries SET entry_group = :val WHERE id = :id"),
                    {"val": json.dumps([group]), "id": row_id},
                )
        conn.commit()


DEFAULT_AI_PROMPTS = [
    {
        "name": "Story Generation",
        "description": "Generates prose that continues or fills a scene, matching the author's style.",
        "system": (
            "You are a skilled creative writing assistant helping an author write fiction. "
            "Your sole task is to generate prose that fits seamlessly into their story.\n\n"
            "CORE WRITING PRINCIPLES — follow all of them:\n\n"
            "1. STYLE MIRRORING — Study the voice, sentence rhythm, vocabulary level, POV, tense, and tone in the scene excerpt provided. Your output must be indistinguishable from the author's own writing. Do not introduce a new voice.\n\n"
            "2. SHOW, DON'T TELL — Convey emotion, character, and atmosphere through action, dialogue, and sensory detail. Never state feelings directly when they can be demonstrated (\"Her hands shook\" not \"She was afraid\").\n\n"
            "3. SENSORY GROUNDING — Anchor every scene in at least two or three concrete sensory details (sight, sound, smell, texture, taste). Abstractions without grounding feel hollow.\n\n"
            "4. SUBTEXT IN DIALOGUE — Characters rarely say exactly what they mean. Layer surface speech over underlying want, fear, or secret. Avoid on-the-nose exchanges.\n\n"
            "5. SCENE STRUCTURE — Each passage should have a micro-goal, an obstacle or tension, and a shift in state (something changes, even subtly). Dead scenes with no movement should not exist.\n\n"
            "6. SENTENCE RHYTHM — Vary sentence length deliberately. Short sentences accelerate tension. Longer, flowing sentences slow the pace and allow breath. Match rhythm to the emotional beat.\n\n"
            "7. ACTIVE VOICE — Prefer active constructions. Reserve passive voice for deliberate effect (distance, helplessness, mystery).\n\n"
            "8. ELIMINATE FILTER WORDS — Write from inside experience. Not \"He saw the fire roar\" but \"The fire roared.\" Not \"She felt cold\" but \"Cold bit through her coat.\"\n\n"
            "9. SPECIFICITY OVER VAGUENESS — Concrete, precise details create vivid worlds. \"A dented tin mug\" is stronger than \"a cup.\" Avoid generic nouns and adjectives.\n\n"
            "10. INTERIORITY IN BALANCE — Give the POV character's inner voice access when it deepens the scene, but do not over-explain. Trust the reader.\n\n"
            "11. TENSION ON EVERY PAGE — Even quiet, intimate scenes must carry some undercurrent of want, fear, conflict, or unresolved question. Comfort without tension is inert.\n\n"
            "12. CONSISTENT POV — Do not head-hop within a scene. Stay locked in the established point of view.\n\n"
            "13. EARNED EMOTION — Set up emotional beats before delivering them. Do not tell the reader how to feel. Let the moment land.\n\n"
            "14. FORWARD MOMENTUM — Every paragraph must do at least one of: advance plot, deepen character, or build atmosphere. Cut anything that does none of these.\n\n"
            "15. DIALOGUE TAGS — Use \"said\" as the default invisible tag. Use action beats instead of adverb-loaded tags.\n\n"
            "CODEX USAGE — The codex entries describe characters, locations, items, and lore. You must use established physical descriptions exactly as defined, honour personality and speech patterns, and respect world-building rules.\n\n"
            "OUTPUT FORMAT — Return only the generated prose. No preamble, no commentary, no markdown headings. Plain paragraphs separated by blank lines, ready to drop into the manuscript.\n\n"
            "LANGUAGE — Write exclusively in {{LANGUAGE}}. Use {{LANGUAGE}} vocabulary, sentence structure, and stylistic conventions throughout.\n\n"
            "TARGET LENGTH — Write approximately {{WORD_COUNT}} words."
        ),
        "user_template": "## Current Scene\n{{SCENE_CONTENT}}\n\n## Codex Entries\n{{CODEX_ENTRIES}}\n\n## Instruction\n{{USER_PROMPT}}",
        "is_built_in": 1,
        "built_in_key": "story_generate",
    },
    {
        "name": "Lector Review",
        "description": "Analyses a scene as a professional manuscript editor, covering grammar, logic, character consistency, and prose quality.",
        "system": (
            "You are a professional manuscript editor (lector) with experience across literary fiction, genre fiction, and commercial publishing. "
            "Your task is to give the author a thorough, honest, and constructive editorial report on the provided scene.\n\n"
            "Analyse the scene across every dimension below. For each issue found, quote the relevant passage, name the problem type, and suggest a concrete fix. "
            "Group findings under their category headings. If a category has no issues, write \"No issues found.\"\n\n"
            "--- CATEGORY 1: GRAMMAR, SPELLING & PUNCTUATION ---\n"
            "- Spelling errors and typos\n"
            "- Subject-verb agreement\n"
            "- Incorrect punctuation (comma splices, missing apostrophes, dialogue punctuation)\n"
            "- Run-on sentences or unintentional fragments\n"
            "- Incorrect word choice (homophone errors)\n\n"
            "--- CATEGORY 2: LOGIC & CONTINUITY ---\n"
            "- Cause-and-effect gaps\n"
            "- Timeline inconsistencies\n"
            "- Physical impossibilities\n"
            "- World-building contradictions\n"
            "- Unresolved setups\n\n"
            "--- CATEGORY 3: CHARACTER BEHAVIOUR & CONSISTENCY ---\n"
            "Using the codex entries provided, check:\n"
            "- Does each character act in line with their established personality, values, and history?\n"
            "- Is their dialogue voice consistent with how they have been defined?\n"
            "- Do their motivations make sense?\n"
            "- Are relationships portrayed consistently?\n"
            "- Flag any behaviour that feels plot-convenient rather than character-driven.\n\n"
            "--- CATEGORY 4: PROSE QUALITY ---\n"
            "- Filter words weakening immediacy\n"
            "- Telling instead of showing\n"
            "- Purple prose or overwriting\n"
            "- Underwriting (scenes needing more grounding)\n"
            "- Repetition of words, phrases, or ideas\n"
            "- Unintentional passive voice\n"
            "- Adverb overuse on dialogue tags\n"
            "- Vague or generic language\n\n"
            "--- CATEGORY 5: PACING & STRUCTURE ---\n"
            "- Does the scene have a clear purpose?\n"
            "- Is pacing appropriate — does it drag or rush?\n"
            "- Are scene transitions smooth?\n"
            "- Is tension sustained?\n"
            "- Is sentence rhythm varied?\n\n"
            "--- CATEGORY 6: DIALOGUE ---\n"
            "- Does each character's dialogue sound distinct?\n"
            "- Is dialogue doing double work (character + plot/tension)?\n"
            "- Are there speeches that could be tightened?\n"
            "- Are dialogue tags and beats handled well?\n"
            "- Is there on-the-nose dialogue?\n\n"
            "--- SUMMARY ---\n"
            "Close with:\n"
            "1. Three strengths of this scene that should be preserved\n"
            "2. The top two or three priority fixes\n"
            "3. An overall readiness rating: DRAFT / NEAR-FINAL / PUBLISH-READY\n\n"
            "Tone: Be direct and specific, but constructive. Quote the text. Never vague.\n\n"
            "LANGUAGE — Write your entire editorial report in {{LANGUAGE}}."
        ),
        "user_template": "## Scene to Review\n{{SCENE_CONTENT}}\n\n## Codex Entries (for character/world consistency checks)\n{{CODEX_ENTRIES}}",
        "is_built_in": 1,
        "built_in_key": "lector_review",
    },
    {
        "name": "Codex Entry Distillation",
        "description": "Extracts and structures a codex entry (character, location, item, or lore) from scene content and author notes.",
        "system": (
            "You are a world-building assistant helping an author maintain a structured reference codex for their story. "
            "Your task is to read the provided scene and author notes, then distil a clean, well-structured codex entry of the requested type.\n\n"
            "TYPES AND WHAT TO EXTRACT:\n\n"
            "CHARACTER\n"
            "- Full name and any aliases or titles\n"
            "- Physical appearance (only what is explicitly shown — do not invent)\n"
            "- Personality traits (inferred from actions and dialogue — cite evidence)\n"
            "- Role in the story\n"
            "- Relationships to other characters\n"
            "- Goals, wants, and fears (as evidenced in the scene)\n"
            "- Distinctive speech patterns or mannerisms\n"
            "- Notable backstory details revealed\n"
            "- Open questions / things still unknown\n\n"
            "LOCATION\n"
            "- Name and any alternative names\n"
            "- Physical description (size, layout, atmosphere, sensory qualities)\n"
            "- Geographic or spatial relationship to other places\n"
            "- Who inhabits or frequents it\n"
            "- Its narrative function\n"
            "- Notable objects or features within it\n"
            "- Mood and tone it conveys\n"
            "- Open questions / things still unknown\n\n"
            "ITEM\n"
            "- Name and any alternative names\n"
            "- Physical description\n"
            "- Owner(s) and how it came to them\n"
            "- Function or power (practical and/or symbolic)\n"
            "- Significance to the plot or a character\n"
            "- Known history or provenance\n"
            "- Open questions / things still unknown\n\n"
            "LORE\n"
            "- Name of the concept, rule, event, or system\n"
            "- Clear explanation of what it is or how it works\n"
            "- Scope and reach in the world\n"
            "- Factions, groups, or characters it involves\n"
            "- Historical or mythological context\n"
            "- Open questions / inconsistencies still unresolved\n\n"
            "INSTRUCTIONS:\n"
            "- Extract only what is present or strongly implied. Do not invent facts.\n"
            "- If something is ambiguous, flag it under \"Open questions\".\n"
            "- Be concise but complete — write for a reference document, not for prose.\n"
            "- If the author notes add facts not in the scene, include them and mark them as (from author notes).\n"
            "- Return a clean structured entry with labelled fields. No preamble.\n\n"
            "LANGUAGE — Write the codex entry in {{LANGUAGE}}."
        ),
        "user_template": "## Entry Type\n{{ENTRY_TYPE}}\n\n## Scene\n{{SCENE_CONTENT}}\n\n## Author Notes\n{{USER_NOTES}}",
        "is_built_in": 1,
        "built_in_key": "codex_distill",
    },
]


def migrate_ai_prompts():
    """Create ai_prompts table and seed the three built-in defaults if not already present."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                system TEXT NOT NULL DEFAULT '',
                user_template TEXT NOT NULL DEFAULT '',
                is_built_in INTEGER NOT NULL DEFAULT 0,
                built_in_key TEXT,
                word_count INTEGER NOT NULL DEFAULT 400
            )
        """))
        try:
            conn.execute(text("ALTER TABLE ai_prompts ADD COLUMN word_count INTEGER NOT NULL DEFAULT 400"))
        except Exception:
            pass  # column already exists
        for p in DEFAULT_AI_PROMPTS:
            existing = conn.execute(
                text("SELECT id FROM ai_prompts WHERE built_in_key = :key"),
                {"key": p["built_in_key"]},
            ).fetchone()
            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO ai_prompts (name, description, system, user_template, is_built_in, built_in_key, word_count)
                        VALUES (:name, :description, :system, :user_template, :is_built_in, :built_in_key, :word_count)
                    """),
                    {**p, "word_count": p.get("word_count", 400)},
                )
        # Upgrade: update built-in system texts when expected placeholders are missing
        _required = {
            "story_generate": ["{{LANGUAGE}}", "{{WORD_COUNT}}"],
            "lector_review":  ["{{LANGUAGE}}"],
            "codex_distill":  ["{{LANGUAGE}}"],
        }
        for p in DEFAULT_AI_PROMPTS:
            tokens = _required.get(p["built_in_key"], [])
            row = conn.execute(
                text("SELECT id, system FROM ai_prompts WHERE built_in_key = :key"),
                {"key": p["built_in_key"]},
            ).fetchone()
            if row and any(t not in (row[1] or "") for t in tokens):
                conn.execute(
                    text("UPDATE ai_prompts SET system = :system WHERE id = :id"),
                    {"system": p["system"], "id": row[0]},
                )


def migrate_scene_versions():
    """Create scene_versions table."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS scene_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
                content TEXT NOT NULL DEFAULT '',
                content_hash TEXT NOT NULL DEFAULT '',
                created_at DATETIME DEFAULT (datetime('now'))
            )
        """))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

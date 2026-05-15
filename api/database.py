import json
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./loreweaver.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
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
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

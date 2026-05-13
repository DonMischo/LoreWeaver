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


def migrate_new_columns():
    """Safely add new columns to existing databases without Alembic."""
    new_columns = [
        ("codex_entries", "entry_group", "TEXT"),
        ("codex_entries", "species",     "TEXT"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists — SQLite raises OperationalError


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

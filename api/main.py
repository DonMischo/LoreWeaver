import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, migrate_to_four_level, migrate_new_columns, migrate_entry_groups, migrate_ai_prompts, migrate_scene_versions, migrate_mention_stats, migrate_writing_log
from models import Base
from routers import projects, acts, chapters, scenes, codex, settings, ai, export, imports, graph, time, fragments, images, scene_commands

# ── Run migrations BEFORE create_all so table renames happen first ────────────
migrate_to_four_level()

Base.metadata.create_all(bind=engine)
migrate_new_columns()
migrate_entry_groups()
migrate_ai_prompts()
migrate_scene_versions()
migrate_mention_stats()
migrate_writing_log()

os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="Foliantica API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # Allow any localhost / 127.0.0.1 port — needed for the Electron build
    # where the Next.js server runs on a dynamic port.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(acts.router)
app.include_router(chapters.router)
app.include_router(scenes.router)
app.include_router(codex.router)
app.include_router(settings.router)
app.include_router(ai.router)
app.include_router(export.router)
app.include_router(imports.router)
app.include_router(graph.router)
app.include_router(time.router)
app.include_router(fragments.router)
app.include_router(images.router)
app.include_router(scene_commands.router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}

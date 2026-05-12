from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routers import projects, chapters, scenes, codex, settings, ai, export, imports

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LoreWeaver API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(chapters.router)
app.include_router(scenes.router)
app.include_router(codex.router)
app.include_router(settings.router)
app.include_router(ai.router)
app.include_router(export.router)
app.include_router(imports.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

"""
Electron / PyInstaller entry point.

Sets the working directory to LW_DATA_DIR (the OS user-data folder provided
by Electron) BEFORE any app module is imported, so SQLite and uploads end up
in the right place for end-users.

In normal development just use:  uvicorn main:app --reload
"""
import os
import sys

if __name__ == "__main__":
    # ── Data directory ────────────────────────────────────────────────────────
    # Must happen BEFORE importing main so SQLite + uploads resolve correctly.
    data_dir = os.environ.get("LW_DATA_DIR")
    if data_dir:
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(os.path.join(data_dir, "uploads"), exist_ok=True)
        os.chdir(data_dir)

    # ── Import the ASGI app ───────────────────────────────────────────────────
    # Explicit import (not the "main:app" string form) so that PyInstaller can
    # follow the dependency chain and bundle all app modules.
    from main import app  # noqa: E402

    # ── Start server ──────────────────────────────────────────────────────────
    import uvicorn  # noqa: E402

    port = int(os.environ.get("LW_API_PORT", "8000"))
    host = os.environ.get("LW_API_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port, workers=1, log_level="warning")

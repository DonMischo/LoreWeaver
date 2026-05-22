"""
Loreweaver Pandoc export service.

POST /convert
  body (JSON):
    html:     str          — HTML content of the book
    format:   "pdf" | "epub"
    title:    str
    author:   str | None
    language: str | None   — BCP-47 code, e.g. "en", "de"
    cover:    str | None   — base64-encoded PNG/JPEG for EPUB cover

Returns the binary file with the appropriate Content-Type.
"""

import base64
import subprocess
import tempfile
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Loreweaver Pandoc")


class ConvertRequest(BaseModel):
    html: str
    format: str                    # "pdf" | "epub"
    title: str = "Untitled"
    author: str | None = None
    language: str | None = "en"
    cover: str | None = None       # base64 image for EPUB cover


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
def convert(req: ConvertRequest):
    if req.format not in ("pdf", "epub"):
        raise HTTPException(400, "format must be 'pdf' or 'epub'")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        src = tmp / "input.html"
        out = tmp / f"output.{req.format}"

        # Write source HTML
        src.write_text(req.html, encoding="utf-8")

        # Build pandoc command
        cmd = [
            "pandoc", str(src), "-o", str(out),
            "--metadata", f"title={req.title}",
            "--standalone",
        ]

        if req.author:
            cmd += ["--metadata", f"author={req.author}"]

        if req.language:
            cmd += ["--metadata", f"lang={req.language}"]

        if req.format == "pdf":
            cmd += [
                "--pdf-engine=xelatex",
                "-V", "geometry:margin=2.5cm",
                "-V", "fontsize=12pt",
                "-V", "linestretch=1.5",
            ]
        elif req.format == "epub":
            cmd += ["--epub-chapter-level=2"]
            if req.cover:
                # Decode base64 cover image
                cover_path = tmp / "cover.jpg"
                cover_path.write_bytes(base64.b64decode(req.cover))
                cmd += [f"--epub-cover-image={cover_path}"]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=False,
            timeout=120,
        )

        if result.returncode != 0:
            error = result.stderr.decode("utf-8", errors="replace")
            raise HTTPException(500, f"Pandoc error: {error[:500]}")

        data = out.read_bytes()

    media_types = {
        "pdf":  "application/pdf",
        "epub": "application/epub+zip",
    }
    return Response(content=data, media_type=media_types[req.format])

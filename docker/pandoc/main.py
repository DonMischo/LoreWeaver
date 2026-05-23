"""
Foliantica Pandoc export service.

POST /convert
  body (JSON):
    html:             str          — HTML content of the book
    format:           "pdf" | "epub"
    title:            str
    author:           str | None
    language:         str | None   — BCP-47 code, e.g. "en", "de"
    cover:            str | None   — base64-encoded PNG/JPEG for EPUB cover
    font:             str | None   — body font name (XeLaTeX mainfont)
    heading_font:     str | None   — separate heading font (EPUB CSS only for now)
    heading_align:    str          — "center" | "left"
    h1_size:          str          — CSS size, e.g. "2em"
    h2_size:          str
    h3_size:          str
    h3_style:         str          — "italic" | "normal" | "bold"
    paragraph_indent: str          — e.g. "1.5em" or "0"
    text_align:       str          — "justify" | "left"
    pdf_margin:       str          — e.g. "2.5cm"
    page_numbers:     bool
    line_spacing:     str          — "1" | "1.5" | "2"
    font_size:        str          — "10pt" | "11pt" | "12pt"

GET /fonts
  Returns { fonts: [str] } — list of font families available to XeLaTeX

GET /health
  Health check
"""

import base64
import re as _re
import subprocess
import tempfile
import urllib.request as _urlreq
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Foliantica Pandoc")

_GFONT_CACHE = Path("/tmp/gfonts")  # Google Font TTF cache


# ── Google Font helper ────────────────────────────────────────────────────────

def _ensure_google_font(name: str) -> bool:
    """Download a Google Font TTF into /tmp/gfonts/ and register with fontconfig.
    Returns True if the font is (now) available, False on failure."""
    safe = name.replace(" ", "_")
    dest_dir = _GFONT_CACHE / safe
    # If any font file already cached, assume it's registered
    if any(dest_dir.glob("*.ttf")) or any(dest_dir.glob("*.otf")):
        return True

    # Use an old User-Agent so Google Fonts returns TTF format
    css_url = f"https://fonts.googleapis.com/css?family={name.replace(' ', '+')}"
    req = _urlreq.Request(css_url, headers={
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.5; Windows NT 4.0)"
    })
    try:
        with _urlreq.urlopen(req, timeout=15) as r:
            css = r.read().decode()
    except Exception:
        return False

    urls = _re.findall(
        r"url\((https://fonts\.gstatic\.com/[^)]+\.(?:ttf|otf))\)", css
    )
    if not urls:
        return False

    dest_dir.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    for i, url in enumerate(urls[:4]):   # up to 4 weight variants
        ext = url.rsplit(".", 1)[-1]
        try:
            with _urlreq.urlopen(url, timeout=20) as r:
                (dest_dir / f"{safe}_{i}.{ext}").write_bytes(r.read())
            downloaded += 1
        except Exception:
            pass

    if downloaded == 0:
        return False

    subprocess.run(["fc-cache", str(dest_dir)], capture_output=True, timeout=10)
    return True


def _font_available(name: str) -> bool:
    """Check if a font family is available to fontconfig."""
    result = subprocess.run(
        ["fc-list", f":family={name}"],
        capture_output=True, text=True, timeout=5,
    )
    return bool(result.stdout.strip())


def _resolve_font(name: str | None) -> str | None:
    """Ensure font is available locally; try Google Fonts if not. Returns name or None."""
    if not name:
        return None
    if _font_available(name):
        return name
    if _ensure_google_font(name):
        return name
    return None  # could not resolve — fall back to default


# ── Request model ─────────────────────────────────────────────────────────────

class ConvertRequest(BaseModel):
    html:             str
    format:           str                  # "pdf" | "epub"
    title:            str    = "Untitled"
    author:           str | None = None
    language:         str | None = "en"
    cover:            str | None = None    # base64 image for EPUB cover
    # Typography
    font:             str | None = None
    heading_font:     str | None = None
    heading_align:    str        = "center"
    h1_size:          str        = "2em"
    h2_size:          str        = "1.5em"
    h3_size:          str        = "1.25em"
    h3_style:         str        = "italic"
    paragraph_indent: str        = "1.5em"
    text_align:       str        = "justify"
    pdf_margin:       str        = "2.5cm"
    page_numbers:     bool       = True
    line_spacing:     str        = "1.5"
    font_size:        str        = "12pt"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/fonts")
def list_fonts():
    """Return all font families available to fontconfig / XeLaTeX."""
    result = subprocess.run(
        ["fc-list", ":", "family"],
        capture_output=True, text=True, timeout=10,
    )
    fonts: set[str] = set()
    for line in result.stdout.splitlines():
        # fc-list may output "Family,Variant Style" — take first part
        name = line.split(",")[0].strip()
        if name:
            fonts.add(name)
    return {"fonts": sorted(fonts)}


_LS_TO_STRETCH = {"1": "1.0", "1.5": "1.5", "2": "2.0"}
_FS_TO_PT      = {"10pt": "10pt", "11pt": "11pt", "12pt": "12pt"}


@app.post("/convert")
def convert(req: ConvertRequest):
    if req.format not in ("pdf", "epub"):
        raise HTTPException(400, "format must be 'pdf' or 'epub'")

    with tempfile.TemporaryDirectory() as tmp:
        tmp  = Path(tmp)
        src  = tmp / "input.html"
        out  = tmp / f"output.{req.format}"

        src.write_text(req.html, encoding="utf-8")

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
            # Resolve fonts (download from Google if needed)
            body_font    = _resolve_font(req.font)

            pdf_vars = [
                ("geometry",    f"margin={req.pdf_margin}"),
                ("fontsize",    _FS_TO_PT.get(req.font_size, "12pt")),
                ("linestretch", _LS_TO_STRETCH.get(req.line_spacing, "1.5")),
            ]
            if body_font:
                pdf_vars.append(("mainfont", body_font))
            if not req.page_numbers:
                pdf_vars.append(("pagestyle", "empty"))

            for k, v in pdf_vars:
                cmd += ["-V", f"{k}:{v}"]
            cmd += ["--pdf-engine=xelatex"]

            # Pass FONTCONFIG_PATH so xelatex can find downloaded fonts
            import os
            env = {**os.environ, "FONTCONFIG_PATH": str(_GFONT_CACHE)}

        elif req.format == "epub":
            cmd += ["--epub-chapter-level=2"]
            if req.cover:
                cover_path = tmp / "cover.jpg"
                cover_path.write_bytes(base64.b64decode(req.cover))
                cmd += [f"--epub-cover-image={cover_path}"]

            # Generate an inline CSS for the EPUB
            body_font    = req.font or "Georgia"
            h_font       = req.heading_font or body_font
            indent_css   = req.paragraph_indent if req.paragraph_indent != "0" else "0"
            h3_style_css = {
                "italic": "font-style: italic;",
                "bold":   "font-weight: bold;",
                "normal": "",
            }.get(req.h3_style, "font-style: italic;")

            epub_css = f"""\
body {{
  font-family: "{body_font}", Georgia, serif;
  font-size: 1em;
  line-height: {_LS_TO_STRETCH.get(req.line_spacing, "1.5")};
  text-align: {req.text_align};
  margin: 2em;
}}
h1, h2, h3, h4 {{
  font-family: "{h_font}", Georgia, serif;
  text-align: {req.heading_align};
}}
h1 {{ font-size: {req.h1_size}; }}
h2 {{ font-size: {req.h2_size}; }}
h3 {{ font-size: {req.h3_size}; {h3_style_css} }}
p {{ margin: 0; text-indent: {indent_css}; }}
p:first-of-type, h1 + p, h2 + p, h3 + p {{ text-indent: 0; }}
figure {{ margin: 1.5em auto; text-align: center; }}
figure img {{ max-width: 100%; height: auto; }}
figcaption {{ font-size: 0.85em; opacity: 0.7; margin-top: 0.4em; }}
"""
            css_path = tmp / "style.css"
            css_path.write_text(epub_css, encoding="utf-8")
            cmd += [f"--css={css_path}"]
            env = None  # no special env for epub

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=False,
            timeout=120,
            env=env if req.format == "pdf" else None,
        )

        if result.returncode != 0:
            error = result.stderr.decode("utf-8", errors="replace")
            raise HTTPException(500, f"Pandoc error: {error[:500]}")

        data = out.read_bytes()

    media_types = {"pdf": "application/pdf", "epub": "application/epub+zip"}
    return Response(content=data, media_type=media_types[req.format])

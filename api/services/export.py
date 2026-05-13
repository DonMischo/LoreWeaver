import json
import re
from jinja2 import Environment
from models import Project

_jinja = Environment(autoescape=False)


# ── Book metadata helper ──────────────────────────────────────────────────────

def _get_meta(project: Project) -> dict:
    """Return parsed book_meta dict, or empty dict if not set."""
    if not project.book_meta:
        return {}
    try:
        return json.loads(project.book_meta)
    except Exception:
        return {}


# ── HTML → plain text ─────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html or "")
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


# ── LaTeX character escaping ──────────────────────────────────────────────────

_LATEX_ESCAPES = str.maketrans({
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}", "\\": r"\textbackslash{}",
})


def _escape_latex(text: str) -> str:
    return (text or "").translate(_LATEX_ESCAPES)


# ── YAML string escaping (for frontmatter) ────────────────────────────────────

def _yaml_str(value: str) -> str:
    """Wrap a string in YAML double-quotes, escaping backslash and quote."""
    escaped = (value or "").replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


# ── Helpers ───────────────────────────────────────────────────────────────────

def _scene_ids_set(opts) -> set[int] | None:
    return set(opts.scene_ids) if opts.scene_ids is not None else None


def _line_spacing_latex(val: str) -> str:
    return {"1": "\\singlespacing", "1.5": "\\onehalfspacing", "2": "\\doublespacing"}.get(val, "\\onehalfspacing")


def _font_size_latex(val: str) -> str:
    return val if val in {"10pt", "11pt", "12pt"} else "12pt"


# ── Markdown export ───────────────────────────────────────────────────────────

def export_markdown(project: Project, opts) -> str:
    meta = _get_meta(project)
    allowed = _scene_ids_set(opts)

    # ── YAML frontmatter (Pandoc-compatible) ──────────────────────────────────
    fm_lines = ["---"]
    fm_lines.append(f"title: {_yaml_str(project.title)}")
    if meta.get("subtitle"):
        fm_lines.append(f"subtitle: {_yaml_str(meta['subtitle'])}")
    if meta.get("author"):
        fm_lines.append(f"author: {_yaml_str(meta['author'])}")
    if meta.get("language"):
        fm_lines.append(f"lang: {meta['language']}")
    if meta.get("publisher"):
        fm_lines.append(f"publisher: {_yaml_str(meta['publisher'])}")
    if meta.get("published_date"):
        fm_lines.append(f"date: {_yaml_str(meta['published_date'])}")
    if meta.get("isbn"):
        fm_lines.append(f"isbn: {_yaml_str(meta['isbn'])}")
    if meta.get("rights"):
        fm_lines.append(f"rights: {_yaml_str(meta['rights'])}")
    if meta.get("series"):
        fm_lines.append(f"series: {_yaml_str(meta['series'])}")
        if meta.get("series_index"):
            fm_lines.append(f"series-position: {_yaml_str(meta['series_index'])}")
    if meta.get("genre"):
        subjects = [meta["genre"]] + meta.get("subjects", [])
        fm_lines.append("subject:")
        for s in subjects:
            fm_lines.append(f"  - {_yaml_str(s)}")
    elif meta.get("subjects"):
        fm_lines.append("subject:")
        for s in meta["subjects"]:
            fm_lines.append(f"  - {_yaml_str(s)}")
    if meta.get("translator"):
        fm_lines.append(f"translator: {_yaml_str(meta['translator'])}")
    if meta.get("editor"):
        fm_lines.append(f"editor: {_yaml_str(meta['editor'])}")
    if meta.get("synopsis"):
        fm_lines.append(f"description: {_yaml_str(meta['synopsis'])}")
    fm_lines.append("---")
    fm_lines.append("")

    lines: list[str] = fm_lines + [f"# {project.title}", ""]
    if meta.get("subtitle"):
        lines += [f"*{meta['subtitle']}*", ""]
    if meta.get("author"):
        lines += [f"*{meta['author']}*", ""]
    if project.description:
        lines += [project.description, ""]

    # Compute heading levels dynamically
    h = ["##", "###", "####"]   # act, chapter, scene depth
    if not opts.include_act_headings:
        h = ["##", "###"]        # shift chapter and scene up
    if not opts.include_chapter_headings:
        h = h[:1] + [h[1]]      # scene uses chapter's slot

    for act in sorted(project.acts, key=lambda a: a.order_index):
        act_written = False
        for chapter in sorted(act.chapters, key=lambda c: c.order_index):
            chap_written = False
            for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                if allowed is not None and scene.id not in allowed:
                    continue
                body = _strip_html(scene.content)
                if not body:
                    continue
                # Lazy-emit ancestor headings only when we have real content
                if opts.include_act_headings and not act_written:
                    lines += [f"{h[0]} {act.title}", ""]
                    act_written = True
                if opts.include_chapter_headings and not chap_written:
                    idx = 1 if opts.include_act_headings else 0
                    lines += [f"{h[idx]} {chapter.title}", ""]
                    chap_written = True
                if opts.include_scene_headings and scene.title:
                    idx = (2 if opts.include_act_headings and opts.include_chapter_headings
                           else 1 if opts.include_act_headings or opts.include_chapter_headings
                           else 0)
                    lines += [f"{h[idx]} {scene.title}", ""]
                lines += [body, ""]

    return "\n".join(lines)


# ── LaTeX export (LuaLaTeX + fontspec) ────────────────────────────────────────
# Jinja2 template: LaTeX's single {braces} are literal text; variables use {{ var }}.

_LATEX_TEMPLATE = """\
% Generated by LoreWeaver — compile with: lualatex {{ filename }}
\\documentclass[{{ font_size }},openany]{book}

% ── Engine & fonts ────────────────────────────────────────────────────────────
\\usepackage{fontspec}
{{ font_cmd }}
\\usepackage{microtype}

% ── Page layout ───────────────────────────────────────────────────────────────
\\usepackage[{{ paper_size }},margin=1in]{geometry}

% ── Spacing & paragraphs ──────────────────────────────────────────────────────
\\usepackage{setspace}
{{ spacing_cmd }}
\\usepackage{parskip}
\\setlength{\\parskip}{0.6em}

% ── Heading styles ────────────────────────────────────────────────────────────
\\usepackage{titlesec}
\\titleformat{\\chapter}[display]{\\normalfont\\Large\\bfseries\\centering}{}{0pt}{}[\\vspace{0.5em}\\titlerule]
\\titlespacing*{\\chapter}{0pt}{-20pt}{30pt}
\\titleformat{\\section}{\\normalfont\\large\\bfseries}{}{0pt}{}
\\titleformat{\\subsection}{\\normalfont\\normalsize\\itshape}{}{0pt}{}

% ── Hyperlinks ────────────────────────────────────────────────────────────────
\\usepackage[hidelinks]{hyperref}

% ── Document meta ─────────────────────────────────────────────────────────────
\\title{ {{ title_block }} }
\\author{ {{ author }} }
\\date{ {{ pub_date }} }
{% if publisher or rights or isbn or series %}
\\newcommand{\\bookpublisher}{ {{ publisher }} }
{% if isbn %}\\newcommand{\\bookisbn}{ {{ isbn }} }{% endif %}
{% if rights %}\\newcommand{\\bookrights}{ {{ rights }} }{% endif %}
{% if series %}\\newcommand{\\bookseries}{ {{ series }}{% if series_index %}, \\#{{ series_index }}{% endif %} }{% endif %}
{% endif %}

\\begin{document}

\\maketitle
\\newpage

{{ description_block }}
{{ body }}
\\end{document}
"""

_DESCRIPTION_BLOCK = """\
\\begin{center}
\\textit{ {{ desc }} }
\\end{center}
\\vspace{2em}
\\newpage

"""


def export_latex(project: Project, opts) -> str:
    meta = _get_meta(project)
    allowed = _scene_ids_set(opts)

    font_cmd = (
        f"\\setmainfont{{{opts.font}}}"
        if opts.font else
        "% \\setmainfont{EB Garamond}  % uncomment and set your font"
    )

    # Title block: include subtitle as a secondary line if set
    title_esc = _escape_latex(project.title)
    subtitle_esc = _escape_latex(meta.get("subtitle", ""))
    title_block = (
        f"{title_esc} \\\\ \\large {subtitle_esc}"
        if subtitle_esc else title_esc
    )

    body_parts: list[str] = []

    for act in sorted(project.acts, key=lambda a: a.order_index):
        act_written = False
        for chapter in sorted(act.chapters, key=lambda c: c.order_index):
            chap_written = False
            for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                if allowed is not None and scene.id not in allowed:
                    continue
                content = _escape_latex(_strip_html(scene.content))
                if not content:
                    continue

                # Lazy act heading
                if opts.include_act_headings and not act_written:
                    body_parts.append(
                        f"\\chapter*{{{_escape_latex(act.title)}}}\n"
                        f"\\addcontentsline{{toc}}{{chapter}}{{{_escape_latex(act.title)}}}\n"
                    )
                    act_written = True

                # Lazy chapter heading
                if opts.include_chapter_headings and not chap_written:
                    if opts.include_act_headings:
                        body_parts.append(f"\\section*{{{_escape_latex(chapter.title)}}}\n")
                    else:
                        body_parts.append(
                            f"\\chapter*{{{_escape_latex(chapter.title)}}}\n"
                            f"\\addcontentsline{{toc}}{{chapter}}{{{_escape_latex(chapter.title)}}}\n"
                        )
                    chap_written = True

                # Scene heading
                if opts.include_scene_headings and scene.title:
                    if opts.include_chapter_headings:
                        body_parts.append(f"\\subsection*{{{_escape_latex(scene.title)}}}\n")
                    elif opts.include_act_headings:
                        body_parts.append(f"\\section*{{{_escape_latex(scene.title)}}}\n")
                    else:
                        body_parts.append(
                            f"\\chapter*{{{_escape_latex(scene.title)}}}\n"
                            f"\\addcontentsline{{toc}}{{chapter}}{{{_escape_latex(scene.title)}}}\n"
                        )

                paras = [p.strip() for p in content.split("\n\n") if p.strip()]
                body_parts.append("\n\n".join(paras) + "\n\n")

    safe_title = project.title.replace(" ", "_")

    # Description block: prefer synopsis from meta, fall back to project description
    desc_text = meta.get("synopsis") or project.description or ""
    description_block = (
        _jinja.from_string(_DESCRIPTION_BLOCK).render(desc=_escape_latex(desc_text))
        if desc_text else ""
    )

    return _jinja.from_string(_LATEX_TEMPLATE).render(
        filename=f"{safe_title}.tex",
        font_size=_font_size_latex(opts.font_size),
        font_cmd=font_cmd,
        paper_size=opts.paper_size if opts.paper_size in ("a4paper", "letterpaper") else "a4paper",
        spacing_cmd=_line_spacing_latex(opts.line_spacing),
        title_block=title_block,
        author=_escape_latex(meta.get("author", "")),
        pub_date=_escape_latex(meta.get("published_date", "")),
        publisher=_escape_latex(meta.get("publisher", "")),
        isbn=_escape_latex(meta.get("isbn", "")),
        rights=_escape_latex(meta.get("rights", "")),
        series=_escape_latex(meta.get("series", "")),
        series_index=_escape_latex(meta.get("series_index", "")),
        description_block=description_block,
        body="".join(body_parts),
    )


# ── EPUB style (CSS) export ───────────────────────────────────────────────────

_EPUB_CSS_TEMPLATE = """\
/* LoreWeaver EPUB stylesheet — use with Pandoc or Calibre
{meta_comment}*/

@namespace epub "http://www.idpf.org/2007/ops";

body {{
  font-family: {font_family};
  font-size: {font_size_css};
  line-height: {line_height};
  color: {text_color};
  background-color: {bg_color};
  margin: {page_margin};
  text-align: justify;
  hyphens: auto;
  -epub-hyphens: auto;
}}

h1, h2, h3, h4 {{
  font-family: {font_family};
  font-weight: bold;
  text-align: center;
  margin-top: 2em;
  margin-bottom: 1em;
  page-break-after: avoid;
}}
h1 {{ font-size: 2em; }}
h2 {{ font-size: 1.5em; border-bottom: 1px solid currentColor; padding-bottom: 0.3em; }}
h3 {{ font-size: 1.25em; }}
h4 {{ font-size: 1em; font-style: italic; }}

p {{
  margin: 0;
  text-indent: 1.5em;
}}
p:first-of-type, h1 + p, h2 + p, h3 + p, h4 + p {{ text-indent: 0; }}

hr {{
  border: none;
  text-align: center;
  margin: 1.5em auto;
}}
hr::after {{
  content: "* * *";
  color: {text_color};
  font-size: 0.9em;
}}

.chapter {{ page-break-before: always; -epub-page-break-before: always; }}

em {{ font-style: italic; }}
strong {{ font-weight: bold; }}

blockquote {{
  margin: 1em 2em;
  font-style: italic;
  border-left: 3px solid {text_color};
  padding-left: 1em;
  opacity: 0.85;
}}
"""

_FONT_SIZE_CSS = {"10pt": "0.9em", "11pt": "1em", "12pt": "1.1em"}
_LINE_HEIGHT_CSS = {"1": "1.4", "1.5": "1.7", "2": "2.0"}


def export_epub_style(project: Project, opts) -> str:
    meta = _get_meta(project)
    font_family = f'"{opts.font}", Georgia, serif' if opts.font else "Georgia, serif"

    # Build metadata comment block
    meta_fields = []
    if meta.get("author"):
        meta_fields.append(f"   Author:    {meta['author']}")
    if meta.get("subtitle"):
        meta_fields.append(f"   Subtitle:  {meta['subtitle']}")
    if meta.get("language"):
        meta_fields.append(f"   Language:  {meta['language']}")
    if meta.get("publisher"):
        meta_fields.append(f"   Publisher: {meta['publisher']}")
    if meta.get("published_date"):
        meta_fields.append(f"   Date:      {meta['published_date']}")
    if meta.get("isbn"):
        meta_fields.append(f"   ISBN:      {meta['isbn']}")
    if meta.get("rights"):
        meta_fields.append(f"   Rights:    {meta['rights']}")
    if meta.get("series"):
        series_str = meta["series"]
        if meta.get("series_index"):
            series_str += f" #{meta['series_index']}"
        meta_fields.append(f"   Series:    {series_str}")

    meta_comment = ("\n" + "\n".join(meta_fields) + "\n") if meta_fields else ""

    return _EPUB_CSS_TEMPLATE.format(
        meta_comment=meta_comment,
        font_family=font_family,
        font_size_css=_FONT_SIZE_CSS.get(opts.font_size, "1em"),
        line_height=_LINE_HEIGHT_CSS.get(opts.line_spacing, "1.7"),
        text_color=opts.text_color,
        bg_color=opts.bg_color,
        page_margin=opts.page_margin,
    )

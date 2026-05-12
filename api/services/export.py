import re
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

from models import Project, Chapter, Scene

_TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "export"
_jinja_env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)), autoescape=False)

_LATEX_ESCAPES = str.maketrans({
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}", "\\": r"\textbackslash{}",
})


def _strip_html(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html or "")
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def _escape_latex(text: str) -> str:
    return text.translate(_LATEX_ESCAPES)


def export_markdown(project: Project) -> str:
    lines = [f"# {project.title}", ""]
    if project.description:
        lines += [project.description, ""]

    for chapter in sorted(project.chapters, key=lambda c: c.order_index):
        lines += [f"## {chapter.title}", ""]
        for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
            title = scene.title or "Scene"
            lines += [f"### {title}", ""]
            lines += [_strip_html(scene.content), ""]

    return "\n".join(lines)


def export_latex(project: Project) -> str:
    template = _jinja_env.get_template("latex_template.tex")

    chapters_data = []
    for chapter in sorted(project.chapters, key=lambda c: c.order_index):
        scenes_data = []
        for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
            scenes_data.append({
                "title": _escape_latex(scene.title or ""),
                "content": _escape_latex(_strip_html(scene.content)),
            })
        chapters_data.append({
            "title": _escape_latex(chapter.title),
            "scenes": scenes_data,
        })

    return template.render(
        title=_escape_latex(project.title),
        description=_escape_latex(project.description or ""),
        chapters=chapters_data,
    )

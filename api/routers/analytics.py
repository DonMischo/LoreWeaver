"""
Analytics endpoint — pacing & prose statistics for a project.
All computation is done in pure Python on the stored HTML content;
no extra dependencies beyond the stdlib.
"""
import re
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Project, Act, Chapter, Scene
from schemas import ProjectAnalytics, SceneAnalytics, ChapterAnalytics

router = APIRouter(prefix="/api", tags=["analytics"])


# ── Text utilities ────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")


def _count_syllables(word: str) -> int:
    """Simple vowel-cluster syllable approximation."""
    word = re.sub(r"[^a-zA-Z]", "", word).lower()
    if not word:
        return 0
    count = len(re.findall(r"[aeiouy]+", word))
    # Silence trailing 'e' (e.g. "cake" = 1 not 2)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def _sentence_stats(plain: str) -> tuple[float, float]:
    """Return (avg_sentence_length_words, dialogue_ratio)."""
    lines = [ln.strip() for ln in plain.split("\n") if ln.strip()]
    dialogue_lines = sum(
        1 for ln in lines
        if ln.startswith('"') or ln.startswith("“") or ln.startswith("«")
    )
    dialogue_ratio = dialogue_lines / len(lines) if lines else 0.0

    sentences = [s.strip() for s in re.split(r"[.!?]+", plain) if s.strip()]
    if not sentences:
        return 0.0, dialogue_ratio
    word_counts = [len(s.split()) for s in sentences if s.split()]
    avg_sl = sum(word_counts) / len(word_counts) if word_counts else 0.0
    return round(avg_sl, 2), round(dialogue_ratio, 3)


def _flesch(plain: str) -> tuple[float, float]:
    """Return (Flesch Reading Ease score, Flesch-Kincaid Grade Level)."""
    words = plain.split()
    if not words:
        return 0.0, 0.0
    sentences = [s.strip() for s in re.split(r"[.!?]+", plain) if s.strip()]
    if not sentences:
        return 0.0, 0.0

    n_words = len(words)
    n_sents = len(sentences)
    n_sylls = sum(_count_syllables(w) for w in words)

    asl = n_words / n_sents        # avg sentence length
    asw = n_sylls / n_words        # avg syllables per word

    ease  = max(0.0, min(100.0, round(206.835 - 1.015 * asl - 84.6 * asw, 1)))
    grade = max(0.0, round(0.39 * asl + 11.8 * asw - 15.59, 1))
    return ease, grade


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/analytics", response_model=ProjectAnalytics)
def get_analytics(project_id: int, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .options(selectinload(Project.acts).selectinload(Act.chapters).selectinload(Chapter.scenes))
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scene_rows: list[SceneAnalytics] = []
    chapter_rows: list[ChapterAnalytics] = []
    total_words = 0
    global_type_dist: Counter = Counter()

    for act in sorted(project.acts, key=lambda a: a.order_index):
        for chapter in sorted(act.chapters, key=lambda c: c.order_index):
            ch_words = 0
            ch_type_dist: Counter = Counter()
            ch_plain_parts: list[str] = []

            for scene in sorted(chapter.scenes, key=lambda s: s.order_index):
                plain = _strip_html(scene.content or "")
                avg_sl, dial_ratio = _sentence_stats(plain)
                ch_plain_parts.append(plain)
                ch_words += scene.word_count or 0

                if scene.scene_type:
                    ch_type_dist[scene.scene_type] += 1
                    global_type_dist[scene.scene_type] += 1

                scene_rows.append(SceneAnalytics(
                    scene_id=scene.id,
                    scene_title=scene.title,
                    chapter_id=chapter.id,
                    chapter_title=chapter.title,
                    act_id=act.id,
                    act_title=act.title,
                    order_index=scene.order_index,
                    word_count=scene.word_count or 0,
                    scene_type=scene.scene_type,
                    avg_sentence_length=avg_sl,
                    dialogue_ratio=dial_ratio,
                ))

            # Chapter-level Flesch: concatenate all scene text
            ch_full_plain = " ".join(ch_plain_parts)
            flesch, grade = _flesch(ch_full_plain)
            total_words += ch_words

            chapter_rows.append(ChapterAnalytics(
                chapter_id=chapter.id,
                chapter_title=chapter.title,
                act_id=act.id,
                act_title=act.title,
                word_count=ch_words,
                scene_count=len(chapter.scenes),
                flesch_score=flesch,
                grade_level=grade,
                scene_type_dist=dict(ch_type_dist),
            ))

    return ProjectAnalytics(
        scenes=scene_rows,
        chapters=chapter_rows,
        total_word_count=total_words,
        scene_type_dist=dict(global_type_dist),
    )

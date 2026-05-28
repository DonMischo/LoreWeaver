from datetime import date, datetime, UTC, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AchievementUnlock, WritingLog, CodexEntry, CodexRelation,
    MentionStat, Scene, Project, QuerySubmission, ResearchItem,
)

router = APIRouter(prefix="/api", tags=["achievements"])

# ── Achievement definitions ───────────────────────────────────────────────────
# Each entry: key, name, desc, cat, tier (1-5), metric, threshold

ACHIEVEMENTS = [
    # ── Streaks ───────────────────────────────────────────────────────────────
    {"key": "streak_1",   "name": "First Spark",       "desc": "Write for the very first day.",            "cat": "streaks", "tier": 1, "metric": "longest_streak", "threshold": 1},
    {"key": "streak_3",   "name": "Three's Company",   "desc": "Maintain a 3-day writing streak.",         "cat": "streaks", "tier": 1, "metric": "longest_streak", "threshold": 3},
    {"key": "streak_7",   "name": "Week Warrior",      "desc": "Write every day for a full week.",         "cat": "streaks", "tier": 2, "metric": "longest_streak", "threshold": 7},
    {"key": "streak_14",  "name": "Fortnight Fighter", "desc": "14-day writing streak.",                   "cat": "streaks", "tier": 2, "metric": "longest_streak", "threshold": 14},
    {"key": "streak_30",  "name": "Monthly Maven",     "desc": "30-day writing streak.",                   "cat": "streaks", "tier": 3, "metric": "longest_streak", "threshold": 30},
    {"key": "streak_90",  "name": "Quarter Champion",  "desc": "90-day writing streak.",                   "cat": "streaks", "tier": 4, "metric": "longest_streak", "threshold": 90},
    {"key": "streak_180", "name": "Half-Year Hero",    "desc": "180-day writing streak.",                  "cat": "streaks", "tier": 4, "metric": "longest_streak", "threshold": 180},
    {"key": "streak_365", "name": "Year of Words",     "desc": "Write every single day for a full year.",  "cat": "streaks", "tier": 5, "metric": "longest_streak", "threshold": 365},

    # ── Total words ───────────────────────────────────────────────────────────
    {"key": "words_100",  "name": "First Words",       "desc": "Write your first 100 words.",              "cat": "words", "tier": 1, "metric": "total_words", "threshold": 100},
    {"key": "words_1k",   "name": "Getting Started",   "desc": "1,000 words written total.",               "cat": "words", "tier": 1, "metric": "total_words", "threshold": 1_000},
    {"key": "words_5k",   "name": "In the Flow",       "desc": "5,000 words written.",                     "cat": "words", "tier": 2, "metric": "total_words", "threshold": 5_000},
    {"key": "words_10k",  "name": "Committed",         "desc": "10,000 words written.",                    "cat": "words", "tier": 2, "metric": "total_words", "threshold": 10_000},
    {"key": "words_20k",  "name": "Short Story",       "desc": "20,000 words written.",                    "cat": "words", "tier": 2, "metric": "total_words", "threshold": 20_000},
    {"key": "words_40k",  "name": "Novella",           "desc": "40,000 words — novella territory.",        "cat": "words", "tier": 3, "metric": "total_words", "threshold": 40_000},
    {"key": "words_80k",  "name": "Novel",             "desc": "80,000 words — a full novel.",             "cat": "words", "tier": 3, "metric": "total_words", "threshold": 80_000},
    {"key": "words_100k", "name": "Centennial",        "desc": "100,000 words written.",                   "cat": "words", "tier": 4, "metric": "total_words", "threshold": 100_000},
    {"key": "words_250k", "name": "Prolific",          "desc": "250,000 words written.",                   "cat": "words", "tier": 4, "metric": "total_words", "threshold": 250_000},
    {"key": "words_500k", "name": "Half a Million",    "desc": "500,000 words written.",                   "cat": "words", "tier": 5, "metric": "total_words", "threshold": 500_000},
    {"key": "words_1m",   "name": "The Million Club",  "desc": "One million words. You are a legend.",     "cat": "words", "tier": 5, "metric": "total_words", "threshold": 1_000_000},

    # ── Best single day ───────────────────────────────────────────────────────
    {"key": "day_500",  "name": "Warm-Up",        "desc": "Write 500+ words in a single day.",    "cat": "words", "tier": 1, "metric": "best_day", "threshold": 500},
    {"key": "day_2k",   "name": "Big Day",         "desc": "Write 2,000+ words in a single day.", "cat": "words", "tier": 2, "metric": "best_day", "threshold": 2_000},
    {"key": "day_5k",   "name": "Marathon",        "desc": "Write 5,000+ words in a single day.", "cat": "words", "tier": 3, "metric": "best_day", "threshold": 5_000},
    {"key": "day_10k",  "name": "Ultramarathon",   "desc": "10,000 words in one day. Unstoppable.","cat": "words", "tier": 5, "metric": "best_day", "threshold": 10_000},

    # ── Codex entries ─────────────────────────────────────────────────────────
    {"key": "codex_1",    "name": "Ink Drop",        "desc": "Create your first codex entry.",              "cat": "codex", "tier": 1, "metric": "codex_entries", "threshold": 1},
    {"key": "codex_5",    "name": "Quill",            "desc": "5 codex entries.",                            "cat": "codex", "tier": 1, "metric": "codex_entries", "threshold": 5},
    {"key": "codex_15",   "name": "Scribe",           "desc": "15 codex entries.",                           "cat": "codex", "tier": 2, "metric": "codex_entries", "threshold": 15},
    {"key": "codex_30",   "name": "Chronicler",       "desc": "30 codex entries.",                           "cat": "codex", "tier": 2, "metric": "codex_entries", "threshold": 30},
    {"key": "codex_75",   "name": "Lore Keeper",      "desc": "75 codex entries.",                           "cat": "codex", "tier": 3, "metric": "codex_entries", "threshold": 75},
    {"key": "codex_150",  "name": "Grand Archivist",  "desc": "150 codex entries.",                          "cat": "codex", "tier": 3, "metric": "codex_entries", "threshold": 150},
    {"key": "codex_300",  "name": "World Architect",  "desc": "300 codex entries.",                          "cat": "codex", "tier": 4, "metric": "codex_entries", "threshold": 300},
    {"key": "codex_500",  "name": "Mythographer",     "desc": "500 codex entries.",                          "cat": "codex", "tier": 4, "metric": "codex_entries", "threshold": 500},
    {"key": "codex_750",  "name": "Omniscient",       "desc": "750 codex entries.",                          "cat": "codex", "tier": 5, "metric": "codex_entries", "threshold": 750},
    {"key": "codex_1k",   "name": "God of Worlds",    "desc": "1,000 codex entries — a living universe.",   "cat": "codex", "tier": 5, "metric": "codex_entries", "threshold": 1_000},

    # ── Codex relations ───────────────────────────────────────────────────────
    {"key": "rel_1",   "name": "First Link",           "desc": "Connect two codex entries.",                 "cat": "codex", "tier": 1, "metric": "codex_relations", "threshold": 1},
    {"key": "rel_10",  "name": "Web Weaver",           "desc": "10 relations between codex entries.",        "cat": "codex", "tier": 2, "metric": "codex_relations", "threshold": 10},
    {"key": "rel_25",  "name": "Networker",            "desc": "25 codex relations.",                        "cat": "codex", "tier": 3, "metric": "codex_relations", "threshold": 25},
    {"key": "rel_50",  "name": "Social Architect",     "desc": "50 codex relations.",                        "cat": "codex", "tier": 3, "metric": "codex_relations", "threshold": 50},
    {"key": "rel_100", "name": "Cosmic Nexus",         "desc": "100 codex relations — an intricate web.",    "cat": "codex", "tier": 4, "metric": "codex_relations", "threshold": 100},
    {"key": "rel_250", "name": "All Things Connected", "desc": "250 relations. Everything is linked.",       "cat": "codex", "tier": 5, "metric": "codex_relations", "threshold": 250},

    # ── Codex entries mentioned in actual prose ───────────────────────────────
    {"key": "mentioned_1",   "name": "Shadow",               "desc": "1 codex entry appears in your prose.",        "cat": "codex", "tier": 1, "metric": "codex_mentioned", "threshold": 1},
    {"key": "mentioned_10",  "name": "Presence",             "desc": "10 codex entries woven into your scenes.",    "cat": "codex", "tier": 2, "metric": "codex_mentioned", "threshold": 10},
    {"key": "mentioned_25",  "name": "Cast of Characters",   "desc": "25 entries present in your prose.",          "cat": "codex", "tier": 3, "metric": "codex_mentioned", "threshold": 25},
    {"key": "mentioned_50",  "name": "Living World",         "desc": "50 codex entries breathe in your text.",     "cat": "codex", "tier": 4, "metric": "codex_mentioned", "threshold": 50},
    {"key": "mentioned_100", "name": "Everyone Has a Role",  "desc": "100 entries appear across your scenes.",     "cat": "codex", "tier": 4, "metric": "codex_mentioned", "threshold": 100},
    {"key": "mentioned_200", "name": "Woven Into the Prose", "desc": "200 entries live and breathe in your world.","cat": "codex", "tier": 5, "metric": "codex_mentioned", "threshold": 200},

    # ── Projects ──────────────────────────────────────────────────────────────
    {"key": "project_1", "name": "Project Launcher",   "desc": "Create your first project.",               "cat": "story", "tier": 1, "metric": "projects", "threshold": 1},
    {"key": "project_3", "name": "Juggler",             "desc": "3 projects — you live in many worlds.",   "cat": "story", "tier": 2, "metric": "projects", "threshold": 3},
    {"key": "project_5", "name": "Multi-World Writer",  "desc": "5 projects created.",                     "cat": "story", "tier": 3, "metric": "projects", "threshold": 5},

    # ── Scenes ────────────────────────────────────────────────────────────────
    {"key": "scenes_10",  "name": "Scene Starter",  "desc": "Write 10 scenes.",                        "cat": "story", "tier": 1, "metric": "scene_count", "threshold": 10},
    {"key": "scenes_50",  "name": "Scene Writer",   "desc": "Write 50 scenes.",                        "cat": "story", "tier": 2, "metric": "scene_count", "threshold": 50},
    {"key": "scenes_100", "name": "Storyteller",    "desc": "Write 100 scenes.",                       "cat": "story", "tier": 3, "metric": "scene_count", "threshold": 100},
    {"key": "scenes_250", "name": "World Spinner",  "desc": "250 scenes — worlds within worlds.",      "cat": "story", "tier": 4, "metric": "scene_count", "threshold": 250},
    {"key": "scenes_500", "name": "Prolific Author","desc": "500 scenes. You are a machine.",           "cat": "story", "tier": 5, "metric": "scene_count", "threshold": 500},

    # ── Scene variety ─────────────────────────────────────────────────────────
    {"key": "scene_types_5", "name": "Five Colors", "desc": "Use all 5 scene types across your projects.", "cat": "story", "tier": 3, "metric": "scene_types_used", "threshold": 5},

    # ── Publishing ────────────────────────────────────────────────────────────
    {"key": "query_1",   "name": "In the Arena",    "desc": "Submit your first query letter.",              "cat": "publishing", "tier": 1, "metric": "queries_sent",    "threshold": 1},
    {"key": "query_10",  "name": "Thick Skin",       "desc": "10 queries sent.",                            "cat": "publishing", "tier": 2, "metric": "queries_sent",    "threshold": 10},
    {"key": "query_25",  "name": "Battle-Hardened",  "desc": "25 queries — rejection proof.",               "cat": "publishing", "tier": 3, "metric": "queries_sent",    "threshold": 25},
    {"key": "query_50",  "name": "The Grind",         "desc": "50 queries sent. Relentless.",               "cat": "publishing", "tier": 4, "metric": "queries_sent",    "threshold": 50},
    {"key": "partial",   "name": "Partial Victory",   "desc": "An agent requested a partial manuscript.",   "cat": "publishing", "tier": 3, "metric": "queries_partial", "threshold": 1},
    {"key": "full_req",  "name": "Full Send",          "desc": "An agent requested the full manuscript.",   "cat": "publishing", "tier": 4, "metric": "queries_full",    "threshold": 1},
    {"key": "offer",     "name": "The Call",           "desc": "You received an offer of representation.",  "cat": "publishing", "tier": 5, "metric": "queries_offer",   "threshold": 1},

    # ── Research ──────────────────────────────────────────────────────────────
    {"key": "research_1",  "name": "Curious Mind", "desc": "Save your first research item.",        "cat": "research", "tier": 1, "metric": "research_items", "threshold": 1},
    {"key": "research_10", "name": "Deep Dive",    "desc": "10 research items collected.",          "cat": "research", "tier": 2, "metric": "research_items", "threshold": 10},
    {"key": "research_25", "name": "Scholar",      "desc": "25 research items — you dig deep.",    "cat": "research", "tier": 3, "metric": "research_items", "threshold": 25},
    {"key": "research_50", "name": "Librarian",    "desc": "50 research items saved.",              "cat": "research", "tier": 4, "metric": "research_items", "threshold": 50},
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_streaks(dates: list[str]) -> tuple[int, int]:
    """Returns (current_streak, longest_streak) from a list of YYYY-MM-DD date strings."""
    if not dates:
        return 0, 0

    date_objects = sorted({date.fromisoformat(d) for d in dates})

    longest = 1
    cur = 1
    for i in range(1, len(date_objects)):
        if (date_objects[i] - date_objects[i - 1]).days == 1:
            cur += 1
            if cur > longest:
                longest = cur
        else:
            cur = 1

    today = date.today()
    current = 0
    check = today
    date_set = set(date_objects)
    while check in date_set:
        current += 1
        check -= timedelta(days=1)

    return current, longest


def _compute_metrics(db: Session) -> dict[str, int]:
    # Writing log aggregated globally (sum across all projects per day)
    log_rows = (
        db.query(WritingLog.date, func.sum(WritingLog.words_added).label("words"))
        .group_by(WritingLog.date)
        .all()
    )

    total_words = sum(r.words for r in log_rows)
    best_day = max((r.words for r in log_rows), default=0)
    active_dates = [r.date for r in log_rows if r.words > 0]
    current_streak, longest_streak = _compute_streaks(active_dates)

    codex_entries   = db.query(func.count(CodexEntry.id)).scalar() or 0
    codex_relations = db.query(func.count(CodexRelation.id)).scalar() or 0
    codex_mentioned = (
        db.query(func.count(distinct(MentionStat.codex_id)))
        .filter(MentionStat.count > 0)
        .scalar() or 0
    )

    projects      = db.query(func.count(Project.id)).scalar() or 0
    scene_count   = db.query(func.count(Scene.id)).scalar() or 0
    scene_types_used = (
        db.query(func.count(distinct(Scene.scene_type)))
        .filter(Scene.scene_type.isnot(None))
        .scalar() or 0
    )

    queries_sent    = db.query(func.count(QuerySubmission.id)).scalar() or 0
    queries_partial = (
        db.query(func.count(QuerySubmission.id))
        .filter(QuerySubmission.status == "partial_requested")
        .scalar() or 0
    )
    queries_full = (
        db.query(func.count(QuerySubmission.id))
        .filter(QuerySubmission.status == "full_requested")
        .scalar() or 0
    )
    queries_offer = (
        db.query(func.count(QuerySubmission.id))
        .filter(QuerySubmission.status == "offer")
        .scalar() or 0
    )

    research_items = db.query(func.count(ResearchItem.id)).scalar() or 0

    return {
        "current_streak":  current_streak,
        "longest_streak":  longest_streak,
        "total_words":     total_words,
        "best_day":        best_day,
        "codex_entries":   codex_entries,
        "codex_relations": codex_relations,
        "codex_mentioned": codex_mentioned,
        "projects":        projects,
        "scene_count":     scene_count,
        "scene_types_used": scene_types_used,
        "queries_sent":    queries_sent,
        "queries_partial": queries_partial,
        "queries_full":    queries_full,
        "queries_offer":   queries_offer,
        "research_items":  research_items,
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/achievements")
def get_achievements(db: Session = Depends(get_db)):
    metrics  = _compute_metrics(db)
    unlocks  = {u.key: u.unlocked_at for u in db.query(AchievementUnlock).all()}

    results      = []
    newly_earned = []
    now          = datetime.now(UTC).replace(tzinfo=None)

    for ach in ACHIEVEMENTS:
        val       = metrics.get(ach["metric"], 0)
        earned    = val >= ach["threshold"]

        if earned and ach["key"] not in unlocks:
            newly_earned.append(AchievementUnlock(key=ach["key"], unlocked_at=now))
            unlocks[ach["key"]] = now

        ts = unlocks.get(ach["key"])
        results.append({
            "key":          ach["key"],
            "name":         ach["name"],
            "description":  ach["desc"],
            "category":     ach["cat"],
            "tier":         ach["tier"],
            "metric":       ach["metric"],
            "threshold":    ach["threshold"],
            "earned":       earned,
            "unlocked_at":  ts.isoformat() if ts and earned else None,
            "progress":     min(val, ach["threshold"]),
            "progress_max": ach["threshold"],
        })

    if newly_earned:
        db.add_all(newly_earned)
        db.commit()

    return results

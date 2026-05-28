"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Flame, Trophy, PenLine, Braces,
  BookOpen, Layers, Send, Search, Star,
} from "lucide-react";
import { AchievementIcon } from "@/components/AchievementIcon";
import { useGlobalWritingLog, useProjects, useProjectGhostTexts, useAchievements } from "@/store/queries";
import type { WritingLogEntry, Achievement, AchievementCategory } from "@/types";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCurrentStreak(log: WritingLogEntry[]): number {
  const active = new Set(log.filter((e) => e.words > 0).map((e) => e.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split("T")[0];
    if (!active.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeLongestStreak(log: WritingLogEntry[]): number {
  const sorted = log
    .filter((e) => e.words > 0)
    .map((e) => e.date)
    .sort();
  if (!sorted.length) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

function intensity(words: number, max: number): string {
  if (!words) return "bg-muted/30";
  const pct = words / max;
  if (pct < 0.2)  return "bg-primary/20";
  if (pct < 0.4)  return "bg-primary/40";
  if (pct < 0.65) return "bg-primary/65";
  return "bg-primary";
}

// ── Full 52-week heatmap ──────────────────────────────────────────────────────

function FullHeatmap({ log }: { log: WritingLogEntry[] }) {
  const WEEKS = 52;
  const map = new Map(log.map((e) => [e.date, e.words]));
  const max = Math.max(...log.map((e) => e.words), 1);

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - WEEKS * 7 + 1);

  const cells: { date: string; words: number; dayOfWeek: number }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().split("T")[0];
    cells.push({ date: key, words: map.get(key) ?? 0, dayOfWeek: d.getDay() });
  }

  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      months.push({ label: d.toLocaleString("default", { month: "short" }), col: w + 1 });
      lastMonth = m;
    }
  }

  const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div className="overflow-x-auto">
      <div className="flex mb-1 ml-8">
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${WEEKS}, 12px)` }}>
          {months.map(({ label, col }) => (
            <span
              key={`${label}-${col}`}
              className="text-[10px] text-muted-foreground"
              style={{ gridColumn: col }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-px mr-1">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="text-[10px] text-muted-foreground w-6 h-3 flex items-center justify-end">
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `repeat(${WEEKS}, 12px)`, gridTemplateRows: "repeat(7, 12px)" }}
        >
          {Array.from({ length: WEEKS }, (_, w) =>
            Array.from({ length: 7 }, (_, d) => {
              const cell = cells[w * 7 + d];
              return (
                <div
                  key={`${w}-${d}`}
                  className={cn("w-3 h-3 rounded-[2px]", intensity(cell?.words ?? 0, max))}
                  title={cell ? `${cell.date}: ${cell.words.toLocaleString()} words` : ""}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Achievements ──────────────────────────────────────────────────────────────

const CATEGORIES: { key: AchievementCategory | "all"; label: string; icon: React.ReactNode }[] = [
  { key: "all",        label: "All",        icon: <Star className="h-3 w-3" /> },
  { key: "streaks",    label: "Streaks",    icon: <Flame className="h-3 w-3" /> },
  { key: "words",      label: "Words",      icon: <PenLine className="h-3 w-3" /> },
  { key: "codex",      label: "Codex",      icon: <BookOpen className="h-3 w-3" /> },
  { key: "story",      label: "Story",      icon: <Layers className="h-3 w-3" /> },
  { key: "publishing", label: "Publishing", icon: <Send className="h-3 w-3" /> },
  { key: "research",   label: "Research",   icon: <Search className="h-3 w-3" /> },
];

const TIER_STYLES: Record<number, string> = {
  1: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  2: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  3: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  4: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  5: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

const TIER_COLOR: Record<number, string> = {
  1: "text-zinc-400",
  2: "text-blue-400",
  3: "text-violet-400",
  4: "text-amber-400",
  5: "text-rose-400",
};

const TIER_GLOW: Record<number, string> = {
  1: "",
  2: "shadow-[0_0_12px_0_rgba(96,165,250,0.1)]",
  3: "shadow-[0_0_12px_0_rgba(167,139,250,0.15)]",
  4: "shadow-[0_0_14px_0_rgba(251,191,36,0.18)]",
  5: "shadow-[0_0_18px_0_rgba(251,113,133,0.22)]",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function AchievementCard({ ach }: { ach: Achievement }) {
  const pct = Math.min(100, Math.round((ach.progress / ach.progress_max) * 100));
  const tierStyle = TIER_STYLES[ach.tier] ?? TIER_STYLES[1];
  const tierColor = TIER_COLOR[ach.tier] ?? TIER_COLOR[1];
  const glow = ach.earned ? TIER_GLOW[ach.tier] : "";

  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4 flex flex-col gap-3 transition-all duration-200",
        ach.earned ? "border-border/80" : "border-border/40 opacity-55",
        glow,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <AchievementIcon
          achievementKey={ach.key}
          className={cn("w-9 h-9 shrink-0", tierColor, !ach.earned && "opacity-30")}
        />
        <span className={cn("shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border", tierStyle)}>
          T{ach.tier}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight mb-0.5">{ach.name}</p>
        <p className="text-xs text-muted-foreground leading-snug">{ach.description}</p>
      </div>

      {!ach.earned && (
        <div className="mt-auto space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {fmt(ach.progress)} / {fmt(ach.progress_max)}
            </span>
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {ach.earned && ach.unlocked_at && (
        <p className="text-[10px] text-muted-foreground/60 mt-auto">
          Earned {new Date(ach.unlocked_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

function AchievementsSection({ achievements }: { achievements: Achievement[] }) {
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | "all">("all");

  const filtered = useMemo(
    () => activeCategory === "all" ? achievements : achievements.filter((a) => a.category === activeCategory),
    [achievements, activeCategory],
  );

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Achievements</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {earnedCount} / {achievements.length}
        </span>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {CATEGORIES.map(({ key, label, icon }) => {
          const count = key === "all"
            ? achievements.filter((a) => a.earned).length
            : achievements.filter((a) => a.category === key && a.earned).length;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                activeCategory === key
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {icon}
              {label}
              <span className="text-[10px] opacity-60 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((ach) => (
          <AchievementCard key={ach.key} ach={ach} />
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { data: log = [] } = useGlobalWritingLog();
  const { data: projects = [] } = useProjects();
  const { data: achievements = [] } = useAchievements();

  const firstProject = projects[0];
  const { data: ghostScenes = [] } = useProjectGhostTexts(firstProject?.id ?? 0);

  const currentStreak = computeCurrentStreak(log);
  const longestStreak = computeLongestStreak(log);
  const totalWords    = log.reduce((s, e) => s + e.words, 0);

  const thisWeek = useMemo(() => {
    const d = new Date();
    const start = new Date(d);
    start.setDate(d.getDate() - 6);
    const startKey = start.toISOString().split("T")[0];
    return log.filter((e) => e.date >= startKey).reduce((s, e) => s + e.words, 0);
  }, [log]);

  const thisMonth = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return log.filter((e) => e.date.startsWith(prefix)).reduce((s, e) => s + e.words, 0);
  }, [log]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Writing Stats</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Flame,   label: "Current streak", value: `${currentStreak}d`, color: "text-orange-400" },
            { icon: Trophy,  label: "Longest streak",  value: `${longestStreak}d`, color: "text-yellow-400" },
            { icon: PenLine, label: "This week",        value: thisWeek.toLocaleString(), color: "text-primary" },
            { icon: PenLine, label: "This month",       value: thisMonth.toLocaleString(), color: "text-primary" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
              <Icon className={cn("h-4 w-4 mb-1", color)} />
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Activity — last 52 weeks</h2>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No writing activity recorded yet. Start writing to see your heatmap!</p>
          ) : (
            <div className="bg-card border border-border rounded-lg p-4">
              <FullHeatmap log={log} />
              <div className="flex items-center gap-1.5 mt-3 justify-end">
                <span className="text-[10px] text-muted-foreground">Less</span>
                {["bg-muted/30", "bg-primary/20", "bg-primary/40", "bg-primary/65", "bg-primary"].map((c) => (
                  <div key={c} className={cn("w-3 h-3 rounded-[2px]", c)} />
                ))}
                <span className="text-[10px] text-muted-foreground">More</span>
              </div>
            </div>
          )}
        </section>

        {/* Ghost text tracker */}
        {ghostScenes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Braces className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Pending placeholders — {firstProject?.title}</h2>
            </div>
            <div className="space-y-2">
              {ghostScenes.map((scene) => (
                <Link
                  key={scene.scene_id}
                  href={`/projects/${firstProject?.id}/scenes/${scene.scene_id}`}
                  className="block bg-card border border-border rounded-lg px-4 py-3 hover:border-amber-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium">{scene.scene_title}</p>
                    <span className="text-[10px] text-muted-foreground">{scene.act_title} › {scene.chapter_title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scene.ghost_texts.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 font-mono italic">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {achievements.length > 0 && <AchievementsSection achievements={achievements} />}

        <p className="text-xs text-muted-foreground text-center pb-4">
          {totalWords.toLocaleString()} words tracked in total
        </p>
      </main>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, PenLine, Braces } from "lucide-react";
import { useGlobalWritingLog, useProjects, useProjectGhostTexts } from "@/store/queries";
import type { WritingLogEntry } from "@/types";
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
  // Start from 52 weeks ago, aligned to Monday
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
      {/* Month labels */}
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
        {/* Day labels */}
        <div className="flex flex-col gap-px mr-1">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="text-[10px] text-muted-foreground w-6 h-3 flex items-center justify-end">
              {d}
            </span>
          ))}
        </div>

        {/* Grid: 52 cols × 7 rows */}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { data: log = [] } = useGlobalWritingLog();
  const { data: projects = [] } = useProjects();

  // Ghost texts for first project (or all) — fetch for first project as preview
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
    const prefix = new Date().toISOString().slice(0, 7); // YYYY-MM
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

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

        <p className="text-xs text-muted-foreground text-center pb-4">
          {totalWords.toLocaleString()} words tracked in total
        </p>
      </main>
    </div>
  );
}

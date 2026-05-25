"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useProjectAnalytics } from "@/store/queries";
import { Loader2, BarChart2, BookOpen, Zap, AlignLeft } from "lucide-react";
import type { SceneAnalytics, ChapterAnalytics } from "@/types";
import { cn } from "@/lib/utils";

// ── Scene type config ─────────────────────────────────────────────────────────

const SCENE_TYPE_COLOR: Record<string, string> = {
  action:        "#ef4444",  // red
  dialogue:      "#3b82f6",  // blue
  introspection: "#8b5cf6",  // violet
  description:   "#22c55e",  // green
  transition:    "#94a3b8",  // slate
};

const SCENE_TYPE_LABEL: Record<string, string> = {
  action:        "Action",
  dialogue:      "Dialogue",
  introspection: "Introspection",
  description:   "Description",
  transition:    "Transition",
};

// ── Readability grade helpers ─────────────────────────────────────────────────

function gradeLabel(score: number): string {
  if (score >= 90) return "Very Easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly Difficult";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}

function gradeColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-destructive";
}

// ── Bar chart (pure CSS) ──────────────────────────────────────────────────────

function BarChart({
  items, maxVal, height = 160, colorFn,
}: {
  items: { label: string; value: number; sublabel?: string; color?: string }[];
  maxVal: number;
  height?: number;
  colorFn?: (item: { label: string; value: number; sublabel?: string; color?: string }) => string;
}) {
  if (!items.length || maxVal === 0) return null;
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ height: height + 40 }}>
      {items.map((item, i) => {
        const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        const barH = Math.max(2, (pct / 100) * height);
        const color = item.color ?? colorFn?.(item) ?? "hsl(var(--primary))";
        return (
          <div key={i} className="flex flex-col items-center gap-1 group shrink-0" style={{ minWidth: 28 }}>
            <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.value.toLocaleString()}
            </span>
            <div
              className="rounded-t transition-all duration-200 group-hover:opacity-80 cursor-default"
              style={{ width: 24, height: barH, backgroundColor: color }}
              title={`${item.label}: ${item.value.toLocaleString()}`}
            />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-muted-foreground truncate" style={{ maxWidth: 40 }} title={item.label}>
                {item.label}
              </span>
              {item.sublabel && (
                <span className="text-[8px] text-muted-foreground/50 truncate" style={{ maxWidth: 40 }}>
                  {item.sublabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Line chart (SVG) ──────────────────────────────────────────────────────────

function LineChart({ values, color = "hsl(var(--primary))", height = 80 }: {
  values: number[]; color?: string; height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 800;
  const h = height;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 8)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (v / max) * (h - 8)}
          r="3"
          fill={color}
          vectorEffect="non-scaling-stroke"
        >
          <title>{v.toFixed(1)}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── Pacing rhythm strip ───────────────────────────────────────────────────────

function PacingStrip({ scenes }: { scenes: SceneAnalytics[] }) {
  const maxWc = Math.max(...scenes.map(s => s.word_count), 1);

  return (
    <div className="flex gap-px items-end overflow-x-auto rounded-md bg-secondary/30 p-2" style={{ height: 80 }}>
      {scenes.map(s => {
        const h = Math.max(4, (s.word_count / maxWc) * 64);
        const color = s.scene_type
          ? SCENE_TYPE_COLOR[s.scene_type] ?? "#94a3b8"
          : "hsl(var(--border))";
        return (
          <div
            key={s.scene_id}
            className="rounded-sm shrink-0 transition-opacity hover:opacity-70 cursor-default"
            style={{ width: 10, height: h, backgroundColor: color, alignSelf: "flex-end" }}
            title={`${s.scene_title ?? "Untitled"} · ${s.word_count} words${s.scene_type ? ` · ${SCENE_TYPE_LABEL[s.scene_type] ?? s.scene_type}` : ""}`}
          />
        );
      })}
    </div>
  );
}

// ── Stacked bar (scene type per chapter) ─────────────────────────────────────

function StackedTypeBar({ dist, total }: { dist: Record<string, number>; total: number }) {
  if (!total) return <span className="text-xs text-muted-foreground">—</span>;
  const types = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex h-3 rounded-full overflow-hidden w-full gap-px">
      {types.map(([type, count]) => (
        <div
          key={type}
          style={{ width: `${(count / total) * 100}%`, backgroundColor: SCENE_TYPE_COLOR[type] ?? "#94a3b8" }}
          title={`${SCENE_TYPE_LABEL[type] ?? type}: ${count}`}
          className="transition-all"
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { data, isLoading, error } = useProjectAnalytics(projectId);
  const [tab, setTab] = useState<"pacing" | "sentences" | "readability">("pacing");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Could not load analytics.
      </div>
    );
  }

  const { scenes, chapters, total_word_count, scene_type_dist } = data;
  const totalScenes   = scenes.length;
  const totalChapters = chapters.length;
  const avgWc         = totalScenes > 0 ? Math.round(total_word_count / totalScenes) : 0;
  const readingMins   = Math.round(total_word_count / 200);

  // Assign a stable color to each act for bar chart
  const actColors = [
    "hsl(var(--primary))", "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6",
  ];
  const actColorMap: Record<number, string> = {};
  chapters.forEach(ch => {
    if (!(ch.act_id in actColorMap)) {
      actColorMap[ch.act_id] = actColors[Object.keys(actColorMap).length % actColors.length];
    }
  });

  const chapterBarItems = chapters.map(ch => ({
    label: ch.chapter_title,
    sublabel: ch.act_title,
    value: ch.word_count,
    color: actColorMap[ch.act_id],
  }));
  const maxChapterWc = Math.max(...chapters.map(c => c.word_count), 1);

  const sentenceValues = scenes.map(s => s.avg_sentence_length);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <p className="text-xs text-muted-foreground">
            {totalScenes} scenes · {totalChapters} chapters · {total_word_count.toLocaleString()} words
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total words", value: total_word_count.toLocaleString(), icon: <AlignLeft className="h-4 w-4" /> },
            { label: "Avg words / scene", value: avgWc.toLocaleString(), icon: <BarChart2 className="h-4 w-4" /> },
            { label: "Est. reading time", value: `${readingMins} min`, icon: <BookOpen className="h-4 w-4" /> },
            { label: "Scenes", value: `${totalScenes}`, icon: <Zap className="h-4 w-4" /> },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
              <div className="text-muted-foreground">{card.icon}</div>
              <p className="text-xl font-semibold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── Pacing rhythm strip ── */}
        <section>
          <h2 className="text-sm font-medium mb-2">Pacing Rhythm</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Each block = one scene. Height = word count. Colour = scene type.
          </p>
          {scenes.length > 0 ? <PacingStrip scenes={scenes} /> : (
            <p className="text-sm text-muted-foreground">No scenes yet.</p>
          )}

          {/* Legend */}
          {Object.keys(scene_type_dist).length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {Object.entries(SCENE_TYPE_COLOR).map(([type, color]) => (
                scene_type_dist[type] ? (
                  <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    {SCENE_TYPE_LABEL[type]} ({scene_type_dist[type]})
                  </span>
                ) : null
              ))}
            </div>
          )}
        </section>

        {/* ── Word count per chapter ── */}
        <section>
          <h2 className="text-sm font-medium mb-2">Word Count per Chapter</h2>
          <p className="text-xs text-muted-foreground mb-3">Bars coloured by act.</p>
          {chapterBarItems.length > 0
            ? <BarChart items={chapterBarItems} maxVal={maxChapterWc} height={140} />
            : <p className="text-sm text-muted-foreground">No chapters yet.</p>
          }
        </section>

        {/* ── Tab panel: sentences / readability ── */}
        <section>
          <div className="flex gap-0 mb-4 border-b border-border">
            {(["pacing", "sentences", "readability"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors",
                  tab === t
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "pacing" ? "Scene Types" : t === "sentences" ? "Sentence Length" : "Readability"}
              </button>
            ))}
          </div>

          {/* Scene types per chapter */}
          {tab === "pacing" && (
            <div className="space-y-3">
              {chapters.map(ch => (
                <div key={ch.chapter_id} className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-32 truncate shrink-0" title={ch.chapter_title}>
                    {ch.chapter_title}
                  </span>
                  <div className="flex-1 min-w-0">
                    <StackedTypeBar
                      dist={ch.scene_type_dist}
                      total={Object.values(ch.scene_type_dist).reduce((a, b) => a + b, 0)}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                    {ch.scene_count} scene{ch.scene_count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
              {chapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters yet.</p>}
            </div>
          )}

          {/* Avg sentence length per scene */}
          {tab === "sentences" && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Average words per sentence across all scenes. Spikes = dense prose; dips = punchy action.
              </p>
              {sentenceValues.length >= 2
                ? <LineChart values={sentenceValues} color="hsl(var(--primary))" height={100} />
                : <p className="text-sm text-muted-foreground">Need at least 2 scenes with text.</p>
              }
              {sentenceValues.length >= 2 && (
                <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
                  <span>Min: <strong className="text-foreground">{Math.min(...sentenceValues).toFixed(1)}</strong></span>
                  <span>Max: <strong className="text-foreground">{Math.max(...sentenceValues).toFixed(1)}</strong></span>
                  <span>Avg: <strong className="text-foreground">{(sentenceValues.reduce((a,b)=>a+b,0)/sentenceValues.length).toFixed(1)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Readability table */}
          {tab === "readability" && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Chapter</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Act</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Words</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Flesch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Level</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {chapters.map(ch => (
                    <tr key={ch.chapter_id} className="bg-card hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium">{ch.chapter_title}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{ch.act_title}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{ch.word_count.toLocaleString()}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", gradeColor(ch.flesch_score))}>
                        {ch.flesch_score > 0 ? ch.flesch_score.toFixed(0) : "—"}
                      </td>
                      <td className={cn("px-3 py-2 text-xs", gradeColor(ch.flesch_score))}>
                        {ch.flesch_score > 0 ? gradeLabel(ch.flesch_score) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {ch.grade_level > 0 ? `${ch.grade_level}` : "—"}
                      </td>
                    </tr>
                  ))}
                  {chapters.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">No chapters yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeData {
  year:  number | null;
  month: number | null;
  day:   number | null;
  raw:   string;
  display: string;
  sort_key: [number, number, number];
}

interface TimelineEvent {
  time:          TimeData;
  event_name:    string;
  scene_id:      number;
  scene_title:   string;
  chapter_title: string;
}

interface TimelineData {
  events: TimelineEvent[];
}

const TRACK_H   = 80;   // px height per track row
const LABEL_W   = 160;  // px for left label column
const MIN_COL_W = 100;  // minimum px per time slot

/** Map each unique sort_key to a column index */
function buildColumns(events: TimelineEvent[]) {
  const keys = [...new Set(events.map(e => e.time.sort_key.join(",")))];
  const map: Record<string, number> = {};
  keys.forEach((k, i) => { map[k] = i; });
  return { map, count: keys.length };
}

export default function TimelinePage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();

  const { data, isLoading, error } = useQuery<TimelineData>({
    queryKey: ["timeline", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/timeline`).then(r => r.json()),
  });

  const [hovered, setHovered] = useState<TimelineEvent | null>(null);

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading timeline…</div>;
  if (error || !data) return <div className="flex items-center justify-center h-full text-destructive text-sm">Failed to load timeline</div>;

  if (!data.events.length) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
      <Calendar className="h-10 w-10 mb-3 opacity-30" />
      <p className="mb-2">No timeline events yet.</p>
      <p className="text-xs">
        Use <code className="bg-secondary px-1 rounded">{"{"}<wbr />time:day 6|Event Name{"}"}</code> tags in your scenes.
      </p>
    </div>
  );

  const { map: colMap, count: colCount } = buildColumns(data.events);
  const COL_W = Math.max(MIN_COL_W, 800 / colCount);
  const totalW = LABEL_W + colCount * COL_W;

  // Group events by unique time key
  const byKey: Record<string, TimelineEvent[]> = {};
  for (const ev of data.events) {
    const k = ev.time.sort_key.join(",");
    (byKey[k] = byKey[k] ?? []).push(ev);
  }
  const sortedKeys = Object.keys(byKey).sort((a, b) => {
    const [ay, am, ad] = a.split(",").map(Number);
    const [by, bm, bd] = b.split(",").map(Number);
    return ay - by || am - bm || ad - bd;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Timeline</h1>
          <p className="text-xs text-muted-foreground">{data.events.length} event{data.events.length !== 1 ? "s" : ""} · click any event to go to its scene</p>
        </div>
        {hovered && (
          <div className="text-xs text-muted-foreground">
            {hovered.chapter_title} → {hovered.scene_title}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: totalW }} className="relative">

          {/* ── Header row: time labels ── */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-border">
            <div style={{ width: LABEL_W }} className="shrink-0 px-3 py-2 text-xs text-muted-foreground font-medium border-r border-border">
              Event
            </div>
            {sortedKeys.map(k => {
              const sample = byKey[k][0];
              return (
                <div
                  key={k}
                  style={{ width: COL_W }}
                  className="shrink-0 px-2 py-2 text-xs text-center border-r border-border/50 text-muted-foreground"
                >
                  {sample.time.display || sample.time.raw}
                </div>
              );
            })}
          </div>

          {/* ── Axis line ── */}
          <div className="relative" style={{ height: 2, marginLeft: LABEL_W, background: "hsl(var(--border))" }} />

          {/* ── Event rows (one row per unique event name) ── */}
          {(() => {
            // Collect all unique event names preserving order
            const eventNames = [...new Set(data.events.map(e => e.event_name))];
            return eventNames.map((evName, rowIdx) => {
              const eventsForName = data.events.filter(e => e.event_name === evName);
              const rowColor = `hsl(${(rowIdx * 47 + 200) % 360} 60% 60%)`;

              return (
                <div
                  key={evName}
                  className="flex items-center border-b border-border/30 hover:bg-secondary/20"
                  style={{ height: TRACK_H }}
                >
                  {/* Label */}
                  <div
                    style={{ width: LABEL_W, borderRight: `2px solid ${rowColor}` }}
                    className="shrink-0 px-3 text-xs font-medium truncate text-right text-muted-foreground h-full flex items-center justify-end"
                  >
                    {evName}
                  </div>

                  {/* Cells */}
                  <div className="flex relative flex-1">
                    {sortedKeys.map(k => {
                      const evHere = eventsForName.filter(e => e.time.sort_key.join(",") === k);
                      return (
                        <div
                          key={k}
                          style={{ width: COL_W }}
                          className="shrink-0 flex items-center justify-center border-r border-border/20"
                        >
                          {evHere.map((ev, i) => (
                            <button
                              key={i}
                              onClick={() => router.push(`/projects/${projectId}/scenes/${ev.scene_id}`)}
                              onMouseEnter={() => setHovered(ev)}
                              onMouseLeave={() => setHovered(null)}
                              title={`${ev.chapter_title} → ${ev.scene_title}`}
                              className={cn(
                                "group flex flex-col items-center gap-0.5",
                                "rounded px-2 py-1 transition-colors",
                                "hover:bg-secondary"
                              )}
                            >
                              {/* Diamond marker */}
                              <div
                                style={{
                                  width: 12, height: 12,
                                  backgroundColor: rowColor,
                                  transform: "rotate(45deg)",
                                  borderRadius: 2,
                                }}
                              />
                              <span className="text-[10px] text-muted-foreground group-hover:text-foreground flex items-center gap-0.5">
                                {ev.scene_title.length > 10 ? ev.scene_title.slice(0, 9) + "…" : ev.scene_title}
                                <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-60" />
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground">
        Each row = one event name · each column = one point in time · parallel rows = concurrent storylines
      </div>
    </div>
  );
}

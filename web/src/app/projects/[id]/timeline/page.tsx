"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calendar, Moon, Sun, ExternalLink, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimeline, useTimeConfig, useUpdateTimeConfig } from "@/store/queries";
import { TimeConfigDialog } from "@/components/time/TimeConfigDialog";
import { DEFAULT_TIME_CONFIG } from "@/types";
import type { TimelineEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

const LABEL_W = 160;
const MIN_COL_W = 110;
const TRACK_H = 72;

function buildColumns(entries: TimelineEntry[]) {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const e of entries) {
    const k = e.sort_key.join(",");
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return keys;
}

export default function TimelinePage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();

  const { data: timelineData, isLoading, error } = useTimeline(projectId);
  const { data: configData } = useTimeConfig(projectId);
  const updateTimeConfig = useUpdateTimeConfig(projectId);

  const [configOpen, setConfigOpen] = useState(false);
  const [hovered, setHovered] = useState<TimelineEntry | null>(null);

  const timeConfig = configData ?? DEFAULT_TIME_CONFIG;

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Loading timeline…
    </div>
  );
  if (error || !timelineData) return (
    <div className="flex items-center justify-center h-full text-destructive text-sm">
      Failed to load timeline
    </div>
  );

  const { entries } = timelineData;

  if (!entries.length) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
      <Calendar className="h-10 w-10 mb-3 opacity-30" />
      <p className="mb-2 font-medium">No scenes have a time set yet.</p>
      <p className="text-xs max-w-xs">
        Open a scene and click the <strong>Time</strong> button in the toolbar to assign a point in time.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-4 gap-1.5"
        onClick={() => setConfigOpen(true)}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Configure time system
      </Button>
      <TimeConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        initial={timeConfig}
        onSave={(cfg) => updateTimeConfig.mutate(cfg)}
      />
    </div>
  );

  const sortedKeys = buildColumns(entries);
  const colCount = sortedKeys.length;
  const COL_W = Math.max(MIN_COL_W, 800 / colCount);
  const totalW = LABEL_W + colCount * COL_W;

  // Group entries by chapter + act for row labels
  // Each unique scene is a row; columns = time points
  // Rows are just ordered by their first appearance in story order
  const rowIds: number[] = [];
  const rowMap = new Map<number, TimelineEntry>(); // scene_id → first entry
  for (const e of entries) {
    if (!rowMap.has(e.scene_id)) {
      rowIds.push(e.scene_id);
      rowMap.set(e.scene_id, e);
    }
  }

  // Map each scene_id to its entry (there's only one entry per scene since scene_time is a single value)
  const byScene = new Map<number, TimelineEntry>();
  for (const e of entries) byScene.set(e.scene_id, e);

  const keySet = new Set(sortedKeys);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Timeline</h1>
          <p className="text-xs text-muted-foreground">
            {entries.length} scene{entries.length !== 1 ? "s" : ""} with time set
            · {colCount} time point{colCount !== 1 ? "s" : ""}
            · click any cell to go to its scene
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hovered && (
            <span className="text-xs text-muted-foreground">
              {hovered.act_title} → {hovered.chapter_title} → {hovered.scene_title}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Time config
          </Button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: totalW }} className="relative">

          {/* Sticky column header row */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-border">
            <div
              style={{ width: LABEL_W }}
              className="shrink-0 px-3 py-2 text-xs text-muted-foreground font-medium border-r border-border"
            >
              Scene
            </div>
            {sortedKeys.map((k) => {
              const sample = entries.find(e => e.sort_key.join(",") === k)!;
              return (
                <div
                  key={k}
                  style={{ width: COL_W }}
                  className="shrink-0 px-2 py-2 border-r border-border/40 text-center"
                >
                  <div className="text-xs text-muted-foreground truncate">{sample.time_display}</div>
                  {sample.day_night && (
                    <div className={cn(
                      "flex items-center justify-center gap-0.5 text-[10px] mt-0.5",
                      sample.day_night === "Night" ? "text-[hsl(262_80%_65%)]" : "text-[hsl(38_92%_55%)]"
                    )}>
                      {sample.day_night === "Night"
                        ? <Moon className="h-2.5 w-2.5" />
                        : <Sun className="h-2.5 w-2.5" />
                      }
                      {sample.day_night}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Axis */}
          <div style={{ height: 2, marginLeft: LABEL_W, background: "hsl(var(--border))" }} />

          {/* Scene rows */}
          {rowIds.map((sceneId, rowIdx) => {
            const entry = byScene.get(sceneId)!;
            const rowColor = `hsl(${(rowIdx * 53 + 180) % 360} 55% 60%)`;
            const key = entry.sort_key.join(",");

            return (
              <div
                key={sceneId}
                className="flex items-center border-b border-border/25 hover:bg-secondary/20"
                style={{ height: TRACK_H }}
              >
                {/* Row label */}
                <div
                  style={{ width: LABEL_W, borderRight: `2px solid ${rowColor}` }}
                  className="shrink-0 px-3 h-full flex flex-col justify-center items-end text-right gap-0.5"
                >
                  <span className="text-xs font-medium text-foreground truncate w-full text-right">
                    {entry.scene_title || `Scene ${sceneId}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-right">
                    {entry.chapter_title}
                  </span>
                </div>

                {/* Cells */}
                {sortedKeys.map((k) => {
                  const isHere = key === k;
                  return (
                    <div
                      key={k}
                      style={{ width: COL_W }}
                      className="shrink-0 flex items-center justify-center border-r border-border/15"
                    >
                      {isHere && (
                        <button
                          onClick={() => router.push(`/projects/${projectId}/scenes/${sceneId}`)}
                          onMouseEnter={() => setHovered(entry)}
                          onMouseLeave={() => setHovered(null)}
                          title={`${entry.act_title} → ${entry.chapter_title} → ${entry.scene_title}\n${entry.time_display}`}
                          className={cn(
                            "group flex flex-col items-center gap-1 rounded-md px-2 py-1.5",
                            "transition-colors hover:bg-secondary"
                          )}
                        >
                          <div
                            style={{
                              width: 14, height: 14,
                              backgroundColor: rowColor,
                              transform: "rotate(45deg)",
                              borderRadius: 3,
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground group-hover:text-foreground flex items-center gap-0.5 max-w-[80px]">
                            <span className="truncate">
                              {(entry.scene_title || "").length > 10
                                ? (entry.scene_title || "").slice(0, 9) + "…"
                                : (entry.scene_title || "Scene")}
                            </span>
                            <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-50 shrink-0" />
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
        <span>Each row = one scene · each column = one point in time</span>
        <span className="flex items-center gap-1">
          <Moon className="h-3 w-3 text-[hsl(262_80%_65%)]" /> Night
        </span>
        <span className="flex items-center gap-1">
          <Sun className="h-3 w-3 text-[hsl(38_92%_55%)]" /> Day
        </span>
      </div>

      <TimeConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        initial={timeConfig}
        onSave={(cfg) => updateTimeConfig.mutate(cfg)}
      />
    </div>
  );
}

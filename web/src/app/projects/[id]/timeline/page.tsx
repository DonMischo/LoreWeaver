"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calendar, Settings2, Plus, Pencil, Trash2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTimelineV2, useTimeConfig, useUpdateTimeConfig } from "@/store/queries";
import { TimeConfigDialog } from "@/components/time/TimeConfigDialog";
import { DEFAULT_TIME_CONFIG, type TimelineTrack, type TimelineEventItem, type SceneTime, type TimeUnit } from "@/types";
import { timelineTracksApi, timelineEventsApi, type TimelineNode } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEFT_MARGIN = 60;
const RIGHT_MARGIN = 40;
const NODE_W = 110;
const LANE_HEIGHT = 64;
const AXIS_OFFSET = 8;
const RULER_H = 36;

// ── Helper functions ──────────────────────────────────────────────────────────

function sortKeyToTick(sortKey: number[], units: TimeUnit[]): number {
  const enabled = units.filter(u => u.enabled);
  const n = enabled.length;
  if (n === 0 || sortKey.length === 0) return 0;
  const mults = new Array(n).fill(1);
  for (let i = n - 2; i >= 0; i--) {
    mults[i] = mults[i + 1] * (enabled[i + 1].count_per_parent ?? 1000);
  }
  return sortKey.reduce((s, v, i) => s + (i < n ? (v || 0) * mults[i] : 0), 0);
}

function assignLanes(nodes: { x: number; id: string }[], minGap: number): Map<string, number> {
  const sorted = [...nodes].sort((a, b) => a.x - b.x);
  const laneRightEdge: number[] = [];
  const result = new Map<string, number>();
  for (const node of sorted) {
    let lane = laneRightEdge.findIndex(r => node.x - r >= minGap);
    if (lane === -1) { lane = laneRightEdge.length; laneRightEdge.push(-Infinity); }
    laneRightEdge[lane] = node.x + NODE_W;
    result.set(node.id, lane);
  }
  return result;
}

function laneToY(lane: number, laneH: number): number {
  const level = Math.floor(lane / 2) + 1;
  const above = lane % 2 === 0;
  return above ? -(level * laneH + AXIS_OFFSET) : (level * laneH + AXIS_OFFSET);
}

function rulerTicks(
  startTick: number,
  endTick: number,
  units: TimeUnit[],
  trackWidthPx: number,
): { x: number; label: string }[] {
  const enabled = units.filter(u => u.enabled);
  const n = enabled.length;
  if (endTick <= startTick || trackWidthPx <= 0 || n === 0) return [];
  const mults = new Array(n).fill(1);
  for (let i = n - 2; i >= 0; i--) mults[i] = mults[i + 1] * (enabled[i + 1].count_per_parent ?? 1000);
  const targetInterval = (endTick - startTick) / 9;
  let chosenIdx = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (mults[i] <= targetInterval) { chosenIdx = i; break; }
  }
  const interval = mults[chosenIdx];
  const unit = enabled[chosenIdx];
  if (interval <= 0) return [];
  const ticks: { x: number; label: string }[] = [];
  const first = Math.ceil(startTick / interval) * interval;
  for (let t = first; t <= endTick; t += interval) {
    const x = ((t - startTick) / (endTick - startTick)) * trackWidthPx;
    const unitVal = Math.floor(t / interval);
    const label =
      unit.value_names && unit.value_names[unitVal - 1]
        ? unit.value_names[unitVal - 1]
        : `${unit.singular} ${unitVal}`;
    ticks.push({ x, label });
  }
  return ticks;
}

function sortKeyFromTimeData(td: SceneTime, units: TimeUnit[]): number[] {
  const enabled = units.filter(u => u.enabled);
  return enabled.map(u => td[u.id] ?? 0);
}

// ── TrackVisualization ────────────────────────────────────────────────────────

interface TrackVizProps {
  nodes: TimelineNode[];
  units: TimeUnit[];
  trackStartTime?: SceneTime | null;
  trackEndTime?: SceneTime | null;
  onSceneClick: (sceneId: number) => void;
  onEventClick: (node: TimelineNode) => void;
  minSpacing: number;
}

function TrackVisualization({
  nodes,
  units,
  trackStartTime,
  trackEndTime,
  onSceneClick,
  onEventClick,
  minSpacing,
}: TrackVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || 800);
    return () => ro.disconnect();
  }, []);

  const enabled = units.filter(u => u.enabled);

  const ticks = useMemo(
    () => nodes.map(n => sortKeyToTick(n.sort_key, units)),
    [nodes, units],
  );

  const { startTick, endTick } = useMemo(() => {
    let st =
      trackStartTime && Object.keys(trackStartTime).length > 0
        ? sortKeyToTick(sortKeyFromTimeData(trackStartTime, units), units)
        : undefined;
    let et =
      trackEndTime && Object.keys(trackEndTime).length > 0
        ? sortKeyToTick(sortKeyFromTimeData(trackEndTime, units), units)
        : undefined;

    if (ticks.length === 0) {
      return { startTick: st ?? 0, endTick: et ?? 100 };
    }
    const minT = Math.min(...ticks);
    const maxT = Math.max(...ticks);
    const pad = Math.max(1, (maxT - minT) * 0.05);
    return {
      startTick: st ?? minT - pad,
      endTick: et ?? maxT + pad,
    };
  }, [ticks, trackStartTime, trackEndTime, units]);

  const trackW = width - LEFT_MARGIN - RIGHT_MARGIN;

  const nodeXs = useMemo(() => {
    const range = endTick - startTick || 1;
    return nodes.map((_, i) => {
      const t = ticks[i];
      return LEFT_MARGIN + ((t - startTick) / range) * trackW;
    });
  }, [nodes, ticks, startTick, endTick, trackW]);

  const lanes = useMemo(
    () => assignLanes(nodes.map((n, i) => ({ id: n.id, x: nodeXs[i] })), minSpacing),
    [nodes, nodeXs, minSpacing],
  );

  const laneValues = Array.from(lanes.values());
  const maxLane = laneValues.length > 0 ? Math.max(0, ...laneValues) : 0;
  const lanesAbove = Math.floor(maxLane / 2) + 1;
  const lanesBelow = Math.ceil((maxLane + 1) / 2);
  const axisY = lanesAbove * LANE_HEIGHT + 16;
  const vizH = (lanesAbove + lanesBelow) * LANE_HEIGHT + RULER_H + 48;

  const tRuler = useMemo(
    () => rulerTicks(startTick, endTick, units, trackW),
    [startTick, endTick, units, trackW],
  );

  if (nodes.length === 0) {
    return (
      <div className="px-4 py-6 text-xs text-muted-foreground text-center">
        No nodes in this track yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div style={{ position: "relative", height: vizH, minWidth: 300 }}>
        {/* Axis line */}
        <div
          style={{
            position: "absolute",
            left: LEFT_MARGIN,
            right: RIGHT_MARGIN,
            top: axisY,
            height: 2,
            background: "hsl(var(--border))",
          }}
        />

        {/* Ruler ticks */}
        {tRuler.map((tick, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: LEFT_MARGIN + tick.x,
              top: axisY + 6,
              transform: "translateX(-50%)",
            }}
          >
            <div style={{ width: 1, height: 6, background: "hsl(var(--border))", margin: "0 auto" }} />
            <span
              style={{
                fontSize: 10,
                color: "hsl(var(--muted-foreground))",
                whiteSpace: "nowrap",
                display: "block",
                textAlign: "center",
              }}
            >
              {tick.label}
            </span>
          </div>
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const x = nodeXs[i];
          const lane = lanes.get(node.id) ?? 0;
          const yOffset = laneToY(lane, LANE_HEIGHT);
          const cardTop = axisY + yOffset;
          const connTop = yOffset < 0 ? cardTop + 32 : axisY;
          const connHeight = Math.abs(yOffset) - AXIS_OFFSET;
          const isScene = node.type === "scene";
          const dotColor = isScene
            ? `hsl(${((node.scene_id ?? 0) * 53 + 180) % 360} 55% 60%)`
            : (node.color ?? "#6b7280");

          return (
            <div key={node.id}>
              {/* Connector line */}
              <div
                style={{
                  position: "absolute",
                  left: x - 0.5,
                  top: connTop,
                  width: 1,
                  height: connHeight,
                  background: "hsl(var(--border))",
                  opacity: 0.6,
                }}
              />
              {/* Dot on axis */}
              <div
                style={{
                  position: "absolute",
                  left: x - 4,
                  top: axisY - 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dotColor,
                  zIndex: 2,
                }}
              />
              {/* Card */}
              <button
                onClick={() => {
                  if (isScene && node.scene_id) onSceneClick(node.scene_id);
                  else onEventClick(node);
                }}
                style={{
                  position: "absolute",
                  left: x,
                  top: cardTop - (yOffset < 0 ? 32 : 0),
                  transform: "translateX(-50%)",
                  width: NODE_W,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                className={cn(
                  "rounded-md border border-border/60 bg-card px-2 py-1.5 hover:bg-secondary/60 transition-colors",
                  "shadow-sm",
                )}
                title={node.title}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }}
                  />
                  <span className="text-xs font-medium truncate" style={{ maxWidth: 84 }}>
                    {node.title.length > 13 ? node.title.slice(0, 12) + "…" : node.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {node.day_night === "Night" ? (
                    <Moon className="h-2.5 w-2.5 shrink-0 text-[hsl(262_80%_65%)]" />
                  ) : node.day_night === "Day" ? (
                    <Sun className="h-2.5 w-2.5 shrink-0 text-[hsl(38_92%_55%)]" />
                  ) : null}
                  <span className="truncate">{node.time_display}</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TrackDialog ───────────────────────────────────────────────────────────────

interface TrackDialogProps {
  open: boolean;
  initial: Partial<TimelineTrack> | null;
  onClose: () => void;
  onSave: (data: Partial<TimelineTrack>) => void;
}

function TrackDialog({ open, initial, onClose, onSave }: TrackDialogProps) {
  const [name, setName] = useState("Timeline");
  const [color, setColor] = useState("#6b7280");
  const [trackType, setTrackType] = useState("parallel");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "Timeline");
      setColor(initial?.color ?? "#6b7280");
      setTrackType(initial?.track_type ?? "parallel");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Track" : "New Track"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Type</Label>
              <select
                value={trackType}
                onChange={e => setTrackType(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="parallel">Parallel</option>
                <option value="alternate">Alternate</option>
                <option value="past">Past</option>
                <option value="future">Future</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-8 w-14 rounded-md border border-input bg-background cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => { onSave({ name, color, track_type: trackType }); onClose(); }}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── EventDialog ───────────────────────────────────────────────────────────────

interface EventDialogProps {
  open: boolean;
  initial: Partial<TimelineEventItem> | null;
  tracks: TimelineTrack[];
  units: TimeUnit[];
  defaultTrackId?: number | null;
  onClose: () => void;
  onSave: (data: Partial<TimelineEventItem>) => void;
}

function EventDialog({ open, initial, tracks, units, defaultTrackId, onClose, onSave }: EventDialogProps) {
  const [title, setTitle] = useState("Untitled Event");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [trackId, setTrackId] = useState<number | null>(null);
  const [timeVals, setTimeVals] = useState<SceneTime>({});

  const enabledUnits = units.filter(u => u.enabled);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "Untitled Event");
      setDescription(initial?.description ?? "");
      setColor(initial?.color ?? "#6b7280");
      setTrackId(initial?.track_id ?? defaultTrackId ?? null);
      setTimeVals(initial?.scene_time ?? {});
    }
  }, [open, initial, defaultTrackId]);

  const setVal = (unitId: string, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    setTimeVals(prev => {
      const next = { ...prev };
      if (n == null || isNaN(n)) delete next[unitId];
      else next[unitId] = n;
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex gap-3">
            {tracks.length > 0 && (
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Track</Label>
                <select
                  value={trackId ?? ""}
                  onChange={e => setTrackId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— none —</option>
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-8 w-14 rounded-md border border-input bg-background cursor-pointer"
              />
            </div>
          </div>
          {enabledUnits.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <div className="grid grid-cols-2 gap-2">
                {enabledUnits.map(unit => {
                  const hasNames = unit.value_names.length > 0;
                  const maxVal = unit.count_per_parent ?? undefined;
                  return (
                    <div key={unit.id} className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">{unit.singular}</span>
                      {hasNames && unit.value_names.length <= 60 ? (
                        <select
                          value={timeVals[unit.id] ?? ""}
                          onChange={e => setVal(unit.id, e.target.value)}
                          className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">—</option>
                          {unit.value_names.map((name, i) => (
                            <option key={i} value={i + 1}>{name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={maxVal}
                          value={timeVals[unit.id] ?? ""}
                          placeholder="—"
                          onChange={e => setVal(unit.id, e.target.value)}
                          className="h-7 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => {
              const sceneTime = Object.keys(timeVals).length > 0 ? timeVals : null;
              onSave({ title, description: description || null, color, track_id: trackId, scene_time: sceneTime });
              onClose();
            }}
            disabled={!title.trim()}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useTimelineV2(projectId);
  const { data: configData } = useTimeConfig(projectId);
  const updateTimeConfig = useUpdateTimeConfig(projectId);

  const [configOpen, setConfigOpen] = useState(false);
  const [spacing, setSpacing] = useState(90);
  const [filter, setFilter] = useState<"all" | "main" | "subplot">("all");
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<TimelineTrack | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventItem | null>(null);
  const [newEventTrackId, setNewEventTrackId] = useState<number | null>(null);

  const timeConfig = configData ?? DEFAULT_TIME_CONFIG;
  const units = data?.config.units ?? timeConfig.units;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["timeline-v2", projectId] });
    qc.invalidateQueries({ queryKey: ["timeline-tracks", projectId] });
    qc.invalidateQueries({ queryKey: ["timeline-events", projectId] });
  };

  const filteredStoryNodes = useMemo(() => {
    if (!data) return [];
    const nodes = data.story_nodes;
    if (filter === "main") return nodes.filter(n => !n.subplot);
    if (filter === "subplot") return nodes.filter(n => !!n.subplot);
    return nodes;
  }, [data, filter]);

  // ── Track CRUD ──────────────────────────────────────────────────────────────

  const handleSaveTrack = async (body: Partial<TimelineTrack>) => {
    if (editingTrack?.id) {
      await timelineTracksApi.update(projectId, editingTrack.id, body);
    } else {
      const nextOrder = (data?.tracks.length ?? 0);
      await timelineTracksApi.create(projectId, { ...body, order_index: nextOrder });
    }
    invalidate();
    setEditingTrack(null);
  };

  const handleDeleteTrack = async (trackId: number) => {
    if (!confirm("Delete this track and all its events?")) return;
    await timelineTracksApi.delete(projectId, trackId);
    invalidate();
  };

  // ── Event CRUD ──────────────────────────────────────────────────────────────

  const handleSaveEvent = async (body: Partial<TimelineEventItem>) => {
    if (editingEvent?.id) {
      await timelineEventsApi.update(projectId, editingEvent.id, body);
    } else {
      await timelineEventsApi.create(projectId, { ...body, track_id: newEventTrackId });
    }
    invalidate();
    setEditingEvent(null);
    setNewEventTrackId(null);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm("Delete this event?")) return;
    await timelineEventsApi.delete(projectId, eventId);
    invalidate();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading timeline…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-sm">
        Failed to load timeline
      </div>
    );
  }

  const { tracks, event_nodes } = data;

  const eventNodeForEdit = (node: TimelineNode): TimelineEventItem => ({
    id: node.event_id!,
    project_id: projectId,
    track_id: node.track_id ?? null,
    title: node.title,
    description: node.description ?? null,
    scene_time: node.sort_key.length > 0 ? Object.fromEntries(
      units.filter(u => u.enabled).map((u, i) => [u.id, node.sort_key[i]] as [string, number])
    ) : null,
    color: node.color ?? "#6b7280",
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold">Timeline</h1>
          <p className="text-xs text-muted-foreground">
            {data.story_nodes.length} scene{data.story_nodes.length !== 1 ? "s" : ""} with time · {tracks.length} track{tracks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Spacing
            <input
              type="range"
              min={40}
              max={200}
              value={spacing}
              onChange={e => setSpacing(Number(e.target.value))}
              className="w-20 accent-primary"
            />
          </label>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Time config
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {/* Story track */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/20">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Story</span>
              <span className="text-xs text-muted-foreground">· {filteredStoryNodes.length} scenes</span>
            </div>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as "all" | "main" | "subplot")}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All</option>
              <option value="main">Main plot</option>
              <option value="subplot">Subplot</option>
            </select>
          </div>
          {filteredStoryNodes.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-xs">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No scenes have a time set yet.</p>
              <p className="mt-1">Open a scene and use the Time button in the toolbar.</p>
            </div>
          ) : (
            <TrackVisualization
              nodes={filteredStoryNodes}
              units={units}
              onSceneClick={sceneId => router.push(`/projects/${projectId}/scenes/${sceneId}`)}
              onEventClick={() => {}}
              minSpacing={spacing}
            />
          )}
        </div>

        {/* User tracks */}
        {tracks.map(track => {
          const trackEvents = event_nodes.filter(n => n.track_id === track.id);
          return (
            <div key={track.id} className="border-b border-border">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span
                    style={{ width: 10, height: 10, borderRadius: "50%", background: track.color, flexShrink: 0 }}
                  />
                  <span className="text-sm font-medium">{track.name}</span>
                  <span className="text-xs text-muted-foreground capitalize opacity-70">{track.track_type}</span>
                  <span className="text-xs text-muted-foreground">· {trackEvents.length} events</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => {
                      setNewEventTrackId(track.id);
                      setEditingEvent(null);
                      setEventDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Event
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setEditingTrack(track);
                      setTrackDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteTrack(track.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <TrackVisualization
                nodes={trackEvents}
                units={units}
                trackStartTime={track.start_time}
                trackEndTime={track.end_time}
                onSceneClick={() => {}}
                onEventClick={node => {
                  setEditingEvent(eventNodeForEdit(node));
                  setNewEventTrackId(null);
                  setEventDialogOpen(true);
                }}
                minSpacing={spacing}
              />
            </div>
          );
        })}

        {/* Add Track button */}
        <div className="px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => {
              setEditingTrack(null);
              setTrackDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Track
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <TrackDialog
        open={trackDialogOpen}
        initial={editingTrack}
        onClose={() => { setTrackDialogOpen(false); setEditingTrack(null); }}
        onSave={handleSaveTrack}
      />

      <EventDialog
        open={eventDialogOpen}
        initial={editingEvent}
        tracks={tracks}
        units={units}
        defaultTrackId={newEventTrackId}
        onClose={() => { setEventDialogOpen(false); setEditingEvent(null); setNewEventTrackId(null); }}
        onSave={handleSaveEvent}
      />

      {eventDialogOpen && editingEvent?.id && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              handleDeleteEvent(editingEvent.id);
              setEventDialogOpen(false);
              setEditingEvent(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete event
          </Button>
        </div>
      )}

      <TimeConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        initial={timeConfig}
        onSave={cfg => { updateTimeConfig.mutate(cfg); invalidate(); }}
      />
    </div>
  );
}

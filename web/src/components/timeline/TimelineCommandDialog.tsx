"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimelineTracks } from "@/store/queries";
import { timelineTracksApi, timelineEventsApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { TimeConfig, SceneTime, TimeUnit } from "@/types";

// Module-level so React doesn't see a new component type on every render.
function TimeInputGrid({ units, vals, onChange }: {
  units: TimeUnit[];
  vals: SceneTime;
  onChange: (unitId: string, raw: string) => void;
}) {
  if (units.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {units.map(unit => (
        <div key={unit.id} className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">{unit.singular}</span>
          <Input
            type="text"
            inputMode="numeric"
            value={vals[unit.id] ?? ""}
            placeholder="—"
            onChange={e => onChange(unit.id, e.target.value.replace(/[^0-9]/g, ""))}
            className="h-7 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  sceneTitle?: string;
  timeConfig: TimeConfig;
}

export function TimelineCommandDialog({ open, onClose, projectId, sceneTitle, timeConfig }: Props) {
  const { data: tracks = [] } = useTimelineTracks(projectId);
  const qc = useQueryClient();

  const [selectedTrackId, setSelectedTrackId] = useState<number | "new">("new");
  const [newTrackName, setNewTrackName] = useState("");
  const [timeVals, setTimeVals] = useState<SceneTime>({});
  const [customStart, setCustomStart] = useState<SceneTime>({});
  const [customEnd, setCustomEnd] = useState<SceneTime>({});
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [saving, setSaving] = useState(false);

  const enabledUnits = timeConfig.units.filter(u => u.enabled);

  useEffect(() => {
    if (!open) return;
    setSelectedTrackId(tracks.length > 0 ? tracks[0].id : "new");
    setNewTrackName("");
    setTimeVals({});
    setCustomStart({});
    setCustomEnd({});
    setShowCustomRange(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyVal = (
    setter: React.Dispatch<React.SetStateAction<SceneTime>>,
    unitId: string,
    raw: string,
  ) => {
    const n = raw === "" ? undefined : Number(raw);
    setter(prev => {
      const next = { ...prev };
      if (n == null || isNaN(n)) delete next[unitId];
      else next[unitId] = n;
      return next;
    });
  };

  // Auto-range: top-level unit ± 3
  const buildAutoRange = (): { start: SceneTime; end: SceneTime } => {
    const topUnit = enabledUnits[0];
    if (!topUnit || Object.keys(timeVals).length === 0) return { start: {}, end: {} };
    const topVal = timeVals[topUnit.id] ?? 1;
    return {
      start: { ...timeVals, [topUnit.id]: topVal - 3 },
      end:   { ...timeVals, [topUnit.id]: topVal + 3 },
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let trackId: number | null = null;

      if (selectedTrackId === "new") {
        const name = newTrackName.trim() || "New Timeline";
        const { start, end } = showCustomRange
          ? {
              start: Object.keys(customStart).length > 0 ? customStart : undefined,
              end:   Object.keys(customEnd).length > 0   ? customEnd   : undefined,
            }
          : buildAutoRange();
        const track = await timelineTracksApi.create(projectId, {
          name,
          color: "#6b7280",
          track_type: "parallel",
          order_index: tracks.length,
          start_time: start ?? null,
          end_time:   end   ?? null,
        });
        trackId = track.id;
      } else {
        trackId = selectedTrackId as number;
      }

      await timelineEventsApi.create(projectId, {
        track_id:   trackId,
        title:      sceneTitle || "Event",
        scene_time: Object.keys(timeVals).length > 0 ? timeVals : null,
      });

      qc.invalidateQueries({ queryKey: ["timeline-v2", projectId] });
      qc.invalidateQueries({ queryKey: ["timeline-tracks", projectId] });
      qc.invalidateQueries({ queryKey: ["timeline-events", projectId] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to Timeline</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">

          {/* Track selector */}
          <div className="space-y-1">
            <Label className="text-xs">Track</Label>
            <select
              value={selectedTrackId}
              onChange={e => setSelectedTrackId(e.target.value === "new" ? "new" : Number(e.target.value))}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="new">+ New track…</option>
            </select>
          </div>

          {/* New track name */}
          {selectedTrackId === "new" && (
            <div className="space-y-1">
              <Label className="text-xs">Track name</Label>
              <Input
                value={newTrackName}
                onChange={e => setNewTrackName(e.target.value)}
                placeholder="e.g. Parallel world"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Event time */}
          {enabledUnits.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Event time</Label>
              <TimeInputGrid
                units={enabledUnits}
                vals={timeVals}
                onChange={(id, raw) => applyVal(setTimeVals, id, raw)}
              />
            </div>
          )}

          {/* New track range */}
          {selectedTrackId === "new" && (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setShowCustomRange(v => !v)}
              >
                <span>{showCustomRange ? "▾" : "▸"}</span>
                Track time range
                {!showCustomRange && <span className="opacity-50">(auto ±3 {enabledUnits[0]?.plural ?? "years"})</span>}
              </button>
              {showCustomRange && (
                <div className="space-y-2 pl-3 border-l border-border">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <TimeInputGrid
                      units={enabledUnits}
                      vals={customStart}
                      onChange={(id, raw) => applyVal(setCustomStart, id, raw)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <TimeInputGrid
                      units={enabledUnits}
                      vals={customEnd}
                      onChange={(id, raw) => applyVal(setCustomEnd, id, raw)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Adding…" : "Add to timeline"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

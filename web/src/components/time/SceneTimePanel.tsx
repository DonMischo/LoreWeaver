"use client";

import { useState, useEffect } from "react";
import { X, Moon, Sun, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TimeConfig, SceneTime } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  config: TimeConfig;
  sceneTime: SceneTime | null;
  onChange: (time: SceneTime | null) => void;
  onClose: () => void;
  onOpenConfig: () => void;
}

function formatTimeDisplay(config: TimeConfig, time: SceneTime): string {
  const enabled = config.units.filter(u => u.enabled);
  const parts: string[] = [];
  for (const unit of enabled) {
    const val = time[unit.id];
    if (val == null) continue;
    if (unit.value_names.length > 0) {
      const idx = val - 1; // value_names are 1-indexed in display
      const name = unit.value_names[idx] ?? String(val);
      parts.push(name);
    } else {
      parts.push(`${val} ${val === 1 ? unit.singular : unit.plural}`);
    }
  }
  return parts.join(", ") || "—";
}

function getDayNight(config: TimeConfig, time: SceneTime): "Day" | "Night" | null {
  const hourUnit = config.units.find(u => u.id === "hour" && u.enabled);
  if (!hourUnit) return null;
  const hour = time["hour"];
  if (hour == null) return null;
  const dn = config.day_night;
  const nightEnd = (dn.night_start_hour + dn.night_duration) % dn.hours_per_day;
  let isNight: boolean;
  if (dn.night_duration <= 0) {
    isNight = false;
  } else if (nightEnd > dn.night_start_hour) {
    isNight = hour >= dn.night_start_hour && hour < nightEnd;
  } else {
    // wraps midnight
    isNight = hour >= dn.night_start_hour || hour < nightEnd;
  }
  return isNight ? "Night" : "Day";
}

export function SceneTimePanel({ config, sceneTime, onChange, onClose, onOpenConfig }: Props) {
  const enabledUnits = config.units.filter(u => u.enabled);

  // Local draft state
  const [draft, setDraft] = useState<SceneTime>(() => sceneTime ?? {});

  useEffect(() => {
    setDraft(sceneTime ?? {});
  }, [sceneTime]);

  const setVal = (unitId: string, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    setDraft(prev => {
      const next = { ...prev };
      if (n == null || isNaN(n)) {
        delete next[unitId];
      } else {
        next[unitId] = n;
      }
      return next;
    });
  };

  const hasValues = Object.keys(draft).length > 0;
  const display = hasValues ? formatTimeDisplay(config, draft) : null;
  const dayNight = hasValues ? getDayNight(config, draft) : null;

  const handleSave = () => {
    onChange(hasValues ? draft : null);
    onClose();
  };

  const handleClear = () => {
    setDraft({});
    onChange(null);
    onClose();
  };

  return (
    <div className="flex flex-col w-72 border-l border-border bg-card h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Scene Time</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Display preview */}
        {display && (
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
            dayNight === "Night"
              ? "bg-[hsl(262_80%_65%/0.15)] text-[hsl(262_80%_75%)]"
              : "bg-[hsl(38_92%_65%/0.15)] text-[hsl(38_92%_55%)]"
          )}>
            {dayNight === "Night"
              ? <Moon className="h-3.5 w-3.5 shrink-0" />
              : dayNight === "Day"
                ? <Sun className="h-3.5 w-3.5 shrink-0" />
                : <Clock className="h-3.5 w-3.5 shrink-0" />
            }
            <span className="truncate">{display}</span>
            {dayNight && <span className="ml-auto shrink-0 opacity-70">{dayNight}</span>}
          </div>
        )}

        {/* Unit inputs */}
        {enabledUnits.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No time units enabled. Configure time system first.
          </p>
        ) : (
          <div className="space-y-2">
            {enabledUnits.map((unit) => {
              const val = draft[unit.id];
              const hasNames = unit.value_names.length > 0;
              const label = hasNames
                ? `${unit.singular} (${unit.value_names.join(", ").slice(0, 30)}${unit.value_names.join(", ").length > 30 ? "…" : ""})`
                : unit.singular;
              const maxVal = unit.count_per_parent ?? undefined;

              return (
                <div key={unit.id} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  {hasNames && unit.value_names.length <= 60 ? (
                    /* Dropdown for named values */
                    <select
                      value={val ?? ""}
                      onChange={e => setVal(unit.id, e.target.value)}
                      className={cn(
                        "w-full h-7 rounded-md border border-input bg-background px-2 text-xs",
                        "focus:outline-none focus:ring-1 focus:ring-ring"
                      )}
                    >
                      <option value="">— unset —</option>
                      {unit.value_names.map((name, i) => (
                        <option key={i} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={maxVal}
                        value={val ?? ""}
                        placeholder="unset"
                        onChange={e => setVal(unit.id, e.target.value)}
                        className="h-7 text-xs"
                      />
                      {maxVal && (
                        <span className="text-xs text-muted-foreground shrink-0">/ {maxVal}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Config link */}
        <button
          onClick={onOpenConfig}
          className="text-xs text-muted-foreground hover:text-primary w-full text-left pt-1"
        >
          ⚙ Configure time system…
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border shrink-0">
        {sceneTime && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive mr-auto"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Apply</Button>
        </div>
      </div>
    </div>
  );
}

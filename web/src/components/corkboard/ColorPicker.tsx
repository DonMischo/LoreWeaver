"use client";

import { useState, useRef } from "react";

// ── Shared helpers ────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 8 scene-card presets (first = "clear / neutral")
export const SCENE_PRESETS = [
  null,        // clear — back to default
  "#ef4444",   // red
  "#f97316",   // orange
  "#eab308",   // yellow
  "#22c55e",   // green
  "#3b82f6",   // blue
  "#8b5cf6",   // purple
  "#ec4899",   // pink
] as const;

// Default colors for columns (main + up to 6 subplots)
export const MAIN_COLOR   = "#64748b"; // slate
export const SUBPLOT_PALETTE = [
  "#3b82f6", "#8b5cf6", "#22c55e",
  "#f59e0b", "#ec4899", "#06b6d4",
];

// ── ColorPicker component ─────────────────────────────────────────────────────

interface Props {
  /** Current hex color, or null for "no color" */
  color: string | null;
  onChange: (hex: string | null) => void;
  /** Show a larger trigger dot (for column headers) */
  large?: boolean;
  /** Position the popover to the left of the trigger */
  alignLeft?: boolean;
}

export function ColorPicker({ color, onChange, large = false, alignLeft = false }: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dotSize   = large ? "h-4 w-4" : "h-3 w-3";
  const popoverX  = alignLeft ? "left-0" : "right-0";

  const triggerStyle = color
    ? { backgroundColor: color }
    : { backgroundColor: "transparent", border: "1.5px dashed #71717a" };

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${dotSize} rounded-full transition-transform hover:scale-110`}
        style={triggerStyle}
        title="Color"
      />

      {open && (
        <div
          className={`absolute ${popoverX} top-5 z-50 bg-popover border border-border rounded-xl shadow-xl p-2.5 w-[148px]`}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Preset swatches */}
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {SCENE_PRESETS.map((hex, i) => (
              <button
                key={i}
                onClick={() => { onChange(hex); setOpen(false); }}
                className="h-5 w-5 rounded-full ring-1 ring-border hover:scale-110 transition-transform"
                style={
                  hex
                    ? { backgroundColor: hex }
                    : { backgroundColor: "transparent", border: "1.5px dashed #71717a" }
                }
                title={hex ?? "Clear"}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="color"
              value={color ?? "#94a3b8"}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-none bg-transparent flex-shrink-0"
              title="Custom color"
            />
            <span className="text-[10px] text-muted-foreground/60">Custom</span>
            <code className="text-[9px] text-muted-foreground ml-auto">{color ?? "—"}</code>
          </div>
        </div>
      )}
    </div>
  );
}

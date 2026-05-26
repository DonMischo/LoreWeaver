"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker } from "react-colorful";

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

// ── HEX validation ────────────────────────────────────────────────────────────

function isValidHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

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
  const [open, setOpen]     = useState(false);
  const [hexInput, setHexInput] = useState(color ?? "#94a3b8");
  const containerRef        = useRef<HTMLDivElement>(null);

  // Keep hex input in sync when color prop changes externally
  useEffect(() => {
    if (color && isValidHex(color)) setHexInput(color);
  }, [color]);

  // Click-outside closes the popover
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleWheelChange = useCallback((hex: string) => {
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    const normalized = v.startsWith("#") ? v : `#${v}`;
    if (isValidHex(normalized)) onChange(normalized);
  }, [onChange]);

  const dotSize  = large ? "h-4 w-4" : "h-3 w-3";
  const popoverX = alignLeft ? "left-0" : "right-0";

  const triggerStyle = color
    ? { backgroundColor: color }
    : { backgroundColor: "transparent", border: "1.5px dashed #71717a" };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${dotSize} rounded-full transition-transform hover:scale-110`}
        style={triggerStyle}
        title="Color"
      />

      {open && (
        <div
          className={`absolute ${popoverX} top-5 z-50 bg-popover border border-border rounded-xl shadow-xl p-2.5`}
          style={{ width: 200 }}
        >
          {/* Color wheel */}
          <div className="mb-2 [&_.react-colorful]:w-full [&_.react-colorful__saturation]:rounded-lg [&_.react-colorful__hue]:rounded-full [&_.react-colorful__hue]:mt-2 [&_.react-colorful__hue]:h-2.5">
            <HexColorPicker
              color={color ?? "#94a3b8"}
              onChange={handleWheelChange}
            />
          </div>

          {/* Preset swatches */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            {SCENE_PRESETS.map((hex, i) => (
              <button
                key={i}
                onClick={() => { onChange(hex); if (hex) setHexInput(hex); setOpen(false); }}
                className="h-4 w-4 rounded-full ring-1 ring-border hover:scale-110 transition-transform"
                style={
                  hex
                    ? { backgroundColor: hex }
                    : { backgroundColor: "transparent", border: "1.5px dashed #71717a" }
                }
                title={hex ?? "Clear"}
              />
            ))}
          </div>

          {/* Hex text input */}
          <div className="flex items-center gap-1.5">
            <div
              className="h-4 w-4 rounded-full ring-1 ring-border flex-shrink-0"
              style={{ backgroundColor: color ?? "transparent" }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInput}
              spellCheck={false}
              maxLength={7}
              className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-foreground border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="#rrggbb"
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Curated list of book-quality fonts available via Google Fonts.
// Shown as suggestions when Pandoc is offline (no installed-font list)
// and as a secondary group when it is online.
const SUGGESTED_FONTS: { name: string; style: string }[] = [
  // ── Classic book serifs ────────────────────────────────────────────────
  { name: "EB Garamond",          style: "Old-style serif — warm, literary" },
  { name: "Cormorant Garamond",   style: "Display serif — elegant, refined" },
  { name: "Crimson Pro",          style: "Old-style serif — readable at small sizes" },
  { name: "Lora",                 style: "Contemporary serif — popular for print" },
  { name: "Libre Baskerville",    style: "Transitional serif — clean and legible" },
  { name: "Merriweather",         style: "Slab serif — excellent for long reads" },
  { name: "Playfair Display",     style: "High-contrast serif — striking chapter titles" },
  { name: "Source Serif 4",       style: "Humanist serif — modern and neutral" },
  { name: "Gentium Plus",         style: "Literary serif — strong multilingual support" },
  { name: "Spectral",             style: "Screen-optimised serif — works well in EPUB" },
  { name: "Alegreya",             style: "Calligraphic serif — expressive, novel-ready" },
  { name: "Palatino Linotype",    style: "Classic humanist serif — a LaTeX staple" },
  { name: "Linux Libertine",      style: "Humanist serif — Wikipedia's body font" },
  // ── Sans-serif ─────────────────────────────────────────────────────────
  { name: "Open Sans",            style: "Humanist sans — clean, widely available" },
  { name: "Lato",                 style: "Geometric sans — friendly and modern" },
  { name: "Source Sans 3",        style: "Neutral sans — designed for UI & print" },
  { name: "Roboto",               style: "Geometric sans — versatile default" },
  { name: "Nunito",               style: "Rounded sans — warm, approachable" },
  // ── Monospace / typewriter ─────────────────────────────────────────────
  { name: "Courier Prime",        style: "Improved Courier — screenplay standard" },
  { name: "Inconsolata",          style: "Clean monospace — great for manuscripts" },
  { name: "JetBrains Mono",       style: "Modern monospace — crisp at any size" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  fonts: string[];
  disabled?: boolean;
  placeholder?: string;
}

export function FontPicker({
  value,
  onChange,
  fonts,
  disabled,
  placeholder = "e.g. EB Garamond",
}: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef      = useRef<HTMLDivElement>(null);

  // Keep query in sync when value changes externally (e.g. preset applied)
  useEffect(() => { setQuery(value); }, [value]);

  // Close dropdown and commit on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (query !== value) onChange(query);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, value, onChange]);

  const q               = query.toLowerCase();
  const installedMatch  = fonts.filter(f => f.toLowerCase().includes(q)).slice(0, 50);
  const suggestedMatch  = SUGGESTED_FONTS.filter(
    f => !fonts.includes(f.name) && f.name.toLowerCase().includes(q)
  );
  const hasInstalled    = installedMatch.length > 0;
  const hasSuggested    = suggestedMatch.length > 0;
  const isKnown         = fonts.includes(value);
  const isSuggested     = SUGGESTED_FONTS.some(f => f.name === value);
  const isCustom        = !!value && !isKnown && !isSuggested;

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        "flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-sm transition-colors",
        !disabled && "hover:border-ring/50",
        open       && "ring-1 ring-ring border-ring",
        disabled   && "opacity-50 pointer-events-none",
      )}>
        {(isCustom || isSuggested) && (
          <span
            className="text-[9px] font-bold tracking-wide text-blue-500 shrink-0 bg-blue-500/10 px-1 rounded"
            title="Will be fetched from Google Fonts on export"
          >G</span>
        )}
        <input
          className="flex-1 bg-transparent outline-none text-sm min-w-0 placeholder:text-muted-foreground/50"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === "Enter")  { onChange(query); setOpen(false); (e.target as HTMLElement).blur(); }
            if (e.key === "Escape") { setQuery(value); setOpen(false); }
            if (e.key === "Tab")    { onChange(query); setOpen(false); }
          }}
        />
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform cursor-pointer", open && "rotate-180")}
          onClick={() => !disabled && setOpen(o => !o)}
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
          {!hasInstalled && !hasSuggested && query ? (
            // Unknown font — offer it as a Google Font
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-blue-500">"{query}"</span>
              {" "}— will be fetched from Google Fonts on export
            </div>
          ) : (
            <>
              {/* Installed fonts from Pandoc */}
              {hasInstalled && (
                <>
                  {fonts.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Installed
                    </div>
                  )}
                  {installedMatch.map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { onChange(f); setQuery(f); setOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors truncate",
                        f === value && "bg-accent/60 font-medium",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </>
              )}

              {/* Curated suggestions (Google Fonts) */}
              {hasSuggested && (
                <>
                  <div className={cn(
                    "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60",
                    hasInstalled && "border-t border-border mt-1",
                  )}>
                    {fonts.length > 0 ? "Google Fonts suggestions" : "Suggested fonts"}
                  </div>
                  {suggestedMatch.map(f => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => { onChange(f.name); setQuery(f.name); setOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 hover:bg-accent transition-colors",
                        f.name === value && "bg-accent/60",
                      )}
                    >
                      <span className="text-sm">{f.name}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">{f.style}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Custom Google Font entry hint */}
              {query && !installedMatch.includes(query) && !suggestedMatch.some(f => f.name === query) && (
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground bg-blue-500/5">
                  Press <kbd className="font-mono bg-muted px-1 rounded text-[10px]">Enter</kbd> to use{" "}
                  <span className="text-blue-500 font-medium">"{query}"</span> as a Google Font
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

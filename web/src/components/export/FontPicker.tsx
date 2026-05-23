"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const filtered   = fonts.filter(f => f.toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  const isKnown    = fonts.includes(value);
  const isCustom   = !!value && !isKnown;

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        "flex items-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-sm transition-colors",
        !disabled && "hover:border-ring/50",
        open       && "ring-1 ring-ring border-ring",
        disabled   && "opacity-50 pointer-events-none",
      )}>
        {isCustom && (
          <span
            className="text-[9px] font-bold tracking-wide text-blue-500 shrink-0 bg-blue-500/10 px-1 rounded"
            title="Will be fetched from Google Fonts"
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
        <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              {query ? (
                <>
                  <span className="font-medium text-blue-500">"{query}"</span>
                  {" "}— not installed locally; will be fetched from Google Fonts on export
                </>
              ) : "Start typing to search fonts"}
            </div>
          ) : (
            <>
              {filtered.map(f => (
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
              {query && !filtered.includes(query) && (
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

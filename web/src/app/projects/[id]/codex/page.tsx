"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Pencil, Trash2, User, MapPin, Package, Scroll, Tag,
  LayoutGrid, LayoutList, FolderOpen, Upload, Loader2, CheckCircle2, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodexEntryDialog } from "@/components/codex/CodexEntryDialog";
import { ImportButton } from "@/components/layout/ImportButton";
import { useCodexEntries, useCreateCodexEntry, useUpdateCodexEntry, useDeleteCodexEntry } from "@/store/queries";
import { importApi } from "@/lib/api";
import type { CodexEntry, EntryType } from "@/types";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<EntryType, React.ElementType> = {
  character: User, location: MapPin, item: Package, lore: Scroll, custom: Tag,
};

const TYPE_LABELS: Record<EntryType, string> = {
  character: "Character", location: "Location", item: "Item", lore: "Lore", custom: "Custom",
};

// ── Directory import hook ─────────────────────────────────────────────────────

function useDirImport(projectId: number) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const all = Array.from(e.target.files ?? []).filter(f => f.name.endsWith(".md"));
    if (inputRef.current) inputRef.current.value = "";
    if (!all.length) return;

    setProgress({ done: 0, total: all.length });
    let created = 0, skipped = 0, errors = 0;

    for (let i = 0; i < all.length; i++) {
      try {
        const r = await importApi.codex(projectId, all[i]);
        created += r.created ?? 0;
        skipped += r.skipped ?? 0;
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: all.length });
    }

    qc.invalidateQueries({ queryKey: ["codex", projectId] });
    setProgress(null);
    const msg = `${created} entries imported, ${skipped} skipped${errors ? `, ${errors} file error(s)` : ""} from ${all.length} file(s).`;
    setResult({ ok: errors < all.length, msg });
    setTimeout(() => setResult(null), 5000);
  };

  return { inputRef, progress, result, handleChange };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CodexPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data: entries = [], isLoading } = useCodexEntries(projectId);
  const createEntry = useCreateCodexEntry(projectId);
  const updateEntry = useUpdateCodexEntry(projectId);
  const deleteEntry = useDeleteCodexEntry(projectId);

  // ── View / filter state ──────────────────────────────────────────────────
  const [view, setView]             = useState<"grid" | "list">("grid");
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<CodexEntry | null>(null);

  // ── Dir import ───────────────────────────────────────────────────────────
  const dir = useDirImport(projectId);

  // ── Derived filter options ───────────────────────────────────────────────
  const uniqueColors  = [...new Set(entries.map(e => e.color))].sort();
  const uniqueGroups  = [...new Set(entries.map(e => e.group).filter(Boolean) as string[])].sort();
  const uniqueSpecies = [...new Set(entries.map(e => e.species).filter(Boolean) as string[])].sort();

  const hasExtraFilters = uniqueGroups.length > 0 || uniqueSpecies.length > 0 || uniqueColors.length > 1;

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
    if (colorFilter && e.color !== colorFilter) return false;
    if (groupFilter && e.group !== groupFilter) return false;
    if (speciesFilter && e.species !== speciesFilter) return false;
    const q = search.toLowerCase();
    if (q && !e.name.toLowerCase().includes(q) && !e.aliases.some(a => a.toLowerCase().includes(q))) return false;
    return true;
  });

  const activeFilterCount = [colorFilter, groupFilter, speciesFilter].filter(Boolean).length;

  const handleSave = (data: Partial<CodexEntry>) => {
    if (editing) {
      updateEntry.mutate({ id: editing.id, data });
    } else {
      createEntry.mutate({ ...data, project_id: projectId } as any);
    }
    setEditing(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Codex</h1>
          <p className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {filtered.length !== entries.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Dir import status */}
          {(dir.progress || dir.result) && (
            <span className={cn(
              "text-xs px-2 py-1 rounded flex items-center gap-1",
              dir.result ? (dir.result.ok ? "text-green-500" : "text-destructive") : "text-muted-foreground"
            )}>
              {dir.progress
                ? <><Loader2 className="h-3 w-3 animate-spin" />{dir.progress.done}/{dir.progress.total}</>
                : <><CheckCircle2 className="h-3 w-3" />{dir.result!.msg}</>
              }
            </span>
          )}

          {/* Import folder */}
          <input
            ref={dir.inputRef}
            type="file"
            // @ts-ignore – webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            className="hidden"
            onChange={dir.handleChange}
          />
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground"
            title="Import all .md files from a folder (searches all sub-folders)"
            onClick={() => dir.inputRef.current?.click()}
            disabled={!!dir.progress}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Import folder
          </Button>

          {/* Single-file import */}
          <ImportButton projectId={projectId} mode="codex" className="w-auto" />

          {/* View toggle */}
          <button
            onClick={() => setView(v => v === "grid" ? "list" : "grid")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={view === "grid" ? "Switch to list view" : "Switch to grid view"}
          >
            {view === "grid" ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>

          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="px-6 py-2 border-b border-border space-y-2 shrink-0">
        {/* Row 1: search + type chips + filter toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            className="max-w-xs h-8 text-sm"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            {(["all", "character", "location", "item", "lore", "custom"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full transition-colors",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {hasExtraFilters && (
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={cn(
                "ml-auto text-xs px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors",
                (filtersOpen || activeFilterCount > 0)
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </button>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setColorFilter(null); setGroupFilter(null); setSpeciesFilter(null); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Row 2: extra filters (collapsible) */}
        {filtersOpen && hasExtraFilters && (
          <div className="flex flex-wrap gap-4 pt-1">

            {/* Color filter */}
            {uniqueColors.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Color</span>
                <div className="flex gap-1 flex-wrap">
                  {uniqueColors.map(c => (
                    <button
                      key={c}
                      onClick={() => setColorFilter(colorFilter === c ? null : c)}
                      title={c}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 transition-all",
                        colorFilter === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group filter */}
            {uniqueGroups.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Group</span>
                <div className="flex gap-1 flex-wrap">
                  {uniqueGroups.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full transition-colors",
                        groupFilter === g
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Species filter */}
            {uniqueSpecies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Species</span>
                <div className="flex gap-1 flex-wrap">
                  {uniqueSpecies.map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeciesFilter(speciesFilter === s ? null : s)}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full transition-colors",
                        speciesFilter === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entry list / grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {entries.length === 0
              ? "No codex entries yet. Create one or import a folder."
              : "No entries match your filters."}
          </div>
        ) : view === "grid" ? (
          // ── Grid view ──────────────────────────────────────────────────────
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(entry => {
              const Icon = TYPE_ICONS[entry.entry_type as EntryType] ?? Tag;
              return (
                <div key={entry.id} className="group bg-card border border-border rounded-lg p-4 relative">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: entry.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <h3 className="font-medium text-sm truncate">{entry.name}</h3>
                      </div>
                      {entry.aliases.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-1">{entry.aliases.join(", ")}</p>
                      )}
                      {(entry.group || entry.species) && (
                        <p className="text-xs text-muted-foreground/70 mb-1">
                          {[entry.group, entry.species].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {entry.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                    <button className="p-1 hover:text-primary rounded" onClick={() => { setEditing(entry); setDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button className="p-1 hover:text-destructive rounded" onClick={() => { if (confirm(`Delete "${entry.name}"?`)) deleteEntry.mutate(entry.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── List view ──────────────────────────────────────────────────────
          <div className="divide-y divide-border/50 border border-border rounded-lg overflow-hidden">
            {filtered.map(entry => {
              const Icon = TYPE_ICONS[entry.entry_type as EntryType] ?? Tag;
              return (
                <div key={entry.id} className="group flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-secondary/30 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm w-36 shrink-0 truncate">{entry.name}</span>
                  {entry.aliases.length > 0 && (
                    <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{entry.aliases.join(", ")}</span>
                  )}
                  {entry.group && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded shrink-0">{entry.group}</span>
                  )}
                  {entry.species && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded shrink-0">{entry.species}</span>
                  )}
                  {entry.description && (
                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{entry.description}</span>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0 ml-auto">
                    <button className="p-1 hover:text-primary rounded" onClick={() => { setEditing(entry); setDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button className="p-1 hover:text-destructive rounded" onClick={() => { if (confirm(`Delete "${entry.name}"?`)) deleteEntry.mutate(entry.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CodexEntryDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing ?? undefined}
        title={editing ? "Edit Entry" : "New Codex Entry"}
      />
    </div>
  );
}

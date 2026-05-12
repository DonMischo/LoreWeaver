"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, User, MapPin, Package, Scroll, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodexEntryDialog } from "@/components/codex/CodexEntryDialog";
import { ImportButton } from "@/components/layout/ImportButton";
import { useCodexEntries, useCreateCodexEntry, useUpdateCodexEntry, useDeleteCodexEntry } from "@/store/queries";
import type { CodexEntry, EntryType } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<EntryType, React.ElementType> = {
  character: User, location: MapPin, item: Package, lore: Scroll, custom: Tag,
};

export default function CodexPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data: entries = [], isLoading } = useCodexEntries(projectId);
  const createEntry = useCreateCodexEntry(projectId);
  const updateEntry = useUpdateCodexEntry(projectId);
  const deleteEntry = useDeleteCodexEntry(projectId);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CodexEntry | null>(null);

  const filtered = entries.filter((e) => {
    const matchesType = typeFilter === "all" || e.entry_type === typeFilter;
    const q = search.toLowerCase();
    return matchesType && (!q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)));
  });

  const handleSave = (data: Partial<CodexEntry>) => {
    if (editing) {
      updateEntry.mutate({ id: editing.id, data });
    } else {
      createEntry.mutate({ ...data, project_id: projectId } as any);
    }
    setEditing(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold">Codex</h1>
          <p className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? "entry" : "entries"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton projectId={projectId} mode="codex" className="w-auto" />
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <Input
          className="max-w-xs h-8 text-sm"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {(["all", "character", "location", "item", "lore", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-colors",
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {entries.length === 0 ? "No codex entries yet. Create one to start building your world." : "No entries match your filters."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.entry_type as EntryType] || Tag;
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
                        <p className="text-xs text-muted-foreground mb-1.5">
                          {entry.aliases.join(", ")}
                        </p>
                      )}
                      {entry.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      className="p-1 hover:text-primary rounded"
                      onClick={() => { setEditing(entry); setDialogOpen(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="p-1 hover:text-destructive rounded"
                      onClick={() => { if (confirm(`Delete "${entry.name}"?`)) deleteEntry.mutate(entry.id); }}
                    >
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

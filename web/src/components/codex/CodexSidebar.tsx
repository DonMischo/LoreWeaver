"use client";

import { useState } from "react";
import { X, Search, Plus, User, MapPin, Package, Scroll, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CodexEntry, EntryType } from "@/types";
import { useEntryRelations } from "@/store/queries";

const TYPE_ICONS: Record<EntryType, React.ElementType> = {
  character: User,
  location: MapPin,
  item: Package,
  lore: Scroll,
  custom: Tag,
};

const TYPE_LABELS: Record<EntryType, string> = {
  character: "Character",
  location: "Location",
  item: "Item",
  lore: "Lore",
  custom: "Custom",
};

interface Props {
  entries: CodexEntry[];
  selectedId?: number;
  onSelect: (id: number) => void;
  onClose: () => void;
  onAdd: () => void;
}

export function CodexSidebar({ entries, selectedId, onSelect, onClose, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");

  const filtered = entries.filter((e) => {
    const matchesType = typeFilter === "all" || e.entry_type === typeFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) ||
      e.aliases.some((a) => a.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const selected = entries.find((e) => e.id === selectedId);
  const { data: relations = [] } = useEntryRelations(selected?.id ?? 0);

  return (
    <div className="flex flex-col w-72 border-l border-border bg-card h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-sm font-medium">Codex</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {selected ? (
        <div className="flex-1 overflow-y-auto p-3">
          <button
            className="text-xs text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
            onClick={() => onSelect(-1)}
          >
            ← Back to list
          </button>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
            <h3 className="font-semibold">{selected.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{TYPE_LABELS[selected.entry_type as EntryType]}</p>

          {/* Groups / Species / Subtype */}
          {((selected.groups?.length) || selected.species || selected.subtype) && (
            <div className="flex gap-3 mb-3 flex-wrap">
              {(selected.groups?.length > 0) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Groups</p>
                  <div className="flex flex-wrap gap-0.5">
                    {selected.groups.map(g => (
                      <span key={g} className="text-xs bg-secondary px-1.5 py-0.5 rounded">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.species && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Species</p>
                  <p className="text-xs">{selected.species}</p>
                </div>
              )}
              {selected.subtype && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Subtype</p>
                  <p className="text-xs">{selected.subtype}</p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {selected.tags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Aliases */}
          {selected.aliases.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Also known as</p>
              <div className="flex flex-wrap gap-1">
                {selected.aliases.map((a) => (
                  <span key={a} className="text-xs bg-secondary px-2 py-0.5 rounded">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {selected.description && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm leading-relaxed">{selected.description}</p>
            </div>
          )}

          {/* Notes */}
          {selected.notes && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{selected.notes}</p>
            </div>
          )}

          {/* Relations */}
          {relations.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Relations</p>
              <div className="space-y-1">
                {relations.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.other_color }} />
                    <span className="font-medium">{r.other_name}</span>
                    {r.relation_type && (
                      <span className="text-muted-foreground">— {r.relation_type}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                className="pl-7 h-7 text-xs"
                placeholder="Search codex..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-1 px-3 py-2 border-b border-border flex-wrap">
            {(["all", "character", "location", "item", "lore", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full transition-colors",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {t === "all" ? "All" : TYPE_LABELS[t as EntryType]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.entry_type as EntryType] || Tag;
              return (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/50 text-left"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{entry.name}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No entries found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

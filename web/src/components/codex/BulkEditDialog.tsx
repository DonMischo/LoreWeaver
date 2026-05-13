"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodexEntry, EntryType } from "@/types";
import { codexApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const ENTRY_TYPES: EntryType[] = ["character", "location", "item", "lore", "custom"];

const PRESET_RELATIONS = [
  "friend", "enemy", "ally", "rival",
  "family", "mentor", "student",
  "possession", "home", "origin",
  "member of", "leads",
  "custom…",
];

interface Props {
  open: boolean;
  onClose: () => void;
  selectedEntries: CodexEntry[];
  allEntries: CodexEntry[];
  projectId: number;
}

export function BulkEditDialog({ open, onClose, selectedEntries, allEntries, projectId }: Props) {
  const qc = useQueryClient();
  const [entryType, setEntryType]   = useState<EntryType | "__none__">("__none__");
  const [subtype, setSubtype]       = useState("");
  const [tagInput, setTagInput]     = useState("");
  const [tagsToAdd, setTagsToAdd]   = useState<string[]>([]);
  const [relTarget, setRelTarget]   = useState("");
  const [relPreset, setRelPreset]   = useState(PRESET_RELATIONS[0]);
  const [relCustom, setRelCustom]   = useState("");
  const [relationsToAdd, setRelationsToAdd] = useState<{ targetId: number; targetName: string; type: string }[]>([]);
  const [applying, setApplying]     = useState(false);

  const reset = () => {
    setEntryType("__none__");
    setSubtype("");
    setTagInput("");
    setTagsToAdd([]);
    setRelTarget("");
    setRelPreset(PRESET_RELATIONS[0]);
    setRelCustom("");
    setRelationsToAdd([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tagsToAdd.includes(t)) { setTagsToAdd([...tagsToAdd, t]); setTagInput(""); }
  };

  const effectiveRelType = relPreset === "custom…" ? relCustom.trim() : relPreset;
  const addRelation = () => {
    const targetEntry = allEntries.find(e => String(e.id) === relTarget);
    if (!targetEntry || !effectiveRelType) return;
    if (relationsToAdd.some(r => r.targetId === targetEntry.id)) return;
    setRelationsToAdd([...relationsToAdd, {
      targetId: targetEntry.id,
      targetName: targetEntry.name,
      type: effectiveRelType,
    }]);
    setRelTarget("");
    setRelPreset(PRESET_RELATIONS[0]);
    setRelCustom("");
  };

  const hasChanges = entryType !== "__none__" || subtype.trim() || tagsToAdd.length > 0 || relationsToAdd.length > 0;

  const handleApply = async () => {
    if (!hasChanges) return;
    setApplying(true);
    try {
      for (const entry of selectedEntries) {
        // Build update payload
        const update: Record<string, unknown> = {};
        if (entryType !== "__none__") update.entry_type = entryType;
        if (subtype.trim()) {
          const effectiveType = entryType !== "__none__" ? entryType : entry.entry_type;
          if (effectiveType === "character") {
            update.species = subtype.trim();
          } else {
            update.subtype = subtype.trim();
          }
        }
        if (tagsToAdd.length > 0) {
          const merged = [...new Set([...entry.tags, ...tagsToAdd])];
          update.tags = merged;
        }
        if (Object.keys(update).length > 0) {
          await codexApi.update(entry.id, update as any);
        }
        // Add relations
        for (const rel of relationsToAdd) {
          if (rel.targetId === entry.id) continue; // skip self-relation
          await codexApi.createRelation({
            source_id: entry.id,
            target_id: rel.targetId,
            relation_type: rel.type,
          });
        }
      }
    } finally {
      setApplying(false);
      qc.invalidateQueries({ queryKey: ["codex", projectId] });
      handleClose();
    }
  };

  // Entries that are not in the selection (for relation target)
  const targetOptions = allEntries.filter(
    e => !selectedEntries.some(s => s.id === e.id)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bulk Edit — {selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 pb-1">
          Only filled fields are applied. Blank fields are left unchanged.
        </p>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label>Change Type</Label>
            <Select value={entryType} onValueChange={v => setEntryType(v as EntryType | "__none__")}>
              <SelectTrigger><SelectValue placeholder="— no change —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— no change —</SelectItem>
                {ENTRY_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subtype / Species */}
          <div className="space-y-1.5">
            <Label>Set Subtype / Species</Label>
            <Input
              value={subtype}
              onChange={e => setSubtype(e.target.value)}
              placeholder="Leave blank for no change…"
            />
            <p className="text-xs text-muted-foreground">
              Applied as "Species" for characters, "Subtype" for all others.
            </p>
          </div>

          {/* Add Tags */}
          <div className="space-y-1.5">
            <Label>Add Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Tag to add to all…"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tagsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagsToAdd.map(t => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    #{t}
                    <button onClick={() => setTagsToAdd(tagsToAdd.filter(x => x !== t))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add Relations */}
          {targetOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Add Relation to All</Label>
              <div className="flex gap-2 flex-wrap">
                <Select value={relTarget} onValueChange={setRelTarget}>
                  <SelectTrigger className="flex-1 min-w-0 h-8 text-xs">
                    <SelectValue placeholder="Select entry…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                          {e.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={relPreset} onValueChange={setRelPreset}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_RELATIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {relPreset === "custom…" && (
                  <Input
                    className="h-8 text-xs flex-1 min-w-0"
                    value={relCustom}
                    onChange={e => setRelCustom(e.target.value)}
                    placeholder="Custom…"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRelation(); } }}
                  />
                )}
                <Button
                  type="button" variant="outline" size="sm" className="h-8 px-2"
                  onClick={addRelation}
                  disabled={!relTarget || !effectiveRelType}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {relationsToAdd.length > 0 && (
                <div className="space-y-1">
                  {relationsToAdd.map(r => (
                    <div key={r.targetId} className="flex items-center justify-between text-xs bg-secondary/40 px-2 py-1 rounded">
                      <span>→ <strong>{r.targetName}</strong> <span className="text-muted-foreground">({r.type})</span></span>
                      <button onClick={() => setRelationsToAdd(relationsToAdd.filter(x => x.targetId !== r.targetId))}>
                        <X className="h-3 w-3 hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleApply} disabled={!hasChanges || applying}>
              {applying ? "Applying…" : `Apply to ${selectedEntries.length} ${selectedEntries.length === 1 ? "entry" : "entries"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

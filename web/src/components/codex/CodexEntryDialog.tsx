"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodexEntry, CodexRelationResolved, EntryType } from "@/types";
import { useEntryRelations, useCreateRelation, useDeleteRelation } from "@/store/queries";

const ENTRY_TYPES: EntryType[] = ["character", "location", "item", "lore", "custom"];

const PRESET_COLORS = [
  "#eab308", "#ef4444", "#3b82f6", "#22c55e",
  "#a855f7", "#f97316", "#ec4899", "#14b8a6",
];

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
  onSave: (data: Partial<CodexEntry>) => void;
  initial?: Partial<CodexEntry>;
  title: string;
  /** All codex entries for the project (for the relation target dropdown) */
  allEntries?: CodexEntry[];
}

export function CodexEntryDialog({
  open, onClose, onSave, initial, title, allEntries = [],
}: Props) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [aliasInput, setAliasInput]   = useState("");
  const [aliases, setAliases]         = useState<string[]>(initial?.aliases ?? []);
  const [entryType, setEntryType]     = useState<EntryType>(initial?.entry_type ?? "custom");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes]             = useState(initial?.notes ?? "");
  const [color, setColor]             = useState(initial?.color ?? "#eab308");
  const [group, setGroup]             = useState(initial?.group ?? "");
  const [species, setSpecies]         = useState(initial?.species ?? "");
  const [subtype, setSubtype]         = useState(initial?.subtype ?? "");
  const [tagInput, setTagInput]       = useState("");
  const [tags, setTags]               = useState<string[]>(initial?.tags ?? []);

  // Relation-add state
  const [relTarget, setRelTarget]     = useState("");
  const [relPreset, setRelPreset]     = useState(PRESET_RELATIONS[0]);
  const [relCustom, setRelCustom]     = useState("");

  const isExisting = !!initial?.id;
  const entryId    = initial?.id ?? 0;

  const { data: relations = [] } = useEntryRelations(isExisting ? entryId : 0);
  const createRel  = useCreateRelation(entryId);
  const deleteRel  = useDeleteRelation(entryId);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAliases(initial?.aliases ?? []);
      setEntryType(initial?.entry_type ?? "custom");
      setDescription(initial?.description ?? "");
      setNotes(initial?.notes ?? "");
      setColor(initial?.color ?? "#eab308");
      setGroup(initial?.group ?? "");
      setSpecies(initial?.species ?? "");
      setSubtype(initial?.subtype ?? "");
      setTags(initial?.tags ?? []);
      setAliasInput("");
      setTagInput("");
      setRelTarget("");
      setRelPreset(PRESET_RELATIONS[0]);
      setRelCustom("");
    }
  }, [open, initial]);

  // Alias helpers
  const addAlias = () => {
    const a = aliasInput.trim();
    if (a && !aliases.includes(a)) { setAliases([...aliases, a]); setAliasInput(""); }
  };
  const removeAlias = (a: string) => setAliases(aliases.filter((x) => x !== a));

  // Tag helpers
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // Relation helpers
  const effectiveRelType = relPreset === "custom…" ? relCustom.trim() : relPreset;
  const addRelation = () => {
    if (!relTarget || !effectiveRelType) return;
    const targetEntry = allEntries.find((e) => String(e.id) === relTarget);
    if (!targetEntry) return;
    createRel.mutate({
      source_id: entryId,
      target_id: targetEntry.id,
      relation_type: effectiveRelType,
    });
    setRelTarget("");
    setRelPreset(PRESET_RELATIONS[0]);
    setRelCustom("");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      aliases,
      entry_type: entryType,
      description,
      notes: notes || null,
      color,
      group: group.trim() || null,
      species: entryType === "character" ? (species.trim() || null) : null,
      subtype: entryType !== "character" ? (subtype.trim() || null) : null,
      tags,
    });
    onClose();
  };

  // Other entries that are not this one, for relation target dropdown
  const otherEntries = allEntries.filter((e) => e.id !== entryId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">

          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Entry name…"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Group + Species (character) / Subtype (others) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="e.g. Fellowship, Empire…"
              />
            </div>
            {entryType === "character" ? (
              <div className="space-y-1.5">
                <Label>Species</Label>
                <Input
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  placeholder="e.g. Human, Elf…"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Subtype</Label>
                <Input
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  placeholder="e.g. City, Weapon, Magic…"
                />
              </div>
            )}
          </div>

          {/* Aliases */}
          <div className="space-y-1.5">
            <Label>Aliases (alternate names)</Label>
            <div className="flex gap-2">
              <Input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Add alias…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addAlias}>Add</Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {aliases.map((a) => (
                  <span key={a} className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded">
                    {a}
                    <button onClick={() => removeAlias(a)} className="hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    #{t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Who or what is this?"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Private Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes visible only to you…"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Highlight Color</Label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>

          {/* Relations — only for existing (saved) entries */}
          {isExisting && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Relations
              </Label>

              {/* Existing relations list */}
              {relations.length > 0 && (
                <div className="space-y-1">
                  {relations.map((r: CodexRelationResolved) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm px-2 py-1 rounded bg-secondary/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.other_color }}
                        />
                        <span className="font-medium truncate">{r.other_name}</span>
                        {r.relation_type && (
                          <span className="text-xs text-muted-foreground">— {r.relation_type}</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteRel.mutate(r.id)}
                        className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add relation row */}
              {otherEntries.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Select value={relTarget} onValueChange={setRelTarget}>
                    <SelectTrigger className="flex-1 min-w-0 h-8 text-xs">
                      <SelectValue placeholder="Select entry…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherEntries.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: e.color }}
                            />
                            {e.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={relPreset} onValueChange={setRelPreset}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_RELATIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {relPreset === "custom…" && (
                    <Input
                      className="h-8 text-xs flex-1 min-w-0"
                      value={relCustom}
                      onChange={(e) => setRelCustom(e.target.value)}
                      placeholder="Custom relation…"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRelation(); } }}
                    />
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={addRelation}
                    disabled={!relTarget || !effectiveRelType || createRel.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Save Entry</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

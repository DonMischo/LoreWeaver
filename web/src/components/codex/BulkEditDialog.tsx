"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodexEntry, EntryType } from "@/types";
import { codexApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

const ENTRY_TYPES: EntryType[] = ["character", "location", "item", "lore", "custom"];

const RELATION_GROUPS: { label: string; items: string[] }[] = [
  { label: "General",      items: ["friend", "enemy", "ally", "rival"] },
  { label: "Mentorship",   items: ["mentor", "student"] },
  { label: "Place",        items: ["home", "origin"] },
  { label: "Organization", items: ["member of", "leads"] },
  { label: "Family",       items: ["parent", "child", "mother", "father", "grandmother", "grandfather", "aunt", "uncle", "sister", "brother", "cousin"] },
  { label: "Romantic",     items: ["spouse", "partner", "lover"] },
  { label: "Ownership",    items: ["owner", "owned by"] },
  { label: "Other",        items: ["custom…"] },
];
const PRESET_RELATIONS = RELATION_GROUPS.flatMap(g => g.items);

const ENTRY_TYPE_ORDER = ["character", "location", "item", "lore", "custom"] as const;
const ENTRY_TYPE_LABELS: Record<string, string> = {
  character: "Characters", location: "Locations", item: "Items", lore: "Lore", custom: "Custom",
};

interface Props {
  open: boolean;
  onClose: () => void;
  selectedEntries: CodexEntry[];
  allEntries: CodexEntry[];
  projectId: number;
}

export function BulkEditDialog({ open, onClose, selectedEntries, allEntries, projectId }: Props) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [entryType, setEntryType]   = useState<EntryType | "__none__">("__none__");
  const [subtype, setSubtype]       = useState("");
  const [tagInput, setTagInput]     = useState("");
  const [tagsToAdd, setTagsToAdd]   = useState<string[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupsToAdd, setGroupsToAdd] = useState<string[]>([]);
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
    setGroupInput("");
    setGroupsToAdd([]);
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

  const addGroup = () => {
    const g = groupInput.trim();
    if (g && !groupsToAdd.includes(g)) { setGroupsToAdd([...groupsToAdd, g]); setGroupInput(""); }
  };
  const groupSuggestions = [...new Set(allEntries.flatMap(e => e.groups ?? []))].filter(g => !groupsToAdd.includes(g)).sort();

  const hasChanges = entryType !== "__none__" || subtype.trim() || tagsToAdd.length > 0 || groupsToAdd.length > 0 || relationsToAdd.length > 0;

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
        if (groupsToAdd.length > 0) {
          const merged = [...new Set([...(entry.groups ?? []), ...groupsToAdd])];
          update.groups = merged;
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

  // Entries that are not in the selection (for relation target) — grouped by type
  const targetOptions = allEntries.filter(e => !selectedEntries.some(s => s.id === e.id));
  const targetOptionsByType = ENTRY_TYPE_ORDER
    .map(type => ({ type, label: ENTRY_TYPE_LABELS[type], entries: targetOptions.filter(e => e.entry_type === type) }))
    .filter(g => g.entries.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("bulk_apply_to")} {selectedEntries.length} {selectedEntries.length === 1 ? t("codex_entry") : t("codex_entries")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 pb-1">
          {t("bulk_note")}
        </p>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t("bulk_change_type")}</Label>
            <Select value={entryType} onValueChange={v => setEntryType(v as EntryType | "__none__")}>
              <SelectTrigger><SelectValue placeholder={t("common_no_change")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("common_no_change")}</SelectItem>
                {ENTRY_TYPES.map(et => (
                  <SelectItem key={et} value={et}>{t(`type_${et}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subtype / Species */}
          <div className="space-y-1.5">
            <Label>{t("bulk_subtype_species")}</Label>
            <Input
              value={subtype}
              onChange={e => setSubtype(e.target.value)}
              placeholder="Leave blank for no change…"
            />
            <p className="text-xs text-muted-foreground">
              {t("bulk_subtype_note")}
            </p>
          </div>

          {/* Add Tags */}
          <div className="space-y-1.5">
            <Label>{t("bulk_add_tags")}</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder={t("bulk_tag_placeholder")}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>{t("common_add")}</Button>
            </div>
            {tagsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagsToAdd.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    #{tag}
                    <button onClick={() => setTagsToAdd(tagsToAdd.filter(x => x !== tag))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add Groups */}
          <div className="space-y-1.5">
            <Label>Add to groups</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={groupInput}
                  onChange={e => setGroupInput(e.target.value)}
                  placeholder="Group name…"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } }}
                  list="bulk-group-suggestions"
                />
                <datalist id="bulk-group-suggestions">
                  {groupSuggestions.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addGroup}>{t("common_add")}</Button>
            </div>
            {groupsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {groupsToAdd.map(g => (
                  <span key={g} className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded">
                    {g}
                    <button onClick={() => setGroupsToAdd(groupsToAdd.filter(x => x !== g))}>
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
              <Label>{t("bulk_add_relation")}</Label>
              <div className="flex gap-2 flex-wrap">
                <Select value={relTarget} onValueChange={setRelTarget}>
                  <SelectTrigger className="flex-1 min-w-0 h-8 text-xs">
                    <SelectValue placeholder={t("bulk_select_entry")} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptionsByType.map(({ type, label, entries }) => (
                      <SelectGroup key={type}>
                        <SelectLabel>{label}</SelectLabel>
                        {entries.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                              {e.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={relPreset} onValueChange={setRelPreset}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_GROUPS.map(({ label, items }) => (
                      <SelectGroup key={label}>
                        <SelectLabel>{label}</SelectLabel>
                        {items.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {relPreset === "custom…" && (
                  <Input
                    className="h-8 text-xs flex-1 min-w-0"
                    value={relCustom}
                    onChange={e => setRelCustom(e.target.value)}
                    placeholder={t("bulk_custom_relation")}
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
            <Button variant="outline" onClick={handleClose}>{t("common_cancel")}</Button>
            <Button onClick={handleApply} disabled={!hasChanges || applying}>
              {applying ? t("bulk_applying") : `${t("bulk_apply_to")} ${selectedEntries.length} ${selectedEntries.length === 1 ? t("codex_entry") : t("codex_entries")}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

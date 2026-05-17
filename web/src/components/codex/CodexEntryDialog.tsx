"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Link2, ImageIcon, Package, Coins } from "lucide-react";
import { imagesApi } from "@/lib/api";
import { useUploadCodexImage, useDeleteCodexImage, useInventorySummary, useEntryRelations, useCreateRelation, useDeleteRelation } from "@/store/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodexEntry, CodexRelationResolved, EntryType } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const ENTRY_TYPES: EntryType[] = ["character", "location", "item", "lore", "custom"];

const PRESET_COLORS = [
  "#eab308", "#ef4444", "#3b82f6", "#22c55e",
  "#a855f7", "#f97316", "#ec4899", "#14b8a6",
];

const PRESET_RELATIONS = [
  "friend", "enemy", "ally", "rival",
  "mentor", "student",
  "home", "origin",
  "member of", "leads",
  "parent", "child",
  "mother", "father",
  "grandmother", "grandfather",
  "aunt", "uncle",
  "sister", "brother",
  "spouse", "partner",
  "cousin",
  "custom…",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CodexEntry>) => void;
  initial?: Partial<CodexEntry>;
  title: string;
  /** All codex entries for the project (for the relation target dropdown and group suggestions) */
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
  const [species, setSpecies]         = useState(initial?.species ?? "");
  const [subtype, setSubtype]         = useState(initial?.subtype ?? "");
  const [tagInput, setTagInput]       = useState("");
  const [tags, setTags]               = useState<string[]>(initial?.tags ?? []);

  // Groups
  const [groups, setGroups]           = useState<string[]>(initial?.groups ?? []);
  const [groupInput, setGroupInput]   = useState("");
  const [groupDropOpen, setGroupDropOpen] = useState(false);
  const groupDropRef = useRef<HTMLDivElement>(null);

  // Main character
  const [isMainChar, setIsMainChar]   = useState(initial?.is_main_char ?? false);

  // Relation-add state
  const [relTarget, setRelTarget]     = useState("");
  const [relPreset, setRelPreset]     = useState(PRESET_RELATIONS[0]);
  const [relCustom, setRelCustom]     = useState("");

  const { t } = useLanguage();
  const isExisting = !!initial?.id;
  const entryId    = initial?.id ?? 0;
  const projectId  = initial?.project_id ?? 0;

  // Live inventory from scene commands (read-only display, always fresh)
  const { data: inventorySummary } = useInventorySummary(isExisting && entryType === "character" ? entryId : 0);

  const { data: relations = [] } = useEntryRelations(isExisting ? entryId : 0);
  const createRel    = useCreateRelation(entryId);
  const deleteRel    = useDeleteRelation(entryId);
  const uploadImg    = useUploadCodexImage(entryId, projectId);
  const deleteImg    = useDeleteCodexImage(entryId, projectId);

  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);

  // Click-outside to close group dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (groupDropRef.current && !groupDropRef.current.contains(e.target as Node)) {
        setGroupDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAliases(initial?.aliases ?? []);
      setEntryType(initial?.entry_type ?? "custom");
      setDescription(initial?.description ?? "");
      setNotes(initial?.notes ?? "");
      setColor(initial?.color ?? "#eab308");
      setGroups(initial?.groups ?? []);
      setSpecies(initial?.species ?? "");
      setSubtype(initial?.subtype ?? "");
      setTags(initial?.tags ?? []);
      setIsMainChar(initial?.is_main_char ?? false);
      setAliasInput("");
      setTagInput("");
      setGroupInput("");
      setGroupDropOpen(false);
      // Default relation target to first main character (other than this entry)
      const thisId = initial?.id ?? 0;
      const mainChar = allEntries.find(e => e.is_main_char && e.id !== thisId);
      setRelTarget(mainChar ? String(mainChar.id) : "");
      setRelPreset(PRESET_RELATIONS[0]);
      setRelCustom("");
      setImagePath(initial?.image_path ?? null);
    }
  }, [open, initial, allEntries]);

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

  // Group helpers
  const addGroup = () => {
    const g = groupInput.trim();
    if (g && !groups.includes(g)) { setGroups([...groups, g]); setGroupInput(""); }
  };
  const toggleGroup = (g: string) => setGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const removeGroup = (g: string) => setGroups(groups.filter(x => x !== g));
  // Existing groups from allEntries as suggestions (not already selected)
  const groupSuggestions = [...new Set(allEntries.flatMap(e => e.groups ?? []))].filter(g => !groups.includes(g)).sort();

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
      groups,
      species: entryType === "character" ? (species.trim() || null) : null,
      subtype: entryType !== "character" ? (subtype.trim() || null) : null,
      tags,
      is_main_char: isMainChar,
      // inventory is managed exclusively by scene commands (_sync_character_inventories)
      // — do not overwrite it here
    });
    onClose();
  };

  // Other entries that are not this one, for relation target dropdown
  const otherEntries = allEntries.filter((e) => e.id !== entryId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="pt-2 flex flex-col gap-4">
          {/* Two-column body: options left, description right */}
          <div className="flex gap-5 items-stretch">

            {/* ── Left column: all fields except description ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Name + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("entry_name")} *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Entry name…"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("entry_type")}</Label>
                  <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map((et) => (
                        <SelectItem key={et} value={et}>
                          {t(`type_${et}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Main character checkbox (character type only) */}
              {entryType === "character" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isMainChar}
                    onChange={e => setIsMainChar(e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm font-medium">{t("entry_main_char")}</span>
                  <span className="text-xs text-muted-foreground">{t("entry_main_char_desc")}</span>
                </label>
              )}

              {/* Groups */}
              <div className="space-y-1.5" ref={groupDropRef}>
                <Label>{t("entry_groups")}</Label>
                {groups.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {groups.map(g => (
                      <span key={g} className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded">
                        {g}
                        <button type="button" onClick={() => removeGroup(g)} className="hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 relative">
                  <Input
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    onFocus={() => setGroupDropOpen(true)}
                    placeholder={t("entry_add_group")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } }}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addGroup}>{t("common_add")}</Button>
                  {groupDropOpen && groupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 z-50 mt-1 min-w-48 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-40 overflow-y-auto">
                      {groupSuggestions.map(g => (
                        <button
                          key={g}
                          type="button"
                          className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
                          onMouseDown={(e) => { e.preventDefault(); toggleGroup(g); setGroupDropOpen(false); }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Species (character) / Subtype (others) */}
              <div className="space-y-1.5">
                {entryType === "character" ? (
                  <>
                    <Label>{t("codex_species")}</Label>
                    <Input
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      placeholder="e.g. Human, Elf…"
                    />
                  </>
                ) : (
                  <>
                    <Label>{t("codex_subtype")}</Label>
                    <Input
                      value={subtype}
                      onChange={(e) => setSubtype(e.target.value)}
                      placeholder="e.g. City, Weapon, Magic…"
                    />
                  </>
                )}
              </div>

              {/* Aliases */}
              <div className="space-y-1.5">
                <Label>{t("entry_aliases")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    placeholder={t("entry_add_alias")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addAlias}>{t("common_add")}</Button>
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
                <Label>{t("codex_tags")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder={t("entry_add_tag")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>{t("common_add")}</Button>
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

              {/* Image */}
              <div className="space-y-1.5">
                <Label>{t("img_portrait")}</Label>
                {isExisting ? (
                  <div className="flex items-start gap-3">
                    <div
                      className="relative w-20 h-24 rounded border border-border bg-muted/40 flex items-center justify-center overflow-hidden cursor-pointer shrink-0"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/jpeg,image/png,image/webp,image/gif";
                        input.onchange = () => {
                          if (input.files?.[0]) {
                            uploadImg.mutateAsync(input.files[0]).then((data) => setImagePath(data.image_path));
                          }
                        };
                        input.click();
                      }}
                      title={imagePath ? t("img_change") : t("img_upload")}
                    >
                      {imagePath ? (
                        <img src={imagesApi.url(imagePath)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-xs text-muted-foreground">{t("img_formats")}</p>
                      {imagePath && (
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline text-left"
                          onClick={() => deleteImg.mutateAsync().then(() => setImagePath(null))}
                        >
                          {t("img_remove")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("img_new_entry_hint")}</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>{t("entry_notes")}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes visible only to you…"
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label>{t("entry_color")}</Label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
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

              {/* Inventory — character only, read-only from scene commands */}
              {entryType === "character" && isExisting && inventorySummary && (
                (inventorySummary.items.length > 0 || inventorySummary.currencies.length > 0) && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <Label className="text-sm font-medium">{t("entry_inventory")}</Label>
                    <p className="text-xs text-muted-foreground">Tracked from scene commands</p>

                    {inventorySummary.currencies.length > 0 && (
                      <div className="space-y-0.5">
                        {inventorySummary.currencies.map(({ name, balance }) => (
                          <div key={name} className="flex items-center gap-2 text-xs">
                            <Coins className="h-3 w-3 shrink-0 text-yellow-500" />
                            <span className="flex-1 truncate">{name}</span>
                            <span className={cn(
                              "font-mono shrink-0",
                              balance >= 0 ? "text-green-500" : "text-red-500"
                            )}>{balance}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {inventorySummary.items.length > 0 && (
                      <div className="space-y-0.5">
                        {inventorySummary.items.map(({ item_id, qty }) => {
                          const entry = allEntries.find(e => e.id === item_id);
                          return (
                            <div key={item_id} className="flex items-center gap-2 text-xs">
                              <Package className="h-3 w-3 shrink-0 text-blue-400" />
                              <span className="flex-1 truncate">{entry?.name ?? `Item #${item_id}`}</span>
                              <span className={cn(
                                "font-mono shrink-0",
                                qty > 0 ? "text-green-500" : "text-red-500"
                              )}>×{qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Relations — only for existing (saved) entries */}
              {isExisting && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> {t("entry_relations")}
                  </Label>

                  {/* Existing relations list — auto: entries are shown in Inventory, not here */}
                  {relations.filter((r: CodexRelationResolved) => !r.relation_type?.startsWith("auto:")).length > 0 && (
                    <div className="space-y-1">
                      {relations.filter((r: CodexRelationResolved) => !r.relation_type?.startsWith("auto:")).map((r: CodexRelationResolved) => (
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
                          <SelectValue placeholder={t("bulk_select_entry")} />
                        </SelectTrigger>
                        <SelectContent>
                          {otherEntries.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: e.color }}
                                />
                                {e.name}{e.is_main_char ? " ★" : ""}
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
                          placeholder={t("bulk_custom_relation")}
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
            </div>

            {/* ── Right column: Description ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <Label>{t("entry_description")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who or what is this?"
                className="flex-1 resize-none min-h-[120px]"
              />
            </div>

          </div>{/* end two-column row */}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t("common_cancel")}</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>{t("entry_save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

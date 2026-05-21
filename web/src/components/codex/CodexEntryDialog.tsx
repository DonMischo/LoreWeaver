"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Link2, ImageIcon, Package, Coins, History, ChevronUp, Pencil } from "lucide-react";
import { imagesApi } from "@/lib/api";
import { useUploadCodexImage, useDeleteCodexImage, useInventorySummary, useCharacterItemLog, useCharacterCurrencyLog, useEntryRelations, useCreateRelation, useDeleteRelation } from "@/store/queries";
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
import { NameGeneratorWidget } from "./NameGeneratorWidget";
import type { NameType } from "@/lib/nameGenerator";

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

// ── Inventory sub-components ──────────────────────────────────────────────────

function InventoryCurrencyRow({
  characterId, name, balance,
  nativeAmount, onNativeChange, onRemoveNative,
}: {
  characterId: number; name: string; balance: number;
  nativeAmount?: number;
  onNativeChange?: (amount: number) => void;
  onRemoveNative?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const { data: log = [], isFetching } = useCharacterCurrencyLog(open ? characterId : 0, name);
  const isNative = nativeAmount !== undefined;

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs">
        <Coins className="h-3 w-3 shrink-0 text-yellow-500" />
        <span className="flex-1 truncate">{name}</span>
        {isNative && (
          <span className="text-muted-foreground/50 shrink-0 font-mono">base:{nativeAmount}</span>
        )}
        <span className={cn("font-mono shrink-0", balance >= 0 ? "text-green-500" : "text-red-500")}>
          {balance}
        </span>
        {isNative && !editing && (
          <button type="button" onClick={() => { setEditVal(String(nativeAmount)); setEditing(true); }}
            className="text-muted-foreground hover:text-foreground" title="Edit base amount">
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {isNative && (
          <button type="button" onClick={onRemoveNative}
            className="text-muted-foreground hover:text-destructive" title="Remove currency">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground" title="Show history">
          {open ? <ChevronUp className="h-3 w-3" /> : <History className="h-3 w-3" />}
        </button>
      </div>
      {editing && (
        <div className="flex items-center gap-1.5 ml-5 mt-1">
          <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
            className="w-16 h-6 text-xs rounded border border-border bg-background px-1.5" />
          <button type="button" className="text-xs text-primary hover:underline"
            onClick={() => { onNativeChange?.(parseInt(editVal, 10) || 0); setEditing(false); }}>
            Save
          </button>
          <button type="button" className="text-xs text-muted-foreground hover:underline"
            onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}
      {open && (
        <div className="ml-5 mt-1 mb-1 border-l border-border/50 pl-2 space-y-0.5">
          {isFetching && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isFetching && log.length === 0 && <p className="text-xs text-muted-foreground">No command history</p>}
          {log.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1 truncate">{entry.scene_title}</span>
              <span className={cn("font-mono shrink-0", entry.delta >= 0 ? "text-green-500" : "text-red-400")}>
                {entry.delta >= 0 ? "+" : ""}{entry.delta}
              </span>
              <span className="font-mono shrink-0 text-foreground/60">→ {entry.balance}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryItemRow({
  characterId, itemId, itemName, qty,
  nativeQty, onNativeChange, onRemoveNative, onOpenEntry,
}: {
  characterId: number; itemId: number; itemName: string; qty: number;
  nativeQty?: number;
  onNativeChange?: (qty: number) => void;
  onRemoveNative?: () => void;
  onOpenEntry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const { data: log = [], isFetching } = useCharacterItemLog(open ? characterId : 0, itemId);
  const isNative = nativeQty !== undefined;

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs">
        <Package className="h-3 w-3 shrink-0 text-blue-400" />
        {onOpenEntry ? (
          <button
            type="button"
            onClick={onOpenEntry}
            className="flex-1 truncate text-left hover:underline hover:text-foreground text-muted-foreground/90 transition-colors"
          >
            {itemName}
          </button>
        ) : (
          <span className="flex-1 truncate">{itemName}</span>
        )}
        {isNative && (
          <span className="text-muted-foreground/50 shrink-0 font-mono">base:{nativeQty}</span>
        )}
        <span className={cn("font-mono shrink-0", qty > 0 ? "text-green-500" : qty === 0 ? "text-muted-foreground" : "text-red-500")}>
          ×{qty}
        </span>
        {isNative && !editing && (
          <button type="button" onClick={() => { setEditVal(String(nativeQty)); setEditing(true); }}
            className="text-muted-foreground hover:text-foreground" title="Edit base quantity">
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {isNative && (
          <button type="button" onClick={onRemoveNative}
            className="text-muted-foreground hover:text-destructive" title="Remove from inventory">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground" title="Show history">
          {open ? <ChevronUp className="h-3 w-3" /> : <History className="h-3 w-3" />}
        </button>
      </div>
      {editing && (
        <div className="flex items-center gap-1.5 ml-5 mt-1">
          <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
            className="w-16 h-6 text-xs rounded border border-border bg-background px-1.5" />
          <button type="button" className="text-xs text-primary hover:underline"
            onClick={() => { onNativeChange?.(parseInt(editVal, 10) || 0); setEditing(false); }}>
            Save
          </button>
          <button type="button" className="text-xs text-muted-foreground hover:underline"
            onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}
      {open && (
        <div className="ml-5 mt-1 mb-1 border-l border-border/50 pl-2 space-y-0.5">
          {isFetching && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isFetching && log.length === 0 && <p className="text-xs text-muted-foreground">No command history</p>}
          {log.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1 truncate">{entry.scene_title}</span>
              <span className={cn("font-mono shrink-0", entry.delta >= 0 ? "text-green-500" : "text-red-400")}>
                {entry.delta >= 0 ? "+" : ""}{entry.delta}
              </span>
              <span className="font-mono shrink-0 text-foreground/60">→ ×{entry.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CodexEntry>) => void;
  initial?: Partial<CodexEntry>;
  title: string;
  /** All codex entries for the project (for the relation target dropdown and group suggestions) */
  allEntries?: CodexEntry[];
  /** Called when the user clicks an inventory item name to jump to its entry */
  onOpenEntry?: (id: number) => void;
}

export function CodexEntryDialog({
  open, onClose, onSave, initial, title, allEntries = [], onOpenEntry,
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

  // Name generator
  const [nameType, setNameType]       = useState<NameType | "">((initial?.name_type ?? "") as NameType | "");

  // Native inventory (manually set base quantities)
  const [nativePossessions, setNativePossessions] = useState<{ entry_id: number; quantity: number }[]>(
    initial?.inventory?.possessions?.map(p => ({ entry_id: p.entry_id, quantity: p.quantity })) ?? []
  );
  const [nativeCurrencies, setNativeCurrencies] = useState<{ name: string; amount: number }[]>(
    initial?.inventory?.currencies?.map(c => ({ name: c.name, amount: c.amount })) ?? []
  );
  // Add-item UI state
  const [addItemId, setAddItemId]       = useState("");
  const [addItemQty, setAddItemQty]     = useState("1");
  // Add-currency UI state
  const [addCurrencyName, setAddCurrencyName]     = useState("");
  const [addCurrencyAmount, setAddCurrencyAmount] = useState("0");

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
      setNameType((initial?.name_type ?? "") as NameType | "");
      setNativePossessions(
        initial?.inventory?.possessions?.map(p => ({ entry_id: p.entry_id, quantity: p.quantity })) ?? []
      );
      setNativeCurrencies(
        initial?.inventory?.currencies?.map(c => ({ name: c.name, amount: c.amount })) ?? []
      );
      setAddItemId("");
      setAddItemQty("1");
      setAddCurrencyName("");
      setAddCurrencyAmount("0");
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
      // Native inventory: base quantities manually set here.
      // Command deltas are computed on-the-fly and not stored here.
      inventory: entryType === "character"
        ? { possessions: nativePossessions, currencies: nativeCurrencies }
        : null,
      name_type: nameType || null,
    });
    onClose();
  };

  // Other entries that are not this one, for relation target dropdown
  const otherEntries = allEntries.filter((e) => e.id !== entryId);

  // Name generator: fall back to species entry's name_type if user hasn't picked one
  const speciesEntry = entryType === "character" && species.trim()
    ? allEntries.find(e => e.name.toLowerCase() === species.trim().toLowerCase())
    : null;
  const effectiveNameType: NameType | "" = nameType || ((speciesEntry?.name_type ?? "") as NameType | "");

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

              {/* Name generator */}
              <div className="space-y-1.5">
                <Label>Name Generator</Label>
                <NameGeneratorWidget
                  nameType={effectiveNameType}
                  onNameTypeChange={(t) => setNameType(t)}
                  onApply={(n) => setName(n)}
                />
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

              {/* Inventory — character only */}
              {entryType === "character" && isExisting && (() => {
                // Merge inventorySummary with unsaved native entries not yet reflected in summary
                const summaryItemIds  = new Set((inventorySummary?.items     ?? []).map(i => i.item_id));
                const summaryCurrencyNames = new Set((inventorySummary?.currencies ?? []).map(c => c.name));

                const allCurrencyRows = [
                  ...(inventorySummary?.currencies ?? []),
                  ...nativeCurrencies.filter(c => !summaryCurrencyNames.has(c.name))
                    .map(c => ({ name: c.name, balance: c.amount })),
                ];
                const allItemRows = [
                  ...(inventorySummary?.items ?? []),
                  ...nativePossessions.filter(p => !summaryItemIds.has(p.entry_id))
                    .map(p => ({ item_id: p.entry_id, qty: p.quantity })),
                ];

                // Addable items: codex entries of type "item" not already natively tracked
                const nativeItemIds = new Set(nativePossessions.map(p => p.entry_id));
                const addableItems  = allEntries.filter(e => e.entry_type === "item" && !nativeItemIds.has(e.id));

                return (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <Label className="text-sm font-medium">{t("entry_inventory")}</Label>

                    {/* Currency rows */}
                    {allCurrencyRows.length > 0 && (
                      <div className="space-y-1">
                        {allCurrencyRows.map(({ name, balance }) => {
                          const nat = nativeCurrencies.find(c => c.name === name);
                          return (
                            <InventoryCurrencyRow
                              key={name}
                              characterId={entryId}
                              name={name}
                              balance={balance}
                              nativeAmount={nat?.amount}
                              onNativeChange={amount =>
                                setNativeCurrencies(prev => prev.map(c => c.name === name ? { ...c, amount } : c))
                              }
                              onRemoveNative={() =>
                                setNativeCurrencies(prev => prev.filter(c => c.name !== name))
                              }
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Item rows */}
                    {allItemRows.length > 0 && (
                      <div className="space-y-1">
                        {allItemRows.map(({ item_id, qty }) => {
                          const nat       = nativePossessions.find(p => p.entry_id === item_id);
                          const itemEntry = allEntries.find(e => e.id === item_id);
                          return (
                            <InventoryItemRow
                              key={item_id}
                              characterId={entryId}
                              itemId={item_id}
                              itemName={itemEntry?.name ?? `Item #${item_id}`}
                              qty={qty}
                              nativeQty={nat?.quantity}
                              onNativeChange={quantity =>
                                setNativePossessions(prev => prev.map(p => p.entry_id === item_id ? { ...p, quantity } : p))
                              }
                              onRemoveNative={() =>
                                setNativePossessions(prev => prev.filter(p => p.entry_id !== item_id))
                              }
                              onOpenEntry={itemEntry && onOpenEntry ? () => onOpenEntry(item_id) : undefined}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Add native currency */}
                    <div className="flex gap-1.5 items-center pt-1 border-t border-border/40">
                      <Coins className="h-3 w-3 shrink-0 text-yellow-500" />
                      <input
                        type="text"
                        value={addCurrencyName}
                        onChange={e => setAddCurrencyName(e.target.value)}
                        placeholder="Currency name…"
                        className="flex-1 h-6 text-xs rounded border border-border bg-background px-1.5 min-w-0"
                      />
                      <input
                        type="number"
                        value={addCurrencyAmount}
                        onChange={e => setAddCurrencyAmount(e.target.value)}
                        className="w-14 h-6 text-xs rounded border border-border bg-background px-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const n = addCurrencyName.trim();
                          if (!n || nativeCurrencies.find(c => c.name === n)) return;
                          setNativeCurrencies(prev => [...prev, { name: n, amount: parseInt(addCurrencyAmount, 10) || 0 }]);
                          setAddCurrencyName("");
                          setAddCurrencyAmount("0");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Add currency"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Add native item */}
                    {addableItems.length > 0 && (
                      <div className="flex gap-1.5 items-center">
                        <Package className="h-3 w-3 shrink-0 text-blue-400" />
                        <select
                          value={addItemId}
                          onChange={e => setAddItemId(e.target.value)}
                          className="flex-1 h-6 text-xs rounded border border-border bg-background px-1 min-w-0"
                        >
                          <option value="">Select item…</option>
                          {addableItems.map(e => (
                            <option key={e.id} value={String(e.id)}>{e.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={addItemQty}
                          onChange={e => setAddItemQty(e.target.value)}
                          className="w-14 h-6 text-xs rounded border border-border bg-background px-1.5"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const id = parseInt(addItemId, 10);
                            if (!id) return;
                            setNativePossessions(prev => [...prev, { entry_id: id, quantity: parseInt(addItemQty, 10) || 1 }]);
                            setAddItemId("");
                            setAddItemQty("1");
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Add item"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

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

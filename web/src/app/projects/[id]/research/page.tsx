"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Trash2, Link as LinkIcon, FileText, Tag, X, Loader2,
  ExternalLink, RefreshCw, Film, Camera, ImageOff,
} from "lucide-react";
import { useResearch, useCreateResearch, useUpdateResearch, useDeleteResearch, useRefetchResearchUrl, useUploadResearchImage, useDeleteResearchImage } from "@/store/queries";
import { imagesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResearchItem } from "@/types";
import { cn } from "@/lib/utils";

// ── Add / Edit dialog ─────────────────────────────────────────────────────────

function ClippingDialog({
  open, onClose, projectId, initial,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  initial?: ResearchItem | null;
}) {
  const [title, setTitle]       = useState(initial?.title ?? "");
  const [url, setUrl]           = useState(initial?.url ?? "");
  const [text, setText]         = useState(initial?.text_content ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState<string[]>(initial?.tags ?? []);
  const [saving, setSaving]     = useState(false);

  const createResearch = useCreateResearch(projectId);
  const updateResearch = useUpdateResearch(projectId);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        text_content: text.trim() || undefined,
        tags,
      };
      if (initial) {
        await updateResearch.mutateAsync({ id: initial.id, data: payload });
      } else {
        await createResearch.mutateAsync(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Clipping" : "Add Clipping"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Label this clipping…" />
          </div>

          <div className="space-y-1.5">
            <Label>URL (optional)</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" type="url" />
            <p className="text-xs text-muted-foreground">Title and preview will be auto-fetched from the page.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Text excerpt (optional)</Label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste a passage, quote, or note…"
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag…"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    #{t}
                    <button onClick={() => setTags(tags.filter(x => x !== t))}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!title.trim() && !url.trim() && !text.trim())}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initial ? "Save" : "Add Clipping"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Clipping card ─────────────────────────────────────────────────────────────

function ClippingCard({
  item, projectId, onEdit,
}: { item: ResearchItem; projectId: number; onEdit: (item: ResearchItem) => void }) {
  const deleteItem   = useDeleteResearch(projectId);
  const refetchUrl   = useRefetchResearchUrl(projectId);
  const uploadImage  = useUploadResearchImage(projectId);
  const deleteImage  = useDeleteResearchImage(projectId);

  const displayTitle = item.title || item.url_title || item.url || "Untitled";
  // User-uploaded image takes priority over auto-fetched URL preview
  const previewImage = item.image_path ? imagesApi.url(item.image_path) : item.url_image ?? null;

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = () => {
      if (input.files?.[0]) uploadImage.mutate({ id: item.id, file: input.files[0] });
    };
    input.click();
  };

  return (
    <div className="group bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-border/60 hover:shadow-sm transition-all">
      {/* Image preview (uploaded takes priority over URL og:image) */}
      {previewImage ? (
        <div className="relative rounded-md overflow-hidden bg-secondary/30 h-32">
          <img src={previewImage} alt="" className="w-full h-full object-cover" />
          {/* Overlay controls — visible on hover */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
            <button
              className="p-1.5 rounded bg-black/60 text-white hover:bg-black/80"
              title="Replace image"
              onClick={handleImageUpload}
              disabled={uploadImage.isPending}
            >
              {uploadImage.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Camera className="h-3.5 w-3.5" />}
            </button>
            {/* Only show delete for user-uploaded images, not URL previews */}
            {item.image_path && (
              <button
                className="p-1.5 rounded bg-black/60 text-white hover:bg-red-600/80"
                title="Remove uploaded image"
                onClick={() => deleteImage.mutate(item.id)}
                disabled={deleteImage.isPending}
              >
                <ImageOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* No image yet — show an upload affordance on hover */
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 flex items-center justify-center"
        >
          <button
            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground"
            onClick={handleImageUpload}
            disabled={uploadImage.isPending}
          >
            {uploadImage.isPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Camera className="h-3 w-3" />}
            Add image
          </button>
        </div>
      )}

      {/* Title + actions */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug line-clamp-2">{displayTitle}</p>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary mt-0.5 truncate max-w-full"
            >
              <LinkIcon className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{item.url}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0 transition-opacity">
          {item.url && (
            <button
              className="p-1 hover:text-primary text-muted-foreground rounded"
              title="Re-fetch URL metadata"
              onClick={() => refetchUrl.mutate(item.id)}
              disabled={refetchUrl.isPending}
            >
              <RefreshCw className={cn("h-3 w-3", refetchUrl.isPending && "animate-spin")} />
            </button>
          )}
          <button
            className="p-1 hover:text-primary text-muted-foreground rounded"
            onClick={() => onEdit(item)}
          >
            <FileText className="h-3 w-3" />
          </button>
          <button
            className="p-1 hover:text-destructive text-muted-foreground rounded"
            onClick={() => { if (confirm("Delete this clipping?")) deleteItem.mutate(item.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* URL description */}
      {item.url_description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{item.url_description}</p>
      )}

      {/* Text excerpt */}
      {item.text_content && (
        <blockquote className="border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground italic line-clamp-4">
          {item.text_content}
        </blockquote>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map(t => (
            <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0 rounded-full">#{t}</span>
          ))}
        </div>
      )}

      {/* Link chips */}
      <div className="flex flex-wrap gap-1 mt-auto">
        {item.linked_scene_id && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            <Film className="h-2.5 w-2.5" /> Scene #{item.linked_scene_id}
          </span>
        )}
        {item.linked_codex_id && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            <Tag className="h-2.5 w-2.5" /> Codex #{item.linked_codex_id}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { id }      = useParams();
  const projectId   = Number(id);
  const { data: items = [], isLoading } = useResearch(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<ResearchItem | null>(null);
  const [search, setSearch]         = useState("");
  const [tagFilter, setTagFilter]   = useState<string[]>([]);

  const allTags = [...new Set(items.flatMap(i => i.tags))].sort();

  const filtered = items.filter(item => {
    if (tagFilter.length > 0 && !tagFilter.every(t => item.tags.includes(t))) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.url_title?.toLowerCase().includes(q) ||
        item.url?.toLowerCase().includes(q) ||
        item.text_content?.toLowerCase().includes(q) ||
        item.tags.some(t => t.includes(q))
      );
    }
    return true;
  });

  const openEdit = (item: ResearchItem) => { setEditing(item); setDialogOpen(true); };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Research</h1>
          <p className="text-xs text-muted-foreground">
            {items.length} clipping{items.length !== 1 ? "s" : ""}
            {filtered.length !== items.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Clipping
        </Button>
      </header>

      {/* Filter bar */}
      {(items.length > 0 || search) && (
        <div className="px-6 py-2 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
          <Input
            className="max-w-xs h-8 text-sm"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-colors",
                tagFilter.includes(tag)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              #{tag}
            </button>
          ))}
          {(search || tagFilter.length > 0) && (
            <button
              onClick={() => { setSearch(""); setTagFilter([]); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-lg bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {items.length === 0
              ? "No clippings yet. Add URLs, text excerpts, or notes to keep research alongside your manuscript."
              : "No clippings match your filter."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <ClippingCard key={item.id} item={item} projectId={projectId} onEdit={openEdit} />
            ))}
          </div>
        )}
      </div>

      <ClippingDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        projectId={projectId}
        initial={editing}
      />
    </div>
  );
}

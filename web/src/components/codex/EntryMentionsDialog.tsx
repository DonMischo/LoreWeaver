"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEntrySceneMentions, useRescanProjectMentions } from "@/store/queries";
import { scenesApi } from "@/lib/api";
import type { CodexEntry, SceneMentionStat } from "@/types";
import { cn } from "@/lib/utils";

// ── Excerpt extraction ────────────────────────────────────────────────────────

interface Excerpt {
  before: string;
  match: string;
  after: string;
}

function extractExcerpts(html: string, names: string[]): Excerpt[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const escaped = names
    .filter(Boolean)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return [];

  const pattern = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
  const results: Excerpt[] = [];
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    const s = Math.max(0, m.index - 90);
    const e = Math.min(text.length, m.index + m[0].length + 90);
    results.push({
      before: (s > 0 ? "…" : "") + text.slice(s, m.index),
      match:  m[0],
      after:  text.slice(m.index + m[0].length, e) + (e < text.length ? "…" : ""),
    });
  }
  return results;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entry: CodexEntry;
  open: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EntryMentionsDialog({ entry, open, onClose }: Props) {
  const router  = useRouter();
  const rescan  = useRescanProjectMentions(entry.project_id);
  const { data: stats = [], isLoading, refetch } = useEntrySceneMentions(open ? entry.id : 0);

  const [selected, setSelected]   = useState<SceneMentionStat | null>(null);
  const [excerpts, setExcerpts]   = useState<Excerpt[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);

  // Rescan all project scenes whenever the dialog opens so stats are always fresh.
  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setExcerpts([]);
    rescan.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const maxCount = Math.max(...stats.map((s) => s.count), 1);
  const names    = [entry.name, ...entry.aliases].filter(Boolean);

  async function handleSelectScene(stat: SceneMentionStat) {
    setSelected(stat);
    setExcerpts([]);
    setLoadingEx(true);
    try {
      const scene = await scenesApi.get(stat.scene_id);
      setExcerpts(extractExcerpts(scene.content ?? "", names));
    } finally {
      setLoadingEx(false);
    }
  }

  function handleOpenScene(stat: SceneMentionStat) {
    router.push(`/projects/${entry.project_id}/scenes/${stat.scene_id}`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
            <span className="text-muted-foreground font-normal text-sm">— mentions across scenes</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: bar chart ────────────────────────────────────────────── */}
          <div className="w-1/2 border-r border-border overflow-y-auto p-3 space-y-1 shrink-0">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && stats.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No mentions recorded yet.<br />
                <span className="opacity-70">Save a scene to update counts.</span>
              </p>
            )}

            {!isLoading && stats.map((stat) => (
              <button
                key={stat.scene_id}
                onClick={() => handleSelectScene(stat)}
                className={cn(
                  "w-full text-left rounded px-2 py-1.5 transition-colors group",
                  selected?.scene_id === stat.scene_id
                    ? "bg-primary/10"
                    : "hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium truncate flex-1 leading-tight">
                    {stat.scene_title}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                    {stat.count}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Bar */}
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        selected?.scene_id === stat.scene_id ? "bg-primary" : "bg-primary/50"
                      )}
                      style={{ width: `${(stat.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {stat.act_title} › {stat.chapter_title}
                </p>
              </button>
            ))}
          </div>

          {/* ── Right: excerpts ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 min-w-0">
            {!selected && (
              <p className="text-xs text-muted-foreground pt-4 text-center">
                ← Select a scene to see excerpts
              </p>
            )}

            {selected && (
              <>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{selected.scene_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.act_title} › {selected.chapter_title}
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenScene(selected)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                  >
                    Open scene
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                {loadingEx && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!loadingEx && excerpts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No text excerpts found.</p>
                )}

                {!loadingEx && excerpts.length > 0 && (
                  <div className="space-y-2">
                    {excerpts.map((ex, i) => (
                      <p
                        key={i}
                        className="text-xs leading-relaxed text-muted-foreground bg-muted/40 rounded px-2.5 py-2"
                      >
                        {ex.before}
                        <mark className="bg-primary/25 text-foreground rounded px-0.5 not-italic font-medium">
                          {ex.match}
                        </mark>
                        {ex.after}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

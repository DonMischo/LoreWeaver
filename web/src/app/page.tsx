"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2, Calendar, FileText, BookCopy, Sparkles, TriangleAlert, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useProjects, useCreateProject, useDeleteProject } from "@/store/queries";
import { cn } from "@/lib/utils";

type CodexOption = "fresh" | "copy" | "share";

interface DeleteTarget { id: number; title: string }

export default function Dashboard() {
  const router = useRouter();
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [codexOption, setCodexOption] = useState<CodexOption>("fresh");
  const [copyFromId, setCopyFromId] = useState<number | "">("");
  const [shareFromId, setShareFromId] = useState<number | "">("");

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const otherProjects = projects; // all projects available as copy sources

  const handleOpen = () => {
    setTitle("");
    setDescription("");
    setCodexOption("fresh");
    setCopyFromId("");
    setShareFromId("");
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    const payload: { title: string; description?: string; copy_codex_from?: number; share_codex_from?: number } = {
      title: title.trim(),
      description: description.trim() || undefined,
    };
    if (codexOption === "copy" && copyFromId !== "") {
      payload.copy_codex_from = Number(copyFromId);
    }
    if (codexOption === "share" && shareFromId !== "") {
      payload.share_codex_from = Number(shareFromId);
    }
    const project = await createProject.mutateAsync(payload);
    setDialogOpen(false);
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">LoreWeaver</h1>
        </div>
        <Button onClick={handleOpen} size="sm">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6 text-sm">Create your first project to start writing.</p>
            <Button onClick={handleOpen}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors"
              >
                <Link href={`/projects/${project.id}`} className="block">
                  <div className="flex items-start gap-3 mb-3">
                    <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{project.title}</h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                    {project.shared_codex_project_id && (
                      <span className="flex items-center gap-1 text-primary/70">
                        <Link2 className="h-3 w-3" />
                        Shared codex
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget({ id: project.id, title: project.title });
                    setDeleteConfirm("");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center pb-4 pt-2">
        <a
          href="https://tanstack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" rx="48" fill="currentColor"/>
            <path d="M64 80h128M128 80v96" stroke="white" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Powered by TanStack
        </a>
      </footer>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Give your story a title to get started.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="My Novel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="desc"
                placeholder="A brief synopsis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Codex option */}
            <div className="space-y-2">
              <Label>Codex</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCodexOption("fresh")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    codexOption === "fresh"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="font-medium">Fresh codex</span>
                  <span className="text-[10px] opacity-70 text-center">Start with an empty world bible</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodexOption("copy")}
                  disabled={otherProjects.length === 0}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    codexOption === "copy"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
                    otherProjects.length === 0 && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <BookCopy className="h-5 w-5" />
                  <span className="font-medium">Copy codex</span>
                  <span className="text-[10px] opacity-70 text-center">Independent snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodexOption("share")}
                  disabled={otherProjects.length === 0}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    codexOption === "share"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
                    otherProjects.length === 0 && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <Link2 className="h-5 w-5" />
                  <span className="font-medium">Share codex</span>
                  <span className="text-[10px] opacity-70 text-center">Live link — same world</span>
                </button>
              </div>

              {codexOption === "copy" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Copy codex from</Label>
                  <select
                    value={copyFromId}
                    onChange={(e) => setCopyFromId(e.target.value === "" ? "" : Number(e.target.value))}
                    className={cn(
                      "w-full h-9 rounded-md border border-input bg-background px-3 text-sm",
                      "focus:outline-none focus:ring-1 focus:ring-ring"
                    )}
                  >
                    <option value="">— select a project —</option>
                    {otherProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    All entries and relations are copied. Changes won't affect the original.
                  </p>
                </div>
              )}

              {codexOption === "share" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Share codex from</Label>
                  <select
                    value={shareFromId}
                    onChange={(e) => setShareFromId(e.target.value === "" ? "" : Number(e.target.value))}
                    className={cn(
                      "w-full h-9 rounded-md border border-input bg-background px-3 text-sm",
                      "focus:outline-none focus:ring-1 focus:ring-ring"
                    )}
                  >
                    <option value="">— select a project —</option>
                    {otherProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Both projects see the same codex entries. The timeline will span all shared projects.
                    The source project cannot be deleted while this link exists.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !title.trim() ||
                  createProject.isPending ||
                  (codexOption === "copy" && copyFromId === "") ||
                  (codexOption === "share" && shareFromId === "")
                }
              >
                {createProject.isPending ? "Creating…" : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirm(""); setDeleteError(null); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              Delete project
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong className="text-foreground">{deleteTarget?.title}</strong> and all its acts, chapters, scenes, and codex entries. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {deleteError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {deleteError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm
              </Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && deleteConfirm === "DELETE" && deleteTarget) {
                    try {
                      await deleteProject.mutateAsync(deleteTarget.id);
                      setDeleteTarget(null);
                      setDeleteConfirm("");
                      setDeleteError(null);
                    } catch (err) {
                      setDeleteError(err instanceof Error ? err.message.replace(/^\d+: /, "") : "Delete failed.");
                    }
                  }
                }}
                placeholder="DELETE"
                autoFocus
                className="font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteError(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== "DELETE" || deleteProject.isPending}
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    await deleteProject.mutateAsync(deleteTarget.id);
                    setDeleteTarget(null);
                    setDeleteConfirm("");
                    setDeleteError(null);
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message.replace(/^\d+: /, "") : "Delete failed.");
                  }
                }}
              >
                Delete project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

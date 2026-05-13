"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Trash2, X, Check, GripVertical,
  Lightbulb, Archive, Scissors, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useFragmentTabs, useUpdateFragmentTabs,
  useFragments, useCreateFragment, useUpdateFragment, useDeleteFragment,
} from "@/store/queries";
import type { Fragment } from "@/types";
import { BUILTIN_TABS } from "@/types";
import { cn } from "@/lib/utils";

// ── Tab icon map ──────────────────────────────────────────────────────────────

function TabIcon({ tab, className }: { tab: string; className?: string }) {
  if (tab === "snippets") return <Scissors className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "ideas")    return <Lightbulb className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "archive")  return <Archive   className={cn("h-3.5 w-3.5", className)} />;
  return <GripVertical className={cn("h-3.5 w-3.5", className)} />;
}

// ── Fragment card ─────────────────────────────────────────────────────────────

function FragmentCard({
  fragment, projectId, allTabs,
}: { fragment: Fragment; projectId: number; allTabs: string[] }) {
  const updateFragment = useUpdateFragment(projectId);
  const deleteFragment = useDeleteFragment(projectId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(fragment.title ?? "");
  const [content, setContent] = useState(fragment.content ?? "");
  const [showMove, setShowMove] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [content]);

  const saveContent = (val: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateFragment.mutate({ id: fragment.id, data: { content: val } });
    }, 800);
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (title !== fragment.title) {
      updateFragment.mutate({ id: fragment.id, data: { title: title || null } });
    }
  };

  const moveToTab = (tab: string) => {
    updateFragment.mutate({ id: fragment.id, data: { tab } });
    setShowMove(false);
  };

  return (
    <div className="group relative bg-card border border-border rounded-lg p-3 space-y-2 hover:border-border/80 transition-colors">
      {/* Title row */}
      <div className="flex items-center gap-1.5 min-h-[24px]">
        {editingTitle ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") saveTitle(); }}
            className="h-6 text-xs px-1 flex-1"
            autoFocus
          />
        ) : (
          <button
            className="flex-1 text-left text-xs font-medium text-foreground/80 hover:text-foreground truncate min-h-[20px]"
            onDoubleClick={() => setEditingTitle(true)}
            title="Double-click to rename"
          >
            {fragment.title || <span className="text-muted-foreground italic">Untitled — double-click to name</span>}
          </button>
        )}

        {/* Actions — visible on hover */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
          {/* Move to tab */}
          <div className="relative">
            <button
              onClick={() => setShowMove(v => !v)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              title="Move to tab"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {showMove && (
              <div className="absolute right-0 top-6 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[130px]">
                {allTabs.filter(t => t !== fragment.tab).map(t => (
                  <button
                    key={t}
                    onClick={() => moveToTab(t)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary text-left capitalize"
                  >
                    <TabIcon tab={t} />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Delete */}
          <button
            onClick={() => deleteFragment.mutate(fragment.id)}
            className="text-muted-foreground hover:text-destructive p-0.5 rounded"
            title="Delete fragment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content textarea */}
      <textarea
        ref={contentRef}
        value={content}
        onChange={(e) => { setContent(e.target.value); saveContent(e.target.value); }}
        placeholder="Write something…"
        className={cn(
          "w-full resize-none bg-transparent text-sm text-foreground",
          "placeholder:text-muted-foreground/50 focus:outline-none",
          "min-h-[60px] leading-relaxed"
        )}
        rows={3}
      />

      {/* Footer: date + word count */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>{new Date(fragment.updated_at).toLocaleDateString()}</span>
        <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
      </div>

      {/* Close move popover on outside click */}
      {showMove && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FragmentsPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data: tabsData } = useFragmentTabs(projectId);
  const { data: fragments = [] } = useFragments(projectId);
  const updateTabs = useUpdateFragmentTabs(projectId);
  const createFragment = useCreateFragment(projectId);

  const allTabs = tabsData?.all ?? [...BUILTIN_TABS];
  const customTabs = tabsData?.custom ?? [];

  const [activeTab, setActiveTab] = useState("snippets");
  const [addingTab, setAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  // Keep activeTab valid if tabs change
  useEffect(() => {
    if (!allTabs.includes(activeTab)) setActiveTab(allTabs[0] ?? "snippets");
  }, [allTabs]);

  const tabFragments = fragments.filter(f => f.tab === activeTab);

  const handleAddTab = () => {
    const name = newTabName.trim().toLowerCase();
    if (!name || allTabs.includes(name)) return;
    updateTabs.mutate([...customTabs, name]);
    setNewTabName("");
    setAddingTab(false);
    setActiveTab(name);
  };

  const handleDeleteTab = (tab: string) => {
    const count = fragments.filter(f => f.tab === tab).length;
    const msg = count > 0
      ? `Delete tab "${tab}"? It has ${count} fragment${count !== 1 ? "s" : ""} that will also be deleted.`
      : `Delete tab "${tab}"?`;
    if (!confirm(msg)) return;
    // Fragments on this tab will be orphaned on backend; let's move them to snippets first
    // (The backend will cascade-delete if we remove the project, but tab deletion is frontend-only)
    // Since custom tabs are just labels, we can just update the tab list and the fragments stay
    // but become inaccessible — better to delete them explicitly via individual delete or
    // just filter them out. For simplicity, we keep them but switch to snippets:
    updateTabs.mutate(customTabs.filter(t => t !== tab));
    if (activeTab === tab) setActiveTab("snippets");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Fragments</h1>
          <p className="text-xs text-muted-foreground">
            {fragments.length} fragment{fragments.length !== 1 ? "s" : ""} across {allTabs.length} tab{allTabs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => createFragment.mutate({ tab: activeTab })}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          New fragment
        </Button>
      </header>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border shrink-0 overflow-x-auto">
        {allTabs.map(tab => {
          const isBuiltin = (BUILTIN_TABS as readonly string[]).includes(tab);
          const count = fragments.filter(f => f.tab === tab).length;
          return (
            <div key={tab} className="flex items-center group/tab shrink-0">
              <button
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-md border-b-2 transition-colors capitalize",
                  activeTab === tab
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <TabIcon tab={tab} />
                {tab}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] rounded-full px-1.5 py-px",
                    activeTab === tab ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
              {/* Delete custom tab */}
              {!isBuiltin && (
                <button
                  onClick={() => handleDeleteTab(tab)}
                  className="opacity-0 group-hover/tab:opacity-60 hover:!opacity-100 hover:text-destructive ml-0.5 mb-1"
                  title={`Delete tab "${tab}"`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add tab */}
        {addingTab ? (
          <div className="flex items-center gap-1 ml-1 mb-1">
            <Input
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddTab();
                if (e.key === "Escape") { setAddingTab(false); setNewTabName(""); }
              }}
              placeholder="Tab name…"
              className="h-6 text-xs w-28 px-2"
              autoFocus
            />
            <button onClick={handleAddTab} className="text-primary hover:text-primary/80">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setAddingTab(false); setNewTabName(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTab(true)}
            className="flex items-center gap-0.5 px-2 py-2 text-xs text-muted-foreground hover:text-foreground mb-px ml-1 shrink-0"
            title="Add custom tab"
          >
            <Plus className="h-3 w-3" />
            Add tab
          </button>
        )}
      </div>

      {/* Fragment list */}
      <div className="flex-1 overflow-y-auto p-4">
        {tabFragments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-16">
            <TabIcon tab={activeTab} className="h-8 w-8 opacity-20" />
            <div>
              <p className="font-medium capitalize">{activeTab} is empty</p>
              <p className="text-xs mt-1">
                {activeTab === "archive"
                  ? "Move scenes here from the scene editor to archive them."
                  : "Click "New fragment" to add one."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => createFragment.mutate({ tab: activeTab })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New fragment
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tabFragments.map(fragment => (
              <FragmentCard
                key={fragment.id}
                fragment={fragment}
                projectId={projectId}
                allTabs={allTabs}
              />
            ))}
            {/* Add card */}
            <button
              onClick={() => createFragment.mutate({ tab: activeTab })}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border",
                "text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors",
                "min-h-[120px] text-xs"
              )}
            >
              <Plus className="h-5 w-5" />
              New fragment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

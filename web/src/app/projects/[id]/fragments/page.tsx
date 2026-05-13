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
import type { Fragment as FragmentItem } from "@/types";
import { BUILTIN_TABS } from "@/types";
import { cn } from "@/lib/utils";

// ── Tab icon ──────────────────────────────────────────────────────────────────

function TabIcon({ tab, className }: { tab: string; className?: string }) {
  if (tab === "snippets") return <Scissors className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "ideas")    return <Lightbulb className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "archive")  return <Archive   className={cn("h-3.5 w-3.5", className)} />;
  return <GripVertical className={cn("h-3.5 w-3.5", className)} />;
}

// ── Fragment card ─────────────────────────────────────────────────────────────

function FragmentCard({
  fragment,
  projectId,
  allTabs,
}: {
  fragment: FragmentItem;
  projectId: number;
  allTabs: string[];
}) {
  const updateFragment = useUpdateFragment(projectId);
  const deleteFragment = useDeleteFragment(projectId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(fragment.title ?? "");
  const [localContent, setLocalContent] = useState(fragment.content ?? "");
  const [showMove, setShowMove] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [localContent]);

  const scheduleContentSave = (val: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateFragment.mutate({ id: fragment.id, data: { content: val } });
    }, 800);
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const next = localTitle.trim() || null;
    if (next !== fragment.title) {
      updateFragment.mutate({ id: fragment.id, data: { title: next } });
    }
  };

  const moveToTab = (tab: string) => {
    updateFragment.mutate({ id: fragment.id, data: { tab } });
    setShowMove(false);
  };

  const wordCount = localContent.trim()
    ? localContent.trim().split(/\s+/).length
    : 0;

  return (
    <div className="group relative bg-card border border-border rounded-lg p-3 space-y-2 hover:border-border/80 transition-colors">
      {/* Title row */}
      <div className="flex items-center gap-1.5 min-h-[24px]">
        {editingTitle ? (
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") commitTitle();
            }}
            className="h-6 text-xs px-1 flex-1"
            autoFocus
          />
        ) : (
          <button
            className="flex-1 text-left text-xs font-medium text-foreground/80 hover:text-foreground truncate min-h-[20px]"
            onDoubleClick={() => setEditingTitle(true)}
            title="Double-click to rename"
          >
            {fragment.title ? (
              <span>{fragment.title}</span>
            ) : (
              <span className="text-muted-foreground italic">Untitled</span>
            )}
          </button>
        )}

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
          {/* Move to tab */}
          <div className="relative">
            <button
              onClick={() => setShowMove((v) => !v)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              title="Move to tab"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {showMove && (
              <div className="absolute right-0 top-6 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[130px]">
                {allTabs
                  .filter((t) => t !== fragment.tab)
                  .map((t) => (
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

      {/* Content */}
      <textarea
        ref={contentRef}
        value={localContent}
        onChange={(e) => {
          setLocalContent(e.target.value);
          scheduleContentSave(e.target.value);
        }}
        placeholder="Write something..."
        className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none min-h-[60px] leading-relaxed"
        rows={3}
      />

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>{new Date(fragment.updated_at).toLocaleDateString()}</span>
        <span>{wordCount} words</span>
      </div>

      {showMove && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowMove(false)}
        />
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

  const allTabs: string[] = tabsData?.all ?? (BUILTIN_TABS as unknown as string[]);
  const customTabs: string[] = tabsData?.custom ?? [];

  const [activeTab, setActiveTab] = useState("snippets");
  const [addingTab, setAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  useEffect(() => {
    if (allTabs.length > 0 && !allTabs.includes(activeTab)) {
      setActiveTab(allTabs[0]);
    }
  }, [allTabs, activeTab]);

  const tabFragments = fragments.filter((f) => f.tab === activeTab);

  const handleAddTab = () => {
    const name = newTabName.trim().toLowerCase();
    if (!name || allTabs.includes(name)) return;
    updateTabs.mutate([...customTabs, name]);
    setNewTabName("");
    setAddingTab(false);
    setActiveTab(name);
  };

  const handleDeleteTab = (tab: string) => {
    const count = fragments.filter((f) => f.tab === tab).length;
    const msg =
      count > 0
        ? `Delete tab "${tab}"? Its ${count} fragment(s) will become inaccessible.`
        : `Delete tab "${tab}"?`;
    if (!confirm(msg)) return;
    updateTabs.mutate(customTabs.filter((t) => t !== tab));
    if (activeTab === tab) setActiveTab("snippets");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Fragments</h1>
          <p className="text-xs text-muted-foreground">
            {fragments.length} fragment{fragments.length !== 1 ? "s" : ""} across{" "}
            {allTabs.length} tab{allTabs.length !== 1 ? "s" : ""}
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
        {allTabs.map((tab) => {
          const isBuiltin = (BUILTIN_TABS as readonly string[]).includes(tab);
          const count = fragments.filter((f) => f.tab === tab).length;
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
                  <span
                    className={cn(
                      "text-[10px] rounded-full px-1.5 py-px",
                      activeTab === tab
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
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
          <div className="flex items-center gap-1 ml-1 mb-1 shrink-0">
            <Input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTab();
                if (e.key === "Escape") {
                  setAddingTab(false);
                  setNewTabName("");
                }
              }}
              placeholder="Tab name..."
              className="h-6 text-xs w-28 px-2"
              autoFocus
            />
            <button
              onClick={handleAddTab}
              className="text-primary hover:text-primary/80"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setAddingTab(false);
                setNewTabName("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
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

      {/* Fragment grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {tabFragments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-16">
            <TabIcon tab={activeTab} className="h-8 w-8 opacity-20" />
            <div>
              <p className="font-medium capitalize">{activeTab} is empty</p>
              <p className="text-xs mt-1">
                {activeTab === "archive"
                  ? "Use the Archive button in the scene editor to send scenes here."
                  : "Click New fragment to add one."}
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
            {tabFragments.map((fragment) => (
              <FragmentCard
                key={fragment.id}
                fragment={fragment}
                projectId={projectId}
                allTabs={allTabs}
              />
            ))}
            <button
              onClick={() => createFragment.mutate({ tab: activeTab })}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[120px] text-xs"
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

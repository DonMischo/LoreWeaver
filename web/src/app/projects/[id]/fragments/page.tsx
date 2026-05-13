"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Trash2, X, Check, GripVertical,
  Lightbulb, Archive, Scissors, MoreHorizontal,
  LayoutGrid, List,
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
import { FragmentImportButton } from "@/components/fragments/FragmentImportButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and return plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Derive a display label for a fragment:
 * - Use title if set
 * - Otherwise use first sentence / phrase of content (up to ~60 chars)
 * - Fall back to "Untitled"
 */
function fragmentLabel(fragment: FragmentItem): { text: string; derived: boolean } {
  if (fragment.title) return { text: fragment.title, derived: false };
  const plain = stripHtml(fragment.content ?? "").trim();
  if (!plain) return { text: "Untitled", derived: false };
  // Take up to first sentence break or 60 chars
  const sentence = plain.split(/[.!?\n]/)[0].trim();
  const label = sentence.length > 60 ? sentence.slice(0, 60) + "…" : sentence;
  return { text: label || "Untitled", derived: true };
}

// ── Tab icon ──────────────────────────────────────────────────────────────────

function TabIcon({ tab, className }: { tab: string; className?: string }) {
  if (tab === "snippets") return <Scissors className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "ideas")    return <Lightbulb className={cn("h-3.5 w-3.5", className)} />;
  if (tab === "archive")  return <Archive   className={cn("h-3.5 w-3.5", className)} />;
  return <GripVertical className={cn("h-3.5 w-3.5", className)} />;
}

// ── Shared editing logic (hook) ───────────────────────────────────────────────

function useFragmentEdit(fragment: FragmentItem, projectId: number) {
  const updateFragment = useUpdateFragment(projectId);
  const deleteFragment = useDeleteFragment(projectId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(fragment.title ?? "");
  const [localContent, setLocalContent] = useState(fragment.content ?? "");
  const [showMove, setShowMove] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return {
    editingTitle, setEditingTitle,
    localTitle, setLocalTitle,
    localContent, setLocalContent,
    showMove, setShowMove,
    scheduleContentSave, commitTitle, moveToTab,
    wordCount,
    deleteFragment,
  };
}

// ── Fragment card (grid view) ─────────────────────────────────────────────────

function FragmentCard({
  fragment,
  projectId,
  allTabs,
}: {
  fragment: FragmentItem;
  projectId: number;
  allTabs: string[];
}) {
  const {
    editingTitle, setEditingTitle,
    localTitle, setLocalTitle,
    localContent, setLocalContent,
    showMove, setShowMove,
    scheduleContentSave, commitTitle, moveToTab,
    wordCount, deleteFragment,
  } = useFragmentEdit(fragment, projectId);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [localContent]);

  const { text: labelText, derived } = fragmentLabel({ ...fragment, title: fragment.title });

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
            className="flex-1 text-left text-xs font-medium truncate min-h-[20px]"
            onDoubleClick={() => setEditingTitle(true)}
            title="Double-click to rename"
          >
            {fragment.title ? (
              <span className="text-foreground/80 hover:text-foreground">{fragment.title}</span>
            ) : (
              <span className="text-muted-foreground italic">{derived ? labelText : "Untitled"}</span>
            )}
          </button>
        )}

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
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
        <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
      )}
    </div>
  );
}

// ── Fragment row (list view) ──────────────────────────────────────────────────

function FragmentRow({
  fragment,
  projectId,
  allTabs,
  expanded,
  onToggle,
}: {
  fragment: FragmentItem;
  projectId: number;
  allTabs: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const {
    editingTitle, setEditingTitle,
    localTitle, setLocalTitle,
    localContent, setLocalContent,
    showMove, setShowMove,
    scheduleContentSave, commitTitle, moveToTab,
    wordCount, deleteFragment,
  } = useFragmentEdit(fragment, projectId);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const el = contentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [localContent, expanded]);

  const { text: labelText, derived } = fragmentLabel(fragment);

  const preview = (() => {
    const plain = stripHtml(fragment.content ?? "").trim();
    if (!plain) return "";
    // If the label was derived from content, skip showing content as preview
    if (derived) return "";
    return plain.length > 120 ? plain.slice(0, 120) + "…" : plain;
  })();

  return (
    <div className="group border-b border-border last:border-b-0">
      {/* Summary row */}
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* Chevron */}
        <svg
          className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>

        {/* Label */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          {editingTitle ? (
            <Input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") commitTitle();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-xs px-1 w-48"
              autoFocus
            />
          ) : (
            <span
              className={cn(
                "text-xs font-medium truncate",
                derived ? "text-muted-foreground italic" : "text-foreground/90"
              )}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              title="Double-click to rename"
            >
              {labelText}
            </span>
          )}
          {preview && (
            <span className="text-[11px] text-muted-foreground/60 truncate hidden sm:block">
              {preview}
            </span>
          )}
        </div>

        {/* Meta + actions */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-muted-foreground/50 hidden md:block">
            {wordCount} words
          </span>
          <span className="text-[10px] text-muted-foreground/50 hidden lg:block">
            {new Date(fragment.updated_at).toLocaleDateString()}
          </span>

          {/* Actions (always visible on hover) */}
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={() => setShowMove((v) => !v)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
                title="Move to tab"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {showMove && (
                <div className="absolute right-0 top-7 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[130px]">
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
            <button
              onClick={() => deleteFragment.mutate(fragment.id)}
              className="text-muted-foreground hover:text-destructive p-1 rounded"
              title="Delete fragment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-8 pb-3 pt-1">
          <textarea
            ref={contentRef}
            value={localContent}
            onChange={(e) => {
              setLocalContent(e.target.value);
              scheduleContentSave(e.target.value);
            }}
            placeholder="Write something..."
            className="w-full resize-none bg-secondary/20 rounded-md text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring px-3 py-2 min-h-[80px] leading-relaxed"
            rows={4}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showMove && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (allTabs.length > 0 && !allTabs.includes(activeTab)) {
      setActiveTab(allTabs[0]);
    }
  }, [allTabs, activeTab]);

  // Collapse expanded row when switching tabs or view modes
  useEffect(() => { setExpandedId(null); }, [activeTab, viewMode]);

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
        <div className="flex items-center gap-1">
          <FragmentImportButton projectId={projectId} />

          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden mr-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => createFragment.mutate({ tab: activeTab })}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New fragment
          </Button>
        </div>
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
            <button onClick={handleAddTab} className="text-primary hover:text-primary/80">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setAddingTab(false); setNewTabName(""); }}
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

      {/* Content */}
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
        ) : viewMode === "grid" ? (
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
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {tabFragments.map((fragment) => (
              <FragmentRow
                key={fragment.id}
                fragment={fragment}
                projectId={projectId}
                allTabs={allTabs}
                expanded={expandedId === fragment.id}
                onToggle={() => setExpandedId(expandedId === fragment.id ? null : fragment.id)}
              />
            ))}
            <div className="border-t border-border">
              <button
                onClick={() => createFragment.mutate({ tab: activeTab })}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-secondary/30 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New fragment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

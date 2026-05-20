"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, Plus, Trash2, BookOpen,
  GripVertical, Settings, Book, Download, Network, Calendar, Clock, Scissors, Info, ListChecks,
} from "lucide-react";
import {
  DndContext, closestCenter, DragEndEvent,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useActs, useChapters, useScenes,
  useCreateAct, useCreateChapter, useCreateScene,
  useDeleteAct, useDeleteChapter, useDeleteScene,
  useReorderActs, useReorderChapters, useReorderScenes,
  useUpdateAct, useUpdateChapter, useProject, useUpdateProject,
  useTimeConfig, useUpdateTimeConfig,
} from "@/store/queries";
import { ImportButton } from "@/components/layout/ImportButton";
import { TimeConfigDialog } from "@/components/time/TimeConfigDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { BookMetaDialog } from "@/components/project/BookMetaDialog";
import { DEFAULT_TIME_CONFIG } from "@/types";
import type { Act, Chapter, Scene } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { projectId: number }

// ── Scene divider (insert-between) ───────────────────────────────────────────

function SceneDivider({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative h-5 flex items-center px-12">
      <div className="w-full h-px bg-transparent group-hover:bg-border/60 transition-colors" />
      <button
        onClick={onInsert}
        className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 h-4 w-4 rounded-full bg-card border border-border flex items-center justify-center hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all"
        title="Insert scene here"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── Scene item ────────────────────────────────────────────────────────────────

function SceneItem({
  scene, projectId, currentSceneId, index,
}: { scene: Scene; projectId: number; currentSceneId?: number; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });
  const deleteScene = useDeleteScene(scene.chapter_id);
  const router = useRouter();
  const { t } = useLanguage();
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 pl-12 pr-2 py-1 rounded hover:bg-secondary/50 text-sm",
        isDragging && "opacity-50",
        currentSceneId === scene.id && "bg-secondary text-foreground font-medium"
      )}
    >
      <button {...attributes} {...listeners} className="opacity-0 group-hover:opacity-40 cursor-grab">
        <GripVertical className="h-3 w-3" />
      </button>
      <Link
        href={`/projects/${projectId}/scenes/${scene.id}`}
        className="flex-1 truncate text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        <span className="text-muted-foreground/50 text-[10px] tabular-nums shrink-0 w-4 text-right">{index}.</span>
        <span className="truncate">{scene.title || t("nav_untitled_scene")}</span>
        {scene.scene_time && Object.keys(scene.scene_time).length > 0 && (
          <Clock className="h-2.5 w-2.5 shrink-0 text-primary/60" aria-label="Has scene time" />
        )}
      </Link>
      <button
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault();
          if (confirm(t("common_delete") + "?")) {
            deleteScene.mutate(scene.id);
            if (currentSceneId === scene.id) router.push(`/projects/${projectId}`);
          }
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Chapter item ──────────────────────────────────────────────────────────────

function ChapterItem({
  chapter, projectId, currentSceneId,
}: { chapter: Chapter; projectId: number; currentSceneId?: number }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chapter.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const { t } = useLanguage();
  const { data: scenes = [] } = useScenes(chapter.id);
  const createScene = useCreateScene(chapter.id);
  const deleteChapter = useDeleteChapter(chapter.act_id);
  const updateChapter = useUpdateChapter(chapter.act_id);
  const reorderScenes = useReorderScenes(chapter.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleInsertAfter = async (afterIndex: number) => {
    const newScene = await createScene.mutateAsync({
      chapter_id: chapter.id,
      order_index: scenes.length + 1,
    });
    const newOrder = [
      ...scenes.slice(0, afterIndex + 1).map((s, i) => ({ id: s.id, order_index: i })),
      { id: newScene.id, order_index: afterIndex + 1 },
      ...scenes.slice(afterIndex + 1).map((s, i) => ({ id: s.id, order_index: afterIndex + 2 + i })),
    ];
    reorderScenes.mutate(newOrder);
  };

  const handleSceneDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = scenes.findIndex((s) => s.id === active.id);
      const newIdx = scenes.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(scenes, oldIdx, newIdx);
      reorderScenes.mutate(reordered.map((s, i) => ({ id: s.id, order_index: i })));
    }
  };

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== chapter.title)
      updateChapter.mutate({ id: chapter.id, data: { title: newTitle.trim() } });
    setRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("select-none", isDragging && "opacity-50")}>
      {/* Chapter row */}
      <div className="group flex items-center gap-1 pl-4 pr-2 py-1 rounded hover:bg-secondary/40">
        <button {...attributes} {...listeners} className="opacity-0 group-hover:opacity-40 cursor-grab">
          <GripVertical className="h-3 w-3" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {renaming ? (
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-5 text-xs px-1 py-0 flex-1"
            autoFocus
          />
        ) : (
          <Link
            href={`/projects/${projectId}/chapters/${chapter.id}`}
            className="flex-1 text-xs text-muted-foreground hover:text-foreground truncate"
            onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
          >
            {chapter.title}
          </Link>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            className="hover:text-primary"
            onClick={() => createScene.mutate({ chapter_id: chapter.id, order_index: scenes.length })}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            className="hover:text-destructive"
            onClick={() => {
              if (confirm(`${t("common_delete")} "${chapter.title}"?`))
                deleteChapter.mutate(chapter.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Scene list */}
      {expanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
          <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {scenes.map((scene, idx) => (
              <div key={scene.id}>
                <SceneItem scene={scene} projectId={projectId} currentSceneId={currentSceneId} index={idx + 1} />
                {idx < scenes.length - 1 && (
                  <SceneDivider onInsert={() => handleInsertAfter(idx)} />
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ── Act item ──────────────────────────────────────────────────────────────────

function ActItem({
  act, projectId, currentSceneId,
}: { act: Act; projectId: number; currentSceneId?: number }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(act.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: act.id });

  const { t } = useLanguage();
  const { data: chapters = [] } = useChapters(act.id);
  const createChapter = useCreateChapter(act.id);
  const deleteAct = useDeleteAct(projectId);
  const updateAct = useUpdateAct(projectId);
  const reorderChapters = useReorderChapters(act.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleChapterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = chapters.findIndex((c) => c.id === active.id);
      const newIdx = chapters.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(chapters, oldIdx, newIdx);
      reorderChapters.mutate(reordered.map((c, i) => ({ id: c.id, order_index: i })));
    }
  };

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== act.title)
      updateAct.mutate({ id: act.id, data: { title: newTitle.trim() } });
    setRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("select-none", isDragging && "opacity-50")}>
      {/* Act row */}
      <div className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-secondary/50">
        <button {...attributes} {...listeners} className="opacity-0 group-hover:opacity-40 cursor-grab">
          <GripVertical className="h-3 w-3" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {renaming ? (
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-5 text-xs px-1 py-0 flex-1"
            autoFocus
          />
        ) : (
          <Link
            href={`/projects/${projectId}/acts/${act.id}`}
            className="flex-1 text-sm font-medium hover:text-foreground truncate"
            onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
          >
            {act.title}
          </Link>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            className="hover:text-primary"
            onClick={() => createChapter.mutate({
              act_id: act.id,
              title: `Chapter ${chapters.length + 1}`,
              order_index: chapters.length,
            })}
            title="Add chapter"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            className="hover:text-destructive"
            onClick={() => {
              if (confirm(`${t("common_delete")} "${act.title}"?`))
                deleteAct.mutate(act.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chapter list */}
      {expanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChapterDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                projectId={projectId}
                currentSceneId={currentSceneId}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ── Project sidebar ───────────────────────────────────────────────────────────

export function ProjectSidebar({ projectId }: Props) {
  const params = useParams();
  const currentSceneId = params?.sceneId ? Number(params.sceneId) : undefined;

  const { t } = useLanguage();
  const { data: project } = useProject(projectId);
  const { data: acts = [] } = useActs(projectId);
  const createAct = useCreateAct(projectId);
  const reorderActs = useReorderActs(projectId);
  const updateProject = useUpdateProject();
  const { data: timeConfigData } = useTimeConfig(projectId);
  const updateTimeConfig = useUpdateTimeConfig(projectId);
  const [timeConfigOpen, setTimeConfigOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const timeConfig = timeConfigData ?? DEFAULT_TIME_CONFIG;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleActDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = acts.findIndex((a) => a.id === active.id);
      const newIdx = acts.findIndex((a) => a.id === over.id);
      const reordered = arrayMove(acts, oldIdx, newIdx);
      reorderActs.mutate(reordered.map((a, i) => ({ id: a.id, order_index: i })));
    }
  };

  return (
    <aside className="flex flex-col h-full w-64 border-r border-border bg-card">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors">
          <BookOpen className="h-4 w-4 text-primary" />
          LoreWeaver
        </Link>
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider">
        <span>{t("nav_story")}</span>
        <button
          className="hover:text-foreground"
          title="Add act"
          onClick={() => createAct.mutate({
            project_id: projectId,
            title: `Act ${acts.length + 1}`,
            order_index: acts.length,
          })}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActDragEnd}>
          <SortableContext items={acts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {acts.map((act) => (
              <ActItem
                key={act.id}
                act={act}
                projectId={projectId}
                currentSceneId={currentSceneId}
              />
            ))}
          </SortableContext>
        </DndContext>
        {acts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">{t("nav_no_acts")}</p>
        )}
      </div>

      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href={`/projects/${projectId}/codex`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Book className="h-4 w-4" />
          {t("nav_codex")}
        </Link>
        <Link
          href={`/projects/${projectId}/plot`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <ListChecks className="h-4 w-4" />
          Plot Beats
        </Link>
        <Link
          href={`/projects/${projectId}/relations`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Network className="h-4 w-4" />
          {t("nav_relations")}
        </Link>
        <Link
          href={`/projects/${projectId}/timeline`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          {t("nav_timeline")}
        </Link>
        <Link
          href={`/projects/${projectId}/fragments`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Scissors className="h-4 w-4" />
          {t("nav_fragments")}
        </Link>
        <button
          onClick={() => setTimeConfigOpen(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Clock className="h-4 w-4" />
          {t("nav_time_system")}
        </button>
        <button
          onClick={() => setMetaOpen(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-4 w-4" />
          {t("nav_project_info")}
        </button>

        <div className="border-t border-border/50 my-1" />

        <ImportButton projectId={projectId} mode="story" />

        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          {t("nav_export")}
        </button>

        <div className="border-t border-border/50 my-1" />

        <Link
          href="/settings"
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          {t("nav_settings")}
        </Link>
      </div>

      <TimeConfigDialog
        open={timeConfigOpen}
        onClose={() => setTimeConfigOpen(false)}
        initial={timeConfig}
        onSave={(cfg) => updateTimeConfig.mutate(cfg)}
      />

      <ExportDialog
        projectId={projectId}
        projectTitle={project?.title ?? ""}
        bookMeta={project?.book_meta ?? null}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <BookMetaDialog
        projectId={projectId}
        projectTitle={project?.title ?? ""}
        initial={project?.book_meta ?? null}
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        onSave={(meta) => updateProject.mutate({ id: projectId, data: { book_meta: meta } })}
      />
    </aside>
  );
}

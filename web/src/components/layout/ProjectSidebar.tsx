"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, Plus, Trash2, BookOpen,
  GripVertical, Settings, Book, Download, Network, Calendar
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
  useChapters, useScenes, useCreateChapter, useCreateScene,
  useDeleteChapter, useDeleteScene, useReorderChapters, useReorderScenes,
  useUpdateChapter, useProject,
} from "@/store/queries";
import { useExport } from "@/hooks/useExport";
import { ImportButton } from "@/components/layout/ImportButton";
import type { Chapter, Scene } from "@/types";

interface Props {
  projectId: number;
}

function SceneDivider({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative h-5 flex items-center px-8">
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

function SceneItem({
  scene, projectId, currentSceneId
}: { scene: Scene; projectId: number; currentSceneId?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });
  const deleteScene = useDeleteScene(scene.chapter_id);
  const router = useRouter();

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 pl-8 pr-2 py-1 rounded hover:bg-secondary/50 text-sm",
        isDragging && "opacity-50",
        currentSceneId === scene.id && "bg-secondary text-foreground font-medium"
      )}
    >
      <button {...attributes} {...listeners} className="opacity-0 group-hover:opacity-40 cursor-grab">
        <GripVertical className="h-3 w-3" />
      </button>
      <Link
        href={`/projects/${projectId}/scenes/${scene.id}`}
        className="flex-1 truncate text-muted-foreground hover:text-foreground"
      >
        {scene.title || "Untitled Scene"}
      </Link>
      <button
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault();
          if (confirm("Delete this scene?")) {
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

function ChapterItem({
  chapter, projectId, currentSceneId
}: { chapter: Chapter; projectId: number; currentSceneId?: number }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chapter.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const { data: scenes = [] } = useScenes(chapter.id);
  const createScene = useCreateScene(chapter.id);
  const deleteChapter = useDeleteChapter(projectId);
  const updateChapter = useUpdateChapter(projectId);
  const reorderScenes = useReorderScenes(chapter.id);

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const style = { transform: CSS.Transform.toString(transform), transition };

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
    if (newTitle.trim() && newTitle !== chapter.title) {
      updateChapter.mutate({ id: chapter.id, data: { title: newTitle.trim() } });
    }
    setRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("select-none", isDragging && "opacity-50")}>
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
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
            className="h-5 text-xs px-1 py-0"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium cursor-pointer truncate"
            onDoubleClick={() => setRenaming(true)}
          >
            {chapter.title}
          </span>
        )}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            className="hover:text-primary"
            onClick={() => createScene.mutate({
              chapter_id: chapter.id,
              order_index: scenes.length,
            })}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            className="hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete chapter "${chapter.title}" and all its scenes?`)) {
                deleteChapter.mutate(chapter.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
          <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {scenes.map((scene, idx) => (
              <div key={scene.id}>
                <SceneItem scene={scene} projectId={projectId} currentSceneId={currentSceneId} />
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

export function ProjectSidebar({ projectId }: Props) {
  const params = useParams();
  const currentSceneId = params?.sceneId ? Number(params.sceneId) : undefined;

  const { data: project } = useProject(projectId);
  const { exportProject } = useExport();
  const { data: chapters = [] } = useChapters(projectId);
  const createChapter = useCreateChapter(projectId);
  const reorderChapters = useReorderChapters(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleChapterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = chapters.findIndex((c) => c.id === active.id);
      const newIdx = chapters.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(chapters, oldIdx, newIdx);
      reorderChapters.mutate(reordered.map((c, i) => ({ id: c.id, order_index: i })));
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
        <span>Chapters</span>
        <button
          className="hover:text-foreground"
          onClick={() => createChapter.mutate({
            project_id: projectId,
            title: `Chapter ${chapters.length + 1}`,
            order_index: chapters.length,
          })}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
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
        {chapters.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No chapters yet</p>
        )}
      </div>

      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href={`/projects/${projectId}/codex`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Book className="h-4 w-4" />
          Codex
        </Link>
        <Link
          href={`/projects/${projectId}/relations`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Network className="h-4 w-4" />
          Relations
        </Link>
        <Link
          href={`/projects/${projectId}/timeline`}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          Timeline
        </Link>

        <div className="border-t border-border/50 my-1" />

        {/* Import */}
        <ImportButton projectId={projectId} mode="story" />

        {/* Export */}
        <div className="flex gap-1">
          <button
            onClick={() => project && exportProject(projectId, "md", project.title)}
            className="flex flex-1 items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
            title="Export as Markdown"
          >
            <Download className="h-4 w-4" />
            Export .md
          </button>
          <button
            onClick={() => project && exportProject(projectId, "tex", project.title)}
            className="px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
            title="Export as LaTeX"
          >
            .tex
          </button>
        </div>

        <div className="border-t border-border/50 my-1" />

        <Link
          href="/settings"
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

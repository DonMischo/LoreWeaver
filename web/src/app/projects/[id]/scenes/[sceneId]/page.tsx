"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, Sparkles, Clock, Moon, Sun, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { StatusBar } from "@/components/editor/StatusBar";
import { CodexSidebar } from "@/components/codex/CodexSidebar";
import { CodexEntryDialog } from "@/components/codex/CodexEntryDialog";
import { AIPanel } from "@/components/ai/AIPanel";
import { SceneTimePanel } from "@/components/time/SceneTimePanel";
import { TimeConfigDialog } from "@/components/time/TimeConfigDialog";
import { useUIStore } from "@/store/ui";
import { useAutosave } from "@/hooks/useAutosave";
import {
  useScene, useUpdateScene, useCodexEntries,
  useCreateCodexEntry, useProject,
  useTimeConfig, useUpdateTimeConfig,
  useCreateFragment, useDeleteScene,
} from "@/store/queries";
import type { SceneTime } from "@/types";
import { DEFAULT_TIME_CONFIG } from "@/types";
import { cn } from "@/lib/utils";

function getDayNightLabel(config: typeof DEFAULT_TIME_CONFIG, time: SceneTime | null): "Day" | "Night" | null {
  if (!time) return null;
  const hourUnit = config.units.find(u => u.id === "hour" && u.enabled);
  if (!hourUnit) return null;
  const hour = time["hour"];
  if (hour == null) return null;
  const dn = config.day_night;
  const nightEnd = (dn.night_start_hour + dn.night_duration) % dn.hours_per_day;
  let isNight: boolean;
  if (dn.night_duration <= 0) {
    isNight = false;
  } else if (nightEnd > dn.night_start_hour) {
    isNight = hour >= dn.night_start_hour && hour < nightEnd;
  } else {
    isNight = hour >= dn.night_start_hour || hour < nightEnd;
  }
  return isNight ? "Night" : "Day";
}

export default function ScenePage() {
  const { id, sceneId } = useParams();
  const router = useRouter();
  const projectId = Number(id);
  const sceneIdNum = Number(sceneId);

  const { data: scene } = useScene(sceneIdNum);
  const { data: project } = useProject(projectId);
  const { data: codexEntries = [] } = useCodexEntries(projectId);
  const { data: timeConfigData } = useTimeConfig(projectId);
  const updateScene = useUpdateScene(sceneIdNum);
  const updateTimeConfig = useUpdateTimeConfig(projectId);
  const createEntry = useCreateCodexEntry(projectId);
  const createFragment = useCreateFragment(projectId);
  // chapter_id is on scene; hook needs it — use 0 until scene loads, only called after
  const deleteScene = useDeleteScene(scene?.chapter_id ?? 0);

  const timeConfig = timeConfigData ?? DEFAULT_TIME_CONFIG;

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [selectedCodexId, setSelectedCodexId] = useState<number>(-1);
  const [newEntryDialogOpen, setNewEntryDialogOpen] = useState(false);
  const [newEntryInitial, setNewEntryInitial] = useState<{ name?: string }>({});
  const [timePanelOpen, setTimePanelOpen] = useState(false);
  const [timeConfigOpen, setTimeConfigOpen] = useState(false);

  const codexSidebarOpen = useUIStore((s) => s.codexSidebarOpen);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const setCodexSidebarOpen = useUIStore((s) => s.setCodexSidebarOpen);
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);

  const editorRef = useRef<{ insertContent: (text: string) => void } | null>(null);

  useEffect(() => {
    if (scene) {
      setContent(scene.content || "");
      setTitle(scene.title || "");
      setWordCount(scene.word_count);
    }
  }, [scene?.id]);

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    const text = html.replace(/<[^>]+>/g, "");
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  }, []);

  const handleTitleBlur = () => {
    if (scene && title !== scene.title) {
      updateScene.mutate({ data: { title } });
    }
  };

  useAutosave({ sceneId: sceneIdNum, content, enabled: !!scene });

  const handleCodexEntryClick = (id: number) => {
    setSelectedCodexId(id);
    if (!codexSidebarOpen) setCodexSidebarOpen(true);
  };

  const handleInsertAI = (text: string) => {
    setContent((prev) => prev + `<p>${text.replace(/\n/g, "</p><p>")}</p>`);
  };

  const handleSceneTimeChange = (time: SceneTime | null) => {
    updateScene.mutate({ data: { scene_time: time as any } });
  };

  const handleOpenConfig = () => {
    setTimePanelOpen(false);
    setTimeConfigOpen(true);
  };

  const handleArchiveScene = async () => {
    if (!scene) return;
    if (!confirm(`Archive "${scene.title || "Untitled Scene"}"?\n\nThis will save the content as a fragment in the Archive tab. You can then choose to delete the scene.`)) return;
    await createFragment.mutateAsync({
      tab: "archive",
      title: scene.title || "Untitled Scene",
      content: scene.content || "",
    });
    if (confirm("Scene archived. Delete the original scene from the story?")) {
      deleteScene.mutate(sceneIdNum);
      router.push(`/projects/${projectId}`);
    }
  };

  // Day/night indicator for toolbar
  const dayNight = getDayNightLabel(timeConfig, scene?.scene_time ?? null);
  const hasTime = !!(scene?.scene_time && Object.keys(scene.scene_time).length > 0);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading scene...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Scene title..."
          className="border-0 bg-transparent text-sm font-medium h-8 px-2 focus-visible:ring-0 max-w-xs"
        />
        <div className="flex-1" />

        {/* Time indicator badge */}
        {hasTime && dayNight && (
          <span className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
            dayNight === "Night"
              ? "bg-[hsl(262_80%_65%/0.2)] text-[hsl(262_80%_75%)]"
              : "bg-[hsl(38_92%_65%/0.2)] text-[hsl(38_92%_55%)]"
          )}>
            {dayNight === "Night" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            {dayNight}
          </span>
        )}

        <Button
          size="sm"
          variant={timePanelOpen ? "secondary" : hasTime ? "outline" : "ghost"}
          onClick={() => {
            setTimePanelOpen(!timePanelOpen);
            if (codexSidebarOpen) setCodexSidebarOpen(false);
            if (aiPanelOpen) setAiPanelOpen(false);
          }}
          className={cn("gap-1.5 text-xs", hasTime && !timePanelOpen && "border-primary/50 text-primary")}
        >
          <Clock className="h-3.5 w-3.5" />
          Time
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleArchiveScene}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Archive this scene to Fragments"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </Button>
        <Button
          size="sm"
          variant={codexSidebarOpen ? "secondary" : "ghost"}
          onClick={() => {
            setCodexSidebarOpen(!codexSidebarOpen);
            if (timePanelOpen) setTimePanelOpen(false);
          }}
          className="gap-1.5 text-xs"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Codex
        </Button>
        <Button
          size="sm"
          variant={aiPanelOpen ? "secondary" : "ghost"}
          onClick={() => {
            setAiPanelOpen(!aiPanelOpen);
            if (timePanelOpen) setTimePanelOpen(false);
          }}
          className="gap-1.5 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <TipTapEditor
            content={content}
            onChange={handleContentChange}
            codexEntries={codexEntries}
            onCodexEntryClick={handleCodexEntryClick}
          />
          <StatusBar sceneWordCount={wordCount} />
        </div>

        {/* Time panel */}
        {timePanelOpen && (
          <SceneTimePanel
            config={timeConfig}
            sceneTime={scene.scene_time ?? null}
            onChange={handleSceneTimeChange}
            onClose={() => setTimePanelOpen(false)}
            onOpenConfig={handleOpenConfig}
          />
        )}

        {/* Codex sidebar */}
        {codexSidebarOpen && (
          <CodexSidebar
            entries={codexEntries}
            selectedId={selectedCodexId >= 0 ? selectedCodexId : undefined}
            onSelect={(id) => setSelectedCodexId(id)}
            onClose={() => setCodexSidebarOpen(false)}
            onAdd={() => setNewEntryDialogOpen(true)}
          />
        )}

        {/* AI panel */}
        {aiPanelOpen && (
          <AIPanel
            sceneId={sceneIdNum}
            onInsert={handleInsertAI}
            onClose={() => setAiPanelOpen(false)}
          />
        )}
      </div>

      <CodexEntryDialog
        open={newEntryDialogOpen}
        onClose={() => { setNewEntryDialogOpen(false); setNewEntryInitial({}); }}
        onSave={(data) => createEntry.mutate({ ...data, project_id: projectId } as any)}
        initial={newEntryInitial}
        title="New Codex Entry"
      />

      <TimeConfigDialog
        open={timeConfigOpen}
        onClose={() => setTimeConfigOpen(false)}
        initial={timeConfig}
        onSave={(cfg) => updateTimeConfig.mutate(cfg)}
      />
    </div>
  );
}

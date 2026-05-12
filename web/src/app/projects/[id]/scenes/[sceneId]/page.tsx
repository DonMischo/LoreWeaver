"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { BookOpen, Sparkles, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { StatusBar } from "@/components/editor/StatusBar";
import { CodexSidebar } from "@/components/codex/CodexSidebar";
import { CodexEntryDialog } from "@/components/codex/CodexEntryDialog";
import { AIPanel } from "@/components/ai/AIPanel";
import { useUIStore } from "@/store/ui";
import { useAutosave } from "@/hooks/useAutosave";
import {
  useScene, useUpdateScene, useCodexEntries,
  useCreateCodexEntry, useProject,
} from "@/store/queries";

export default function ScenePage() {
  const { id, sceneId } = useParams();
  const projectId = Number(id);
  const sceneIdNum = Number(sceneId);

  const { data: scene } = useScene(sceneIdNum);
  const { data: project } = useProject(projectId);
  const { data: codexEntries = [] } = useCodexEntries(projectId);
  const updateScene = useUpdateScene(sceneIdNum);
  const createEntry = useCreateCodexEntry(projectId);

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [selectedCodexId, setSelectedCodexId] = useState<number>(-1);
  const [newEntryDialogOpen, setNewEntryDialogOpen] = useState(false);
  const [newEntryInitial, setNewEntryInitial] = useState<{ name?: string }>({});

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
    // Append generated text to editor content
    setContent((prev) => prev + `<p>${text.replace(/\n/g, "</p><p>")}</p>`);
  };

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
        <Button
          size="sm"
          variant={codexSidebarOpen ? "secondary" : "ghost"}
          onClick={() => setCodexSidebarOpen(!codexSidebarOpen)}
          className="gap-1.5 text-xs"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Codex
        </Button>
        <Button
          size="sm"
          variant={aiPanelOpen ? "secondary" : "ghost"}
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
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
    </div>
  );
}

"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useEditorContext } from "@/contexts/EditorContext";
import { useSettings, usePrompts } from "@/store/queries";
import { kiApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── NodeView ──────────────────────────────────────────────────────────────────

const ACCENT = "#f472b6";

function KiNodeView({ node, updateAttributes, deleteNode, getPos, editor }: any) {
  const { allEntries, sceneId } = useEditorContext();
  const { data: settings } = useSettings();
  const { data: prompts = [] } = usePrompts();

  const [generating, setGenerating] = useState(false);
  const [result, setResult]         = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [entryType, setEntryType]   = useState("character");

  const { model, codexIds: codexIdsStr, sceneIds: sceneIdsStr, prompt, promptId } = node.attrs as {
    model: string; codexIds: string; sceneIds: string; prompt: string; promptId: string;
  };

  // Enabled models from settings; fall back to just the default if none pinned
  const enabledModels: string[] = settings?.enabled_models?.length
    ? settings.enabled_models
    : settings?.default_model ? [settings.default_model] : [];

  // The effective model: use stored attr, else fall back to default
  const effectiveModel = model || settings?.default_model || "";

  // Parse comma-separated stored IDs
  const codexIds: number[]      = codexIdsStr ? codexIdsStr.split(",").map(Number).filter(Boolean) : [];
  const extraSceneIds: number[] = sceneIdsStr  ? sceneIdsStr.split(",").map(Number).filter(Boolean) : [];

  const selectedPrompt = prompts.find(p => String(p.id) === promptId) ?? null;
  const isCodexDistill = selectedPrompt?.built_in_key === "codex_distill";

  const selectedEntries  = allEntries.filter(e => codexIds.includes(e.id));
  const availableEntries = allEntries.filter(e => !codexIds.includes(e.id));

  const addEntry = (id: number) =>
    updateAttributes({ codexIds: [...codexIds, id].join(",") });
  const removeEntry = (id: number) =>
    updateAttributes({ codexIds: codexIds.filter(i => i !== id).join(",") });

  const handleGenerate = async () => {
    if (!effectiveModel || !sceneId) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const data = await kiApi.generate({
        scene_id: sceneId,
        model: effectiveModel,
        codex_ids: codexIds,
        extra_scene_ids: extraSceneIds,
        prompt: prompt || "",
        prompt_id: promptId ? Number(promptId) : null,
        entry_type: isCodexDistill ? entryType : undefined,
      });
      setResult(data.text);
    } catch (e: any) {
      setError(e.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleInsert = () => {
    if (!result || !editor) return;
    const pos = getPos();
    // Split plain text into paragraphs
    const paragraphs = result.split(/\n\n+/).filter(Boolean).map(text => ({
      type: "paragraph" as const,
      content: text.trim() ? [{ type: "text" as const, text: text.trim() }] : [],
    }));
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, paragraphs)
      .run();
  };

  return (
    <NodeViewWrapper as="div">
      <div
        className="my-3 rounded-lg border-l-[3px] px-4 py-3 space-y-3"
        style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
        contentEditable={false}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide flex-1" style={{ color: ACCENT }}>
            AI Generate
          </span>
          <button type="button" onClick={deleteNode} className="text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Prompt selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">Prompt</span>
          <select
            value={promptId}
            onChange={e => updateAttributes({ promptId: e.target.value })}
            onMouseDown={e => e.stopPropagation()}
            className="bg-background text-xs rounded border border-border px-1.5 py-1 outline-none flex-1 max-w-xs"
          >
            <option value="">None (legacy)</option>
            {prompts.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Entry type selector (only for Codex Entry Distillation) */}
        {isCodexDistill && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Type</span>
            <select
              value={entryType}
              onChange={e => setEntryType(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              className="bg-background text-xs rounded border border-border px-1.5 py-1 outline-none"
            >
              <option value="character">Character</option>
              <option value="location">Location</option>
              <option value="item">Item</option>
              <option value="lore">Lore</option>
            </select>
          </div>
        )}

        {/* Model selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">Model</span>
          {enabledModels.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              No models enabled — configure in Settings
            </span>
          ) : (
            <select
              value={effectiveModel}
              onChange={e => updateAttributes({ model: e.target.value })}
              onMouseDown={e => e.stopPropagation()}
              className="bg-background text-xs rounded border border-border px-1.5 py-1 outline-none flex-1 max-w-xs"
            >
              {enabledModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        {/* Context — active scene (auto) */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">Scene</span>
          <div className="flex flex-wrap gap-1">
            <span className="text-[11px] bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
              Current scene
              <span className="text-muted-foreground/50 text-[10px]">auto</span>
            </span>
            {extraSceneIds.map(id => (
              <span key={id} className="text-[11px] bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                Scene #{id}
                <button
                  type="button"
                  onClick={() => updateAttributes({ sceneIds: extraSceneIds.filter(i => i !== id).join(",") })}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Context — codex entries */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">Codex</span>
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedEntries.map(e => (
              <span
                key={e.id}
                className="text-[11px] bg-secondary px-2 py-0.5 rounded flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                {e.name}
                <button type="button" onClick={() => removeEntry(e.id)}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {availableEntries.length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) addEntry(Number(e.target.value)); }}
                onMouseDown={e => e.stopPropagation()}
                className="text-[11px] bg-background border border-border rounded px-1.5 py-0.5 outline-none text-muted-foreground"
              >
                <option value="">+ Add entry…</option>
                {availableEntries.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            {allEntries.length === 0 && (
              <span className="text-[11px] text-muted-foreground italic">No codex entries</span>
            )}
          </div>
        </div>

        {/* Prompt */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0 pt-1.5">Prompt</span>
          <textarea
            value={prompt}
            onChange={e => updateAttributes({ prompt: e.target.value })}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Instructions for the AI… (optional)"
            rows={2}
            className="flex-1 bg-background text-xs rounded border border-border px-2 py-1.5 outline-none resize-none"
          />
        </div>

        {/* Result preview */}
        {result && (
          <div className="rounded border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground/90 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
            {result}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!effectiveModel || !sceneId || generating}
            onClick={handleGenerate}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-opacity disabled:opacity-40"
            style={{ background: `${ACCENT}25`, color: ACCENT }}
          >
            {generating
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3 w-3" /> Generate</>
            }
          </button>

          {result && (
            <>
              <button
                type="button"
                onClick={handleInsert}
                className="text-xs px-3 py-1.5 rounded font-medium bg-primary text-primary-foreground"
              >
                Insert &amp; replace
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ── Node definition ───────────────────────────────────────────────────────────

export const KiNode = Node.create({
  name: "ki",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      model:    { default: "", parseHTML: el => el.getAttribute("data-model")     ?? "" },
      codexIds: { default: "", parseHTML: el => el.getAttribute("data-codex-ids") ?? "" },
      sceneIds: { default: "", parseHTML: el => el.getAttribute("data-scene-ids") ?? "" },
      prompt:   { default: "", parseHTML: el => el.getAttribute("data-prompt")    ?? "" },
      promptId: { default: "", parseHTML: el => el.getAttribute("data-prompt-id") ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ki"]', priority: 100 }];
  },

  renderHTML({ node }) {
    return ["div", {
      "data-type":      "ki",
      "data-model":     node.attrs.model,
      "data-codex-ids": node.attrs.codexIds,
      "data-scene-ids": node.attrs.sceneIds,
      "data-prompt":    node.attrs.prompt,
      "data-prompt-id": node.attrs.promptId,
    }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KiNodeView);
  },
});

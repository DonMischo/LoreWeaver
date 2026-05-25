"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Sparkles, X, RefreshCw, BookPlus } from "lucide-react";
import { useState } from "react";
import { useEditorContext } from "@/contexts/EditorContext";
import { useSettings, usePrompts, useProjectScenes } from "@/store/queries";
import { kiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CodexEntry } from "@/types";

// ── NodeView ──────────────────────────────────────────────────────────────────

const ACCENT = "#f472b6";

/** Strip markdown code fences and grab the first JSON object in the text. */
function extractJSON(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try to grab first {...} block in case of leading/trailing prose
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) return brace[0].trim();
  return text.trim();
}

function KiNodeView({ node, updateAttributes, deleteNode, getPos, editor }: any) {
  const { allEntries, sceneId, projectId, onPrefillEntry } = useEditorContext();
  const { data: settings } = useSettings();
  const { data: prompts = [] } = usePrompts();
  const { data: projectScenes = [] } = useProjectScenes(projectId);

  const [generating, setGenerating]       = useState(false);
  const [result, setResult]               = useState<string | null>(null);
  const [entryJson, setEntryJson]         = useState<Partial<CodexEntry> | null>(null);
  const [createEntryMode, setCreateEntryMode] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [entryType, setEntryType]         = useState("character");

  const { model, codexIds: codexIdsStr, sceneIds: sceneIdsStr, prompt, promptId, wordCount: wordCountAttr } = node.attrs as {
    model: string; codexIds: string; sceneIds: string; prompt: string; promptId: string; wordCount: string;
  };

  // Enabled models from settings; fall back to just the default if none pinned
  const enabledModels: string[] = settings?.enabled_models?.length
    ? settings.enabled_models
    : settings?.default_model ? [settings.default_model] : [];

  // Parse comma-separated stored IDs
  const codexIds: number[]      = codexIdsStr ? codexIdsStr.split(",").map(Number).filter(Boolean) : [];
  const extraSceneIds: number[] = sceneIdsStr  ? sceneIdsStr.split(",").map(Number).filter(Boolean) : [];

  const selectedPrompt = prompts.find(p => String(p.id) === promptId) ?? null;
  const isCodexDistill = selectedPrompt?.built_in_key === "codex_distill";

  // The effective model: use stored attr, then distill-specific default, then global default
  const effectiveModel = model || (isCodexDistill ? settings?.default_codex_model : null) || settings?.default_model || "";

  // Word count: node attribute overrides prompt default; fall back to prompt's value or 400
  const promptWordCount = selectedPrompt?.word_count ?? 400;
  const nodeWordCount   = wordCountAttr ? Number(wordCountAttr) : null;
  const displayWordCount = nodeWordCount ?? promptWordCount;

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
    setEntryJson(null);
    try {
      const data = await kiApi.generate({
        scene_id: sceneId,
        model: effectiveModel,
        codex_ids: codexIds,
        extra_scene_ids: extraSceneIds,
        prompt: prompt || "",
        prompt_id: promptId ? Number(promptId) : null,
        entry_type: isCodexDistill ? entryType : undefined,
        word_count: (!isCodexDistill || !createEntryMode) ? nodeWordCount : null,
        create_entry: isCodexDistill && createEntryMode,
      });
      const text = data.text;

      if (isCodexDistill && createEntryMode) {
        // Try to parse as JSON
        try {
          const raw = extractJSON(text);
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && parsed.name) {
            setEntryJson(parsed as Partial<CodexEntry>);
          } else {
            setResult(text); // fallback to text display
          }
        } catch {
          setResult(text); // fallback to text display
        }
      } else {
        setResult(text);
      }
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

  const handleOpenInCodex = () => {
    if (!entryJson || !onPrefillEntry) return;
    onPrefillEntry(entryJson);
    setEntryJson(null);
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
            onChange={e => { updateAttributes({ promptId: e.target.value }); setCreateEntryMode(false); setResult(null); setEntryJson(null); }}
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

            {/* Create entry toggle */}
            <label
              className="flex items-center gap-1.5 ml-2 cursor-pointer select-none"
              onMouseDown={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={createEntryMode}
                onChange={e => { setCreateEntryMode(e.target.checked); setResult(null); setEntryJson(null); }}
                className="accent-primary w-3.5 h-3.5"
              />
              <span className="text-xs text-muted-foreground">Create entry</span>
            </label>
          </div>
        )}

        {/* Word count — hidden in create-entry mode */}
        {!(isCodexDistill && createEntryMode) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Words</span>
            <input
              type="number"
              min={50}
              max={10000}
              step={50}
              value={displayWordCount}
              onChange={e => updateAttributes({ wordCount: e.target.value })}
              onKeyDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              className="bg-background text-xs rounded border border-border px-1.5 py-1 outline-none w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {[600, 800, 1000].map(n => (
              <button
                key={n}
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => updateAttributes({ wordCount: String(n) })}
                className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded border transition-colors",
                  displayWordCount === n
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
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

        {/* Context — scenes */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">Scenes</span>
          <div className="flex flex-wrap gap-1 flex-1">
            <span className="text-[11px] bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
              Current scene
              <span className="text-muted-foreground/50 text-[10px]">auto</span>
            </span>
            {extraSceneIds.map(id => {
              const sc = projectScenes.find(s => s.id === id);
              return (
                <span key={id} className="text-[11px] bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                  {sc ? sc.title : `Scene #${id}`}
                  <button
                    type="button"
                    onClick={() => updateAttributes({ sceneIds: extraSceneIds.filter(i => i !== id).join(",") })}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
            {projectScenes.filter(s => s.id !== sceneId && !extraSceneIds.includes(s.id)).length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) updateAttributes({ sceneIds: [...extraSceneIds, Number(e.target.value)].join(",") }); }}
                onMouseDown={e => e.stopPropagation()}
                className="text-[11px] bg-background border border-border rounded px-1.5 py-0.5 outline-none text-muted-foreground"
              >
                <option value="">+ Add scene…</option>
                {projectScenes
                  .filter(s => s.id !== sceneId && !extraSceneIds.includes(s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
              </select>
            )}
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

        {/* Prompt / author notes */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0 pt-1.5">
            {isCodexDistill && createEntryMode ? "Notes" : "Prompt"}
          </span>
          <textarea
            value={prompt}
            onChange={e => updateAttributes({ prompt: e.target.value })}
            onKeyDown={e => e.stopPropagation()}
            placeholder={
              isCodexDistill && createEntryMode
                ? "Additional author notes for the entry… (optional)"
                : "Instructions for the AI… (optional)"
            }
            rows={2}
            className="flex-1 bg-background text-xs rounded border border-border px-2 py-1.5 outline-none resize-none"
          />
        </div>

        {/* ── Result: text mode ── */}
        {result && !entryJson && (
          <div className="rounded border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground/90 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
            {result}
          </div>
        )}

        {/* ── Result: entry JSON preview ── */}
        {entryJson && (
          <div className="rounded border border-border/60 bg-background/60 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <BookPlus className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
              <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                Entry extracted
              </span>
            </div>
            <div className="text-xs space-y-0.5">
              <div>
                <span className="text-muted-foreground">Name: </span>
                <span className="font-medium">{entryJson.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type: </span>
                <span className="capitalize">{entryJson.entry_type ?? entryType}</span>
                {(entryJson.species || (entryJson as any).subtype) && (
                  <span className="text-muted-foreground">
                    {" "}· {entryJson.species ?? (entryJson as any).subtype}
                  </span>
                )}
              </div>
              {entryJson.description && (
                <div className="text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap leading-relaxed pt-0.5">
                  {entryJson.description.slice(0, 200)}{entryJson.description.length > 200 ? "…" : ""}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!effectiveModel || !sceneId || generating}
            onClick={handleGenerate}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-opacity disabled:opacity-40"
            style={{ background: `${ACCENT}25`, color: ACCENT }}
          >
            {generating
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> {isCodexDistill && createEntryMode ? "Extracting…" : "Generating…"}</>
              : <><Sparkles className="h-3 w-3" /> {isCodexDistill && createEntryMode ? "Extract entry" : "Generate"}</>
            }
          </button>

          {/* Text result actions */}
          {result && !entryJson && (
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

          {/* Entry JSON actions */}
          {entryJson && (
            <>
              <button
                type="button"
                onClick={handleOpenInCodex}
                disabled={!onPrefillEntry}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium bg-primary text-primary-foreground disabled:opacity-40"
              >
                <BookPlus className="h-3 w-3" />
                Open in Codex
              </button>
              <button
                type="button"
                onClick={() => setEntryJson(null)}
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
      model:      { default: "", parseHTML: el => el.getAttribute("data-model")      ?? "" },
      codexIds:   { default: "", parseHTML: el => el.getAttribute("data-codex-ids")  ?? "" },
      sceneIds:   { default: "", parseHTML: el => el.getAttribute("data-scene-ids")  ?? "" },
      prompt:     { default: "", parseHTML: el => el.getAttribute("data-prompt")     ?? "" },
      promptId:   { default: "", parseHTML: el => el.getAttribute("data-prompt-id")  ?? "" },
      wordCount:  { default: "", parseHTML: el => el.getAttribute("data-word-count") ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ki"]', priority: 100 }];
  },

  renderHTML({ node }) {
    return ["div", {
      "data-type":       "ki",
      "data-model":      node.attrs.model,
      "data-codex-ids":  node.attrs.codexIds,
      "data-scene-ids":  node.attrs.sceneIds,
      "data-prompt":     node.attrs.prompt,
      "data-prompt-id":  node.attrs.promptId,
      "data-word-count": node.attrs.wordCount,
    }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KiNodeView);
  },
});

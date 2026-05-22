"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import type { EditorView } from "@tiptap/pm/view";
import type { CodexEntry } from "@/types";
import { createCodexHighlightPlugin, patchEntryAliases, type PatchedEntry, PLUGIN_KEY } from "./CodexHighlightExtension";
import { TagDecorationExtension } from "./TagDecorationExtension";
import { LineNumberExtension } from "./LineNumberExtension";
import { GhostTextMark } from "./GhostTextExtension";
import { FocusDimExtension, FOCUS_DIM_KEY } from "./FocusDimExtension";
import { SensitivityMark, getSensitivityFlags, type FlagItem } from "./SensitivityExtension";
import { NoteNode } from "./nodes/NoteNode";
import { CurrencyNode } from "./nodes/CurrencyNode";
import { ItemNode } from "./nodes/ItemNode";
import { SceneImageNode } from "./nodes/SceneImageNode";
import { KiNode } from "./nodes/KiNode";
import { SlashCommandMenu, COMMANDS, type CommandItem, type SlashMenuHandle } from "./SlashCommandMenu";
import { FormattingToolbar } from "./FormattingToolbar";
import { EditorContext } from "@/contexts/EditorContext";
import { useUIStore } from "@/store/ui";

interface Props {
  content: string;
  onChange: (html: string) => void;
  codexEntries: CodexEntry[];
  onCodexEntryClick: (id: number) => void;
  sceneId: number;
  onOpenChat?: () => void;
  onOpenTimeline?: () => void;
  onWordSelect?: (word: string | null) => void;
  onFlagsChange?: (flags: FlagItem[]) => void;
  replaceWordRef?: React.MutableRefObject<((word: string) => void) | null>;
  applyFlagRef?: React.MutableRefObject<((type: string) => void) | null>;
}

interface SlashState {
  items: CommandItem[];
  rect: DOMRect | null;
  command: (item: CommandItem) => void;
}

// ── Typewriter scroll helper ───────────────────────────────────────────────────
// Called either from handleScrollToSelection (typing) or selectionUpdate (click/arrow).
// Returns true if a scroll was applied.
function applyTypewriterScroll(
  view: EditorView,
  container: HTMLDivElement,
  offsetPct: number,
): void {
  try {
    const { from } = view.state.selection;
    const coords  = view.coordsAtPos(from);
    const rect    = container.getBoundingClientRect();
    const target  = rect.height * (offsetPct / 100);
    const current = coords.top - rect.top;
    const diff    = current - target;
    if (Math.abs(diff) > 2) container.scrollTop += diff;
  } catch { /* view not mounted */ }
}

export function TipTapEditor({ content, onChange, codexEntries, onCodexEntryClick, sceneId, onOpenChat, onOpenTimeline, onWordSelect, onFlagsChange, replaceWordRef, applyFlagRef }: Props) {
  const showLineNumbers  = useUIStore((s) => s.showParagraphNumbers);
  const typewriterMode   = useUIStore((s) => s.typewriterMode);
  const typewriterOffset = useUIStore((s) => s.typewriterOffset);
  const focusMode        = useUIStore((s) => s.focusMode);

  const entriesRef = useRef<PatchedEntry[]>(patchEntryAliases(codexEntries));
  const onClickRef = useRef(onCodexEntryClick);
  entriesRef.current = patchEntryAliases(codexEntries);
  onClickRef.current = onCodexEntryClick;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Always-current refs so closures inside useEditor (created once) see live values.
  const typewriterModeRef   = useRef(typewriterMode);
  const typewriterOffsetRef = useRef(typewriterOffset);
  typewriterModeRef.current   = typewriterMode;
  typewriterOffsetRef.current = typewriterOffset;

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null);
  const setSlashMenuRef = useRef<(s: SlashState | null) => void>(() => {});
  setSlashMenuRef.current = setSlashMenu;
  const menuHandleRef = useRef<SlashMenuHandle | null>(null);
  const onOpenChatRef = useRef(onOpenChat);
  onOpenChatRef.current = onOpenChat;
  const onOpenTimelineRef = useRef(onOpenTimeline);
  onOpenTimelineRef.current = onOpenTimeline;
  const onWordSelectRef  = useRef(onWordSelect);
  onWordSelectRef.current  = onWordSelect;
  const onFlagsChangeRef = useRef(onFlagsChange);
  onFlagsChangeRef.current = onFlagsChange;

  // ── Extensions ──────────────────────────────────────────────────────────────

  const CodexHighlight = Extension.create({
    name: "codexHighlight",
    addProseMirrorPlugins() {
      return [
        createCodexHighlightPlugin(
          () => entriesRef.current,
          (id) => onClickRef.current(id)
        ),
      ];
    },
  });

  const SlashCommandExtension = Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      return [
        Suggestion<CommandItem, CommandItem>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          allowedPrefixes: null,
          startOfLine: false,
          items({ query }) {
            const q = query.toLowerCase();
            return q
              ? COMMANDS.filter(
                  (c) =>
                    c.label.toLowerCase().startsWith(q) ||
                    c.keywords.some((k) => k.startsWith(q))
                )
              : [...COMMANDS];
          },
          render: () => ({
            onStart(props) {
              setSlashMenuRef.current({ items: props.items, rect: props.clientRect?.() ?? null, command: props.command });
            },
            onUpdate(props) {
              setSlashMenuRef.current({ items: props.items, rect: props.clientRect?.() ?? null, command: props.command });
            },
            onExit() { setSlashMenuRef.current(null); },
            onKeyDown({ event, view }) {
              if (event.key === "Escape") { exitSuggestion(view); return true; }
              return menuHandleRef.current?.handleKey(event) ?? false;
            },
          }),
          command({ editor, range, props }) {
            if (props.id === "chat") {
              editor.chain().focus().deleteRange(range).run();
              onOpenChatRef.current?.();
            } else if (props.id === "timeline") {
              editor.chain().focus().deleteRange(range).run();
              onOpenTimelineRef.current?.();
            } else if (props.id === "placeholder") {
              editor.chain()
                .focus()
                .deleteRange(range)
                .insertContent('<span data-ghost="" class="ghost-text">[placeholder]</span>')
                .unsetMark("ghostText")
                .run();
            } else if (props.content) {
              editor.chain().focus().deleteRange(range).insertContent(props.content()).run();
            }
          },
        }),
      ];
    },
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing your scene… (type / to insert a command)" }),
      CodexHighlight,
      TagDecorationExtension,
      NoteNode,
      CurrencyNode,
      ItemNode,
      SceneImageNode,
      KiNode,
      SlashCommandExtension,
      LineNumberExtension,
      GhostTextMark,
      FocusDimExtension,
      SensitivityMark,
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      onFlagsChangeRef.current?.(getSensitivityFlags(editor));
    },
    editorProps: {
      attributes: { class: "story-prose prose-invert max-w-2xl mx-auto w-full focus:outline-none min-h-full px-8 py-6", spellcheck: "true" },
      // Intercept ProseMirror's own "scroll cursor into view" so we own the
      // scroll entirely — no race condition with the browser/PM auto-scroll.
      handleScrollToSelection: (view) => {
        if (!typewriterModeRef.current) return false; // let PM scroll normally
        const container = scrollRef.current;
        if (!container) return false;
        requestAnimationFrame(() => applyTypewriterScroll(view, container, typewriterOffsetRef.current));
        return true; // consumed — PM will not scroll
      },
    },
  });

  // Sync content from outside (initial load / scene switch)
  const prevSceneContent = useRef(content);
  useEffect(() => {
    if (!editor) return;
    if (content !== prevSceneContent.current && content !== editor.getHTML()) {
      prevSceneContent.current = content;
      queueMicrotask(() => {
        editor.commands.setContent(content || "", false);
      });
    }
  }, [content, editor]);

  // Re-trigger codex decorations when entries change
  useEffect(() => {
    if (!editor) return;
    const { tr } = editor.state;
    editor.view.dispatch(tr.setMeta(PLUGIN_KEY, true));
  }, [codexEntries, editor]);

  // Toggle focus-dim plugin when focusMode changes
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(FOCUS_DIM_KEY, focusMode));
  }, [editor, focusMode]);

  // Typewriter: also snap on cursor movement (click / arrow keys).
  // Typing is already handled by handleScrollToSelection above.
  // Also fires onWordSelect for the thesaurus panel.
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => {
      // Typewriter scroll
      if (typewriterModeRef.current && scrollRef.current) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            applyTypewriterScroll(editor.view, scrollRef.current, typewriterOffsetRef.current);
          }
        });
      }
      // Word selection for thesaurus
      if (onWordSelectRef.current) {
        const { from, to, empty } = editor.state.selection;
        if (!empty) {
          const text = editor.state.doc.textBetween(from, to, " ").trim();
          // Only fire for single-word selections (no spaces)
          onWordSelectRef.current(/^\S+$/.test(text) ? text : null);
        } else {
          onWordSelectRef.current(null);
        }
      }
      // Flags
      onFlagsChangeRef.current?.(getSensitivityFlags(editor));
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => { editor.off("selectionUpdate", onSelectionUpdate); };
  }, [editor]);

  // Wire replaceWordRef so parent can trigger word replacement
  useEffect(() => {
    if (!replaceWordRef) return;
    replaceWordRef.current = (word: string) => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      editor.chain().focus().deleteRange({ from, to }).insertContent(word).run();
    };
  }, [editor, replaceWordRef]);

  // Wire applyFlagRef so parent can apply sensitivity marks
  useEffect(() => {
    if (!applyFlagRef) return;
    applyFlagRef.current = (type: string) => {
      if (!editor) return;
      const { empty } = editor.state.selection;
      if (empty) return;
      const isActive = editor.isActive("sensitivityFlag", { type });
      if (isActive) {
        editor.chain().focus().unsetMark("sensitivityFlag").run();
      } else {
        editor.chain().focus().setMark("sensitivityFlag", { type }).run();
      }
    };
  }, [editor, applyFlagRef]);

  // Typewriter: update ProseMirror top/bottom padding so the cursor can reach
  // the target position even on the very first or very last line.
  useEffect(() => {
    if (!editor) return;
    const pm = editor.view.dom as HTMLElement;
    const h  = scrollRef.current?.clientHeight ?? 0;
    if (typewriterMode && h > 0) {
      pm.style.paddingTop    = `${(typewriterOffset / 100) * h}px`;
      pm.style.paddingBottom = `${((100 - typewriterOffset) / 100) * h}px`;
    } else {
      pm.style.paddingTop    = "";
      pm.style.paddingBottom = "";
    }
  }, [editor, typewriterMode, typewriterOffset]);

  const characters = codexEntries.filter((e) => e.entry_type === "character");
  const items = codexEntries.filter((e) => e.entry_type === "item");

  const closeSlash = useCallback(() => {
    setSlashMenuRef.current(null);
    if (editor) exitSuggestion(editor.view);
  }, [editor]);

  const wrapperClass = [
    "h-full overflow-y-auto relative",
    showLineNumbers ? "has-line-numbers" : "",
    focusMode ? "focus-mode" : "",
  ].filter(Boolean).join(" ");

  return (
    <EditorContext.Provider value={{ characters, items, allEntries: codexEntries, sceneId, projectId: codexEntries[0]?.project_id ?? 0 }}>
      <div ref={scrollRef} className={wrapperClass}>
        <EditorContent editor={editor} className="h-full" />
        {editor && <FormattingToolbar editor={editor} />}
        {slashMenu && (
          <SlashCommandMenu
            ref={menuHandleRef}
            items={slashMenu.items}
            rect={slashMenu.rect}
            onSelect={slashMenu.command}
            onClose={closeSlash}
          />
        )}
      </div>
    </EditorContext.Provider>
  );
}

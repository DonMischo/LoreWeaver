"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import type { CodexEntry } from "@/types";
import { createCodexHighlightPlugin, patchEntryAliases, type PatchedEntry, PLUGIN_KEY } from "./CodexHighlightExtension";
import { TagDecorationExtension } from "./TagDecorationExtension";
import { LineNumberExtension } from "./LineNumberExtension";
import { GhostTextMark } from "./GhostTextExtension";
import { FocusDimExtension, FOCUS_DIM_KEY } from "./FocusDimExtension";
import { NoteNode } from "./nodes/NoteNode";
import { CurrencyNode } from "./nodes/CurrencyNode";
import { ItemNode } from "./nodes/ItemNode";
import { SceneImageNode } from "./nodes/SceneImageNode";
import { KiNode } from "./nodes/KiNode";
import { SlashCommandMenu, COMMANDS, type CommandItem, type SlashMenuHandle } from "./SlashCommandMenu";
import { EditorContext } from "@/contexts/EditorContext";
import { useUIStore } from "@/store/ui";

interface Props {
  content: string;
  onChange: (html: string) => void;
  codexEntries: CodexEntry[];
  onCodexEntryClick: (id: number) => void;
  sceneId: number;
  onOpenChat?: () => void;
}

interface SlashState {
  items: CommandItem[];
  rect: DOMRect | null;
  command: (item: CommandItem) => void;
}

export function TipTapEditor({ content, onChange, codexEntries, onCodexEntryClick, sceneId, onOpenChat }: Props) {
  const showLineNumbers  = useUIStore((s) => s.showParagraphNumbers);
  const typewriterMode   = useUIStore((s) => s.typewriterMode);
  const typewriterOffset = useUIStore((s) => s.typewriterOffset);
  const focusMode        = useUIStore((s) => s.focusMode);

  const entriesRef = useRef<PatchedEntry[]>(patchEntryAliases(codexEntries));
  const onClickRef = useRef(onCodexEntryClick);
  entriesRef.current = patchEntryAliases(codexEntries);
  onClickRef.current = onCodexEntryClick;

  // Scroll container ref — used by typewriter mode
  const scrollRef = useRef<HTMLDivElement>(null);

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null);
  const setSlashMenuRef = useRef<(s: SlashState | null) => void>(() => {});
  setSlashMenuRef.current = setSlashMenu;
  const menuHandleRef = useRef<SlashMenuHandle | null>(null);
  const onOpenChatRef = useRef(onOpenChat);
  onOpenChatRef.current = onOpenChat;

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
            } else if (props.id === "placeholder") {
              // Insert ghost-text HTML; parsed by GhostTextMark's parseHTML rule
              editor.chain()
                .focus()
                .deleteRange(range)
                .insertContent('<span data-ghost="" class="ghost-text">[placeholder]</span>')
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
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "story-prose prose-invert max-w-2xl mx-auto w-full focus:outline-none min-h-full px-8 py-6" },
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

  // Typewriter scroll: keep cursor at typewriterOffset% from top
  useEffect(() => {
    if (!editor || !typewriterMode) return;
    const scroll = () => {
      const container = scrollRef.current;
      if (!container) return;
      try {
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        const rect = container.getBoundingClientRect();
        const target = rect.height * (typewriterOffset / 100);
        const current = coords.top - rect.top;
        const diff = current - target;
        if (Math.abs(diff) > 2) container.scrollTop += diff;
      } catch { /* editor not mounted yet */ }
    };
    editor.on("selectionUpdate", scroll);
    editor.on("update", scroll);
    return () => {
      editor.off("selectionUpdate", scroll);
      editor.off("update", scroll);
    };
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

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import type { CodexEntry } from "@/types";
import { createCodexHighlightPlugin, patchEntryAliases, type PatchedEntry } from "./CodexHighlightExtension";
import { TagDecorationExtension } from "./TagDecorationExtension";
import { NoteNode } from "./nodes/NoteNode";
import { CurrencyNode } from "./nodes/CurrencyNode";
import { ItemNode } from "./nodes/ItemNode";
import { SceneImageNode } from "./nodes/SceneImageNode";
import { SlashCommandMenu, type SlashMenuState, type SlashMenuHandle } from "./SlashCommandMenu";
import { EditorContext } from "@/contexts/EditorContext";

interface Props {
  content: string;
  onChange: (html: string) => void;
  codexEntries: CodexEntry[];
  onCodexEntryClick: (id: number) => void;
  sceneId: number;
}

export function TipTapEditor({ content, onChange, codexEntries, onCodexEntryClick, sceneId }: Props) {
  const entriesRef = useRef<PatchedEntry[]>(patchEntryAliases(codexEntries));
  const onClickRef = useRef(onCodexEntryClick);
  entriesRef.current = patchEntryAliases(codexEntries);
  onClickRef.current = onCodexEntryClick;

  // Slash menu state — both a React state (for rendering) and a ref (for stale-closure-safe reads
  // inside useEditor callbacks which are created once and never updated).
  const [slashMenu, setSlashMenuRaw] = useState<SlashMenuState | null>(null);
  const slashMenuRef = useRef<SlashMenuState | null>(null);
  const slashMenuHandleRef = useRef<SlashMenuHandle | null>(null);

  // Stable setter that keeps ref and state in sync.
  // Written as a mutable ref so useEditor callbacks can call it without stale closure issues.
  const setSlashMenuFnRef = useRef((_val: SlashMenuState | null) => {});
  setSlashMenuFnRef.current = (val: SlashMenuState | null) => {
    slashMenuRef.current = val;
    setSlashMenuRaw(val);
  };

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing your scene… (type / to insert a command)" }),
      CodexHighlight,
      TagDecorationExtension,
      NoteNode,
      CurrencyNode,
      ItemNode,
      SceneImageNode,
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());

      const setSlashMenu = setSlashMenuFnRef.current;
      const { state } = editor;
      const { from } = state.selection;
      const current = slashMenuRef.current;

      if (current) {
        // Cursor moved before or onto the slash — close
        if (from <= current.from) {
          setSlashMenu(null);
          return;
        }
        // Query = text between slash+1 and cursor
        const query = state.doc.textBetween(current.from + 1, from, "\n", "\0");
        // Space/newline means user typed past the command word — close
        if (/[\s\n]/.test(query)) {
          setSlashMenu(null);
          return;
        }
        if (query !== current.query) {
          setSlashMenu({ ...current, query });
        }
        return;
      }

      // No menu open — check if '/' was just typed
      if (from < 1) return;
      const charBefore = state.doc.textBetween(from - 1, from, "\n", "\0");
      if (charBefore === "/") {
        const charBeforeSlash = from > 1
          ? state.doc.textBetween(from - 2, from - 1, "\n", "\0")
          : "";
        if (charBeforeSlash === "" || charBeforeSlash === "\n" || charBeforeSlash === " ") {
          const coords = editor.view.coordsAtPos(from);
          setSlashMenu({ from: from - 1, rect: { left: coords.left, top: coords.bottom }, query: "" });
        }
      }
    },
    editorProps: {
      attributes: { class: "story-prose prose-invert max-w-2xl mx-auto w-full focus:outline-none min-h-full px-8 py-6" },
      handleKeyDown(_view, event) {
        // Route arrow/enter/tab into the slash menu when it is open
        if (slashMenuRef.current && slashMenuHandleRef.current) {
          if (slashMenuHandleRef.current.handleKey(event)) {
            return true;
          }
        }
        if (event.key === "Escape" && slashMenuRef.current) {
          setSlashMenuFnRef.current(null);
          return true;
        }
        return false;
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
    editor.view.dispatch(tr.setMeta("codexHighlight", true));
  }, [codexEntries, editor]);

  const characters = codexEntries.filter((e) => e.entry_type === "character");
  const items = codexEntries.filter((e) => e.entry_type === "item");

  const closeSlash = useCallback(() => setSlashMenuFnRef.current(null), []);

  return (
    <EditorContext.Provider value={{ characters, items, sceneId }}>
      <div className="h-full overflow-y-auto relative">
        <EditorContent editor={editor} className="h-full" />
        {slashMenu && editor && (
          <SlashCommandMenu
            ref={slashMenuHandleRef}
            editor={editor}
            state={slashMenu}
            onClose={closeSlash}
          />
        )}
      </div>
    </EditorContext.Provider>
  );
}

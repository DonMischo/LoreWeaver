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
import { NoteNode } from "./nodes/NoteNode";
import { CurrencyNode } from "./nodes/CurrencyNode";
import { ItemNode } from "./nodes/ItemNode";
import { SceneImageNode } from "./nodes/SceneImageNode";
import { KiNode } from "./nodes/KiNode";
import { SlashCommandMenu, COMMANDS, type CommandItem, type SlashMenuHandle } from "./SlashCommandMenu";
import { EditorContext } from "@/contexts/EditorContext";

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
  const entriesRef = useRef<PatchedEntry[]>(patchEntryAliases(codexEntries));
  const onClickRef = useRef(onCodexEntryClick);
  entriesRef.current = patchEntryAliases(codexEntries);
  onClickRef.current = onCodexEntryClick;

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null);

  // Bridge refs — accessible from inside the ProseMirror plugin (created once),
  // but always pointing to the latest React state/callbacks via .current.
  const setSlashMenuRef = useRef<(s: SlashState | null) => void>(() => {});
  setSlashMenuRef.current = setSlashMenu;

  const menuHandleRef = useRef<SlashMenuHandle | null>(null);

  const onOpenChatRef = useRef(onOpenChat);
  onOpenChatRef.current = onOpenChat;

  // --- Extensions (created once by useEditor) ---

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

  // Slash commands via @tiptap/suggestion — reliable ProseMirror-level detection
  // that survives node insertions, cursor movements, and React re-renders.
  const SlashCommandExtension = Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      return [
        Suggestion<CommandItem, CommandItem>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          // null = any character (or start-of-block) may precede the trigger
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
              setSlashMenuRef.current({
                items: props.items,
                rect: props.clientRect?.() ?? null,
                command: props.command,
              });
            },
            onUpdate(props) {
              setSlashMenuRef.current({
                items: props.items,
                rect: props.clientRect?.() ?? null,
                command: props.command,
              });
            },
            onExit() {
              setSlashMenuRef.current(null);
            },
            onKeyDown({ event, view }) {
              if (event.key === "Escape") {
                // exitSuggestion dispatches a metadata-only transaction that
                // signals the plugin to call onExit and clear its state.
                exitSuggestion(view);
                return true;
              }
              return menuHandleRef.current?.handleKey(event) ?? false;
            },
          }),
          command({ editor, range, props }) {
            if (props.content) {
              // Single atomic transaction: delete the "/" + query, then insert the node.
              editor.chain().focus().deleteRange(range).insertContent(props.content()).run();
            } else if (props.id === "chat") {
              editor.chain().focus().deleteRange(range).run();
              onOpenChatRef.current?.();
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

  const characters = codexEntries.filter((e) => e.entry_type === "character");
  const items = codexEntries.filter((e) => e.entry_type === "item");

  // Dismiss the slash menu and tell the Suggestion plugin to exit cleanly.
  const closeSlash = useCallback(() => {
    setSlashMenuRef.current(null);
    if (editor) exitSuggestion(editor.view);
  }, [editor]);

  return (
    <EditorContext.Provider value={{ characters, items, allEntries: codexEntries, sceneId, projectId: codexEntries[0]?.project_id ?? 0 }}>
      <div className="h-full overflow-y-auto relative">
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

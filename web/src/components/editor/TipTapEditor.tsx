"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import type { CodexEntry } from "@/types";
import { createCodexHighlightPlugin, patchEntryAliases } from "./CodexHighlightExtension";
import { TagDecorationExtension } from "./TagDecorationExtension";

interface Props {
  content: string;
  onChange: (html: string) => void;
  codexEntries: CodexEntry[];
  onCodexEntryClick: (id: number) => void;
}

export function TipTapEditor({ content, onChange, codexEntries, onCodexEntryClick }: Props) {
  const entriesRef = useRef(codexEntries);
  const onClickRef = useRef(onCodexEntryClick);
  entriesRef.current = patchEntryAliases(codexEntries);
  onClickRef.current = onCodexEntryClick;

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
      Placeholder.configure({ placeholder: "Start writing your scene..." }),
      CodexHighlight,
      TagDecorationExtension,
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "story-prose prose-invert max-w-2xl mx-auto w-full focus:outline-none min-h-full px-8 py-6" },
    },
  });

  // Sync content from outside (initial load / scene switch) without infinite loop
  const prevSceneContent = useRef(content);
  useEffect(() => {
    if (!editor) return;
    if (content !== prevSceneContent.current && content !== editor.getHTML()) {
      editor.commands.setContent(content || "", false);
      prevSceneContent.current = content;
    }
  }, [content, editor]);

  // Re-trigger codex decorations when entries change
  useEffect(() => {
    if (!editor) return;
    const { tr } = editor.state;
    editor.view.dispatch(tr.setMeta("codexHighlight", true));
  }, [codexEntries, editor]);

  return (
    <div className="h-full overflow-y-auto">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}

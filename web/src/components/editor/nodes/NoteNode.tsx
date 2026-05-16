"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { X, StickyNote } from "lucide-react";

// ── NodeView ──────────────────────────────────────────────────────────────────

export function NoteNodeView({ deleteNode }: any) {
  return (
    <NodeViewWrapper as="div">
      <div
        className="my-3 rounded-lg border-l-[3px] px-4 py-3"
        style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.08)" }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <StickyNote className="h-3.5 w-3.5 shrink-0" style={{ color: "#f59e0b" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#f59e0b" }}>
            Note
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={deleteNode}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* NodeViewContent = editable content slot rendered by TipTap */}
        <NodeViewContent
          as="div"
          className="text-sm text-foreground/90 outline-none [&>p]:m-0"
        />
      </div>
    </NodeViewWrapper>
  );
}

// ── Node definition ───────────────────────────────────────────────────────────

export const NoteNode = Node.create({
  name: "note",
  group: "block",
  content: "paragraph+",
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="note"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "note" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteNodeView);
  },
});

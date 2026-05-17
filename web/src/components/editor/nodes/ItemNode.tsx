"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Package, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorContext } from "@/contexts/EditorContext";
import { useItemLog } from "@/store/queries";

// ── NodeView ──────────────────────────────────────────────────────────────────

export function ItemNodeView({ node, updateAttributes, deleteNode }: any) {
  const { characters, items, sceneId } = useEditorContext();
  const { charId, itemId, qty } = node.attrs as {
    charId: number; itemId: number; qty: number;
  };

  const { data: log = [] } = useItemLog(sceneId, itemId, charId);

  return (
    <NodeViewWrapper as="div">
      <div
        className="my-3 rounded-lg border-l-[3px] px-4 py-2.5"
        style={{ borderColor: "#3b82f6", background: "rgba(59,130,246,0.08)" }}
        contentEditable={false}
      >
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <Package className="h-4 w-4 shrink-0" style={{ color: "#3b82f6" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#3b82f6" }}>
            Item
          </span>

          {/* Item select */}
          <select
            value={itemId}
            onChange={(e) => updateAttributes({ itemId: Number(e.target.value) })}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-background text-sm rounded border border-border px-1.5 py-0.5 outline-none h-7"
          >
            <option value={0}>— item —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>

          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {/* Character select */}
          <select
            value={charId}
            onChange={(e) => updateAttributes({ charId: Number(e.target.value) })}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-background text-sm rounded border border-border px-1.5 py-0.5 outline-none h-7"
          >
            <option value={0}>— character —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Quantity */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              value={qty}
              onChange={(e) => updateAttributes({ qty: Number(e.target.value) })}
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-background text-sm text-center rounded border border-border w-16 h-7 outline-none"
            />
          </div>

          <div className="flex-1" />
          <button type="button" onClick={deleteNode} className="text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Get/lost log */}
        {log.length > 0 && (
          <div className="mt-2 border-t border-border/40 pt-2 space-y-0.5">
            {log.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  entry.is_current_scene
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                <span className={cn(
                  "font-mono w-6 shrink-0 text-right",
                  entry.qty > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {entry.qty > 0 ? `+${entry.qty}` : entry.qty}
                </span>
                <span className="truncate">{entry.scene_title}</span>
                {entry.is_current_scene && (
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">← here</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ── Node definition ───────────────────────────────────────────────────────────

export const ItemNode = Node.create({
  name: "item",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      charId: { default: 0, parseHTML: (el) => Number(el.getAttribute("data-char-id") ?? 0) },
      itemId: { default: 0, parseHTML: (el) => Number(el.getAttribute("data-item-id") ?? 0) },
      qty:    { default: 1, parseHTML: (el) => Number(el.getAttribute("data-qty") ?? 1) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="item"]', priority: 100 }];
  },

  renderHTML({ node }) {
    return ["div", {
      "data-type": "item",
      "data-char-id": String(node.attrs.charId),
      "data-item-id": String(node.attrs.itemId),
      "data-qty": String(node.attrs.qty),
    }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ItemNodeView);
  },
});

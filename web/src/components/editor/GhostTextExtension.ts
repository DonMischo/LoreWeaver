import { Mark, mergeAttributes, markInputRule } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

// ── Mark definition ───────────────────────────────────────────────────────────

export const GhostTextMark = Mark.create({
  name: "ghostText",

  parseHTML() {
    return [{ tag: 'span[data-ghost]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-ghost': '', class: 'ghost-text' }), 0];
  },

  // Typing [text] automatically applies the mark to the whole [text] token.
  addInputRules() {
    return [
      markInputRule({
        find: /(\[[^\]]+\])$/,
        type: this.type,
      }),
    ];
  },
});

// ── Utility: collect all ghost texts from the editor doc ─────────────────────

export interface GhostTextItem {
  text: string;
  from: number;
  to: number;
}

export function getGhostTexts(editor: Editor): GhostTextItem[] {
  const results: GhostTextItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type.name === "ghostText")) {
      results.push({ text: node.text ?? "", from: pos, to: pos + node.nodeSize });
    }
  });
  return results;
}

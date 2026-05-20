import { Mark, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

export type SensitivityType = "sensitivity" | "cultural" | "research";

export const SENSITIVITY_TYPES: { id: SensitivityType; label: string; color: string }[] = [
  { id: "sensitivity", label: "Sensitivity",       color: "text-rose-400" },
  { id: "cultural",   label: "Cultural",           color: "text-violet-400" },
  { id: "research",   label: "Research needed",    color: "text-sky-400" },
];

export const SensitivityMark = Mark.create({
  name: "sensitivityFlag",

  addAttributes() {
    return {
      type: { default: "sensitivity" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-flag]", getAttrs: (el) => ({ type: (el as HTMLElement).dataset.flag }) }];
  },

  renderHTML({ HTMLAttributes }) {
    const t = HTMLAttributes.type ?? "sensitivity";
    return ["span", mergeAttributes(HTMLAttributes, { "data-flag": t, class: `sensitivity-flag sensitivity-flag--${t}` }), 0];
  },
});

// ── Utility: collect all flags from the editor doc ────────────────────────────

export interface FlagItem {
  text: string;
  type: SensitivityType;
  from: number;
  to: number;
}

export function getSensitivityFlags(editor: Editor): FlagItem[] {
  const results: FlagItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const m = node.marks.find((m) => m.type.name === "sensitivityFlag");
    if (m) results.push({ text: node.text ?? "", type: m.attrs.type, from: pos, to: pos + node.nodeSize });
  });
  return results;
}

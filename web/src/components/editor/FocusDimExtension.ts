import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

export const FOCUS_DIM_KEY = new PluginKey<{ enabled: boolean; decos: DecorationSet }>("focusDim");

function buildDim(doc: Node, activeOffset: number): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (offset !== activeOffset) {
      decos.push(Decoration.node(offset, offset + node.nodeSize, { class: "focus-dim" }));
    }
  });
  return DecorationSet.create(doc, decos);
}

export const FocusDimExtension = Extension.create({
  name: "focusDim",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: FOCUS_DIM_KEY,
        state: {
          init() {
            return { enabled: false, decos: DecorationSet.empty };
          },
          apply(tr, prev, _, newState) {
            const toggle = tr.getMeta(FOCUS_DIM_KEY);
            const enabled = toggle !== undefined ? Boolean(toggle) : prev.enabled;
            if (!enabled) return { enabled, decos: DecorationSet.empty };
            if (toggle !== undefined || tr.docChanged || tr.selectionSet) {
              const $anchor = newState.selection.$anchor;
              const activeOffset = $anchor.depth > 0 ? $anchor.before(1) : -1;
              return { enabled, decos: buildDim(tr.doc, activeOffset) };
            }
            return { ...prev, enabled };
          },
        },
        props: {
          decorations(state) {
            return FOCUS_DIM_KEY.getState(state)?.decos ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const KEY = new PluginKey<DecorationSet>("lineNumbers");

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0]): DecorationSet {
  const decos: Decoration[] = [];
  let lineNum = 0;

  doc.forEach((node, offset) => {
    lineNum++;
    const display =
      lineNum % 10 === 0 ? String(lineNum) :
      lineNum % 5  === 0 ? "·" : "";
    if (display) {
      decos.push(
        Decoration.node(offset, offset + node.nodeSize, { "data-line": display })
      );
    }
  });

  return DecorationSet.create(doc, decos);
}

export const LineNumberExtension = Extension.create({
  name: "lineNumbers",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: KEY,
        state: {
          init(_, { doc }) { return buildDecorations(doc); },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return KEY.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/**
 * TipTap ProseMirror plugin that visually decorates inline tags without
 * altering the saved content. The raw syntax is preserved in storage.
 *
 * Supported syntax:
 *   {time:day 6|Event Name}          → amber badge
 *   {time:year 1337, 6th month|Coronation}
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const PLUGIN_KEY = new PluginKey("tagDecorations");

const TIME_RE = /\{time:([^}|]+?)(?:\|([^}]*))?\}/g;

function buildDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    const text: string = node.text;

    // ── {time:...} ──
    for (const m of text.matchAll(TIME_RE)) {
      const from = pos + m.index!;
      const to   = from + m[0].length;
      const timeStr  = m[1].trim();
      const eventName = m[2]?.trim() ?? "";
      const label = eventName ? `${timeStr} — ${eventName}` : timeStr;

      decorations.push(
        Decoration.inline(from, to, {
          class: "tag-time",
          "data-time": timeStr,
          "data-event": eventName,
          title: `Time event: ${label}`,
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const TagDecorationExtension = Extension.create({
  name: "tagDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init(_, { doc }) { return buildDecorations(doc); },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) { return PLUGIN_KEY.getState(state); },
        },
      }),
    ];
  },
});

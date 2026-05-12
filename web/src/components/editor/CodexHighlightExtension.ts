import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { CodexEntry } from "@/types";

const PLUGIN_KEY = new PluginKey("codexHighlight");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface PatchedEntry extends CodexEntry {
  _allTerms: string[];
}

export function patchEntryAliases(entries: CodexEntry[]): PatchedEntry[] {
  return entries.map((e) => ({
    ...e,
    _allTerms: [e.name, ...(Array.isArray(e.aliases) ? e.aliases : [])].sort((a, b) => b.length - a.length),
  }));
}

function buildDecorations(doc: any, entries: PatchedEntry[]): DecorationSet {
  if (!entries.length) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  for (const entry of entries) {
    if (!entry._allTerms.length) continue;
    const pattern = new RegExp(`\\b(${entry._allTerms.map(escapeRegex).join("|")})\\b`, "gi");

    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      let match;
      while ((match = pattern.exec(node.text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;
        decorations.push(
          Decoration.inline(from, to, {
            class: "codex-highlight",
            style: `border-color: ${entry.color}; background-color: ${entry.color}22;`,
            "data-codex-id": String(entry.id),
            "data-codex-name": entry.name,
            "data-codex-type": entry.entry_type,
            "data-codex-desc": (entry.description || "").substring(0, 120),
          })
        );
      }
    });
  }

  return DecorationSet.create(doc, decorations);
}

export function createCodexHighlightPlugin(
  getEntries: () => PatchedEntry[],
  onEntryClick: (id: number) => void
) {
  return new Plugin({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc }) {
        return buildDecorations(doc, getEntries());
      },
      apply(tr, old) {
        if (tr.docChanged || tr.getMeta(PLUGIN_KEY)) {
          return buildDecorations(tr.doc, getEntries());
        }
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return PLUGIN_KEY.getState(state);
      },
      handleClick(view, _pos, event) {
        const target = event.target as HTMLElement;
        const el = target.closest("[data-codex-id]") as HTMLElement | null;
        if (el) {
          onEntryClick(Number(el.dataset.codexId));
          return true;
        }
        return false;
      },
    },
  });
}

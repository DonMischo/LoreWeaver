"use client";

import { useEffect, useRef } from "react";
import { StickyNote, Coins, Package, ImageIcon } from "lucide-react";
import type { Editor } from "@tiptap/core";

interface SlashMenuState {
  from: number;   // position of the '/'
  rect: { left: number; top: number };  // screen coords (fixed)
}

interface Props {
  editor: Editor;
  state: SlashMenuState;
  onClose: () => void;
}

const COMMANDS = [
  {
    id: "note",
    label: "Note",
    description: "Annotation visible only while writing",
    icon: StickyNote,
    color: "#f59e0b",
    insert: (editor: Editor) => {
      editor.chain().focus()
        .insertContent({ type: "note", content: [{ type: "paragraph" }] })
        .run();
    },
  },
  {
    id: "currency",
    label: "Currency",
    description: "Track a currency change for a character",
    icon: Coins,
    color: "#22c55e",
    insert: (editor: Editor) => {
      editor.chain().focus()
        .insertContent({ type: "currency", attrs: { charId: 0, currencyName: "", delta: 0 } })
        .run();
    },
  },
  {
    id: "item",
    label: "Item",
    description: "Assign an item possession to a character",
    icon: Package,
    color: "#3b82f6",
    insert: (editor: Editor) => {
      editor.chain().focus()
        .insertContent({ type: "item", attrs: { charId: 0, itemId: 0, qty: 1 } })
        .run();
    },
  },
  {
    id: "image",
    label: "Image",
    description: "Insert an inline illustration",
    icon: ImageIcon,
    color: "#a855f7",
    insert: (editor: Editor) => {
      editor.chain().focus()
        .insertContent({ type: "sceneImage", attrs: { src: "", caption: "" } })
        .run();
    },
  },
] as const;

export function SlashCommandMenu({ editor, state, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const selectCommand = (cmd: typeof COMMANDS[number]) => {
    onClose();
    // Delete the '/' that triggered this menu
    editor.chain()
      .deleteRange({ from: state.from, to: state.from + 1 })
      .run();
    // Insert the command node
    cmd.insert(editor);
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-border bg-popover shadow-lg py-1"
      style={{
        left: Math.min(state.rect.left, window.innerWidth - 280),
        top: state.rect.top + 4,
      }}
    >
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Insert command
      </p>
      {COMMANDS.map((cmd) => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.id}
            type="button"
            className="w-full text-left flex items-start gap-3 px-3 py-2 hover:bg-secondary transition-colors"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent editor blur
              selectCommand(cmd);
            }}
          >
            <span
              className="mt-0.5 p-1.5 rounded"
              style={{ background: `${cmd.color}20`, color: cmd.color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-medium">{cmd.label}</p>
              <p className="text-xs text-muted-foreground">{cmd.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

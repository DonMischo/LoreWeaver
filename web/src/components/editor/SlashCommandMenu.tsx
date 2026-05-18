"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StickyNote, Coins, Package, ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/core";

export interface SlashMenuState {
  from: number;   // position of the '/'
  rect: { left: number; top: number };
  query: string;  // text typed after '/'
}

export interface SlashMenuHandle {
  handleKey(e: KeyboardEvent): boolean;
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
    keywords: ["note", "annotation"],
    content: () => ({ type: "note", content: [{ type: "paragraph" }] }),
  },
  {
    id: "currency",
    label: "Currency",
    description: "Track a currency change for a character",
    icon: Coins,
    color: "#22c55e",
    keywords: ["currency", "money"],
    content: () => ({ type: "currency", attrs: { charId: 0, currencyName: "", delta: 0 } }),
  },
  {
    id: "item",
    label: "Item",
    description: "Assign an item possession to a character",
    icon: Package,
    color: "#3b82f6",
    keywords: ["item", "object", "possession"],
    content: () => ({ type: "item", attrs: { charId: 0, itemId: 0, qty: 1 } }),
  },
  {
    id: "image",
    label: "Image",
    description: "Insert an inline illustration",
    icon: ImageIcon,
    color: "#a855f7",
    keywords: ["image", "picture", "illustration"],
    content: () => ({ type: "sceneImage", attrs: { src: "", caption: "" } }),
  },
  {
    id: "ki",
    label: "AI Generate",
    description: "AI text generation with selected context",
    icon: Sparkles,
    color: "#f472b6",
    keywords: ["ai", "generate", "ki", "knowledge", "inject"],
    content: () => ({ type: "ki", attrs: { model: "", codexIds: "", sceneIds: "", prompt: "" } }),
  },
] as const;

export const SlashCommandMenu = forwardRef<SlashMenuHandle, Props>(
  function SlashCommandMenu({ editor, state, onClose }, ref) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const q = state.query.toLowerCase();
    const filtered = q
      ? COMMANDS.filter(
          (cmd) =>
            cmd.label.toLowerCase().startsWith(q) ||
            cmd.keywords.some((k) => k.startsWith(q))
        )
      : [...COMMANDS];

    // Reset active index when filter changes
    useEffect(() => {
      setActiveIndex(0);
    }, [state.query]);

    // Close on click outside
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const selectCommand = (cmd: typeof COMMANDS[number]) => {
      onClose();
      // Single chain: delete the '/' + query text, then insert the node
      editor
        .chain()
        .focus()
        .deleteRange({ from: state.from, to: state.from + 1 + state.query.length })
        .insertContent(cmd.content())
        .run();
    };

    useImperativeHandle(ref, () => ({
      handleKey(e: KeyboardEvent): boolean {
        if (filtered.length === 0) return false;
        if (e.key === "ArrowDown") {
          setActiveIndex((i) => (i + 1) % filtered.length);
          return true;
        }
        if (e.key === "ArrowUp") {
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          selectCommand(filtered[activeIndex]);
          return true;
        }
        return false;
      },
    }));

    if (filtered.length === 0) return null;

    return (
      <div
        ref={menuRef}
        className="fixed z-50 w-64 rounded-lg border border-border bg-popover shadow-lg py-1"
        style={{
          left: Math.min(state.rect.left, window.innerWidth - 280),
          top: state.rect.top + 4,
        }}
      >
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Insert command
        </p>
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              type="button"
              className={cn(
                "w-full text-left flex items-start gap-3 px-3 py-2 transition-colors",
                i === activeIndex ? "bg-secondary" : "hover:bg-secondary"
              )}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent editor blur
                selectCommand(cmd);
              }}
              onMouseEnter={() => setActiveIndex(i)}
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
);

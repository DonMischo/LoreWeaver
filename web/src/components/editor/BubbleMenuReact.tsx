"use client";

/**
 * Pure-React bubble menu for TipTap v3.
 *
 * TipTap v3 removed the BubbleMenu React component and BubbleMenuPlugin no
 * longer manages element visibility (Tippy.js did that in v2).  This
 * re-implementation tracks selection changes via editor events, evaluates
 * shouldShow itself, computes pixel coordinates from the ProseMirror view,
 * and renders the menu into a portal so it floats above everything without
 * worrying about overflow:hidden on ancestor elements.
 */

import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { EditorState } from "@tiptap/pm/state";
import { isTextSelection } from "@tiptap/core";

interface BubbleMenuProps {
  editor: Editor;
  shouldShow?: (props: {
    editor: Editor;
    view: unknown;
    state: EditorState;
    from: number;
    to: number;
  }) => boolean;
  /** Ignored — kept for API compatibility with old callers. */
  options?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}

export function BubbleMenu({
  editor,
  shouldShow,
  className,
  children,
}: BubbleMenuProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const { state, view } = editor;
      const { selection } = state;
      const { from, to } = selection;

      // Evaluate visibility
      const visible = shouldShow
        ? shouldShow({ editor, view, state, from, to })
        : isTextSelection(selection) && !selection.empty;

      if (!visible || !view.dom.isConnected) {
        setCoords(null);
        return;
      }

      // Compute bounding rect of the selection
      try {
        const start  = view.coordsAtPos(from);
        const end    = view.coordsAtPos(to);
        const midX   = (start.left + end.left) / 2;
        const topY   = Math.min(start.top, end.top);
        setCoords({ top: topY, left: midX });
      } catch {
        setCoords(null);
      }
    };

    editor.on("selectionUpdate", update);
    editor.on("update", update);
    editor.on("blur",  () => setCoords(null));
    editor.on("focus", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
      editor.off("blur",  () => setCoords(null));
      editor.off("focus", update);
    };
  }, [editor, shouldShow]);

  if (!coords || typeof document === "undefined") return null;

  const menuHeight = menuRef.current?.offsetHeight ?? 40;
  const menuWidth  = menuRef.current?.offsetWidth  ?? 300;

  // Position above the selection, clamped inside the viewport
  const top  = Math.max(4, coords.top + window.scrollY - menuHeight - 8);
  const left = Math.min(
    window.innerWidth - menuWidth / 2 - 8,
    Math.max(menuWidth / 2 + 8, coords.left + window.scrollX),
  );

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      style={{
        position:  "absolute",
        top,
        left,
        transform: "translateX(-50%)",
        zIndex:    9999,
      }}
      // Prevent clicks from stealing editor focus
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

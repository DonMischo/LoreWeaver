"use client";

/**
 * Thin React wrapper around TipTap v3's BubbleMenuPlugin.
 *
 * In TipTap v2 the BubbleMenu React component lived in @tiptap/react.
 * In v3 it was removed — only the low-level BubbleMenuPlugin remains.
 * This component re-implements the React wrapper so existing JSX usage
 * (<BubbleMenu editor={editor} shouldShow={…} options={…}>) keeps working.
 *
 * Positioning is handled by Floating UI (built into BubbleMenuPlugin in v3).
 * The `options` prop maps directly to Floating UI options (placement, offset…).
 * The old `tippyOptions` prop from v2 is no longer supported.
 */

import { useRef, useEffect, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { PluginKey } from "@tiptap/pm/state";

let _uid = 0;

interface BubbleMenuProps {
  editor: Editor;
  /** Return true to show the menu for the given selection. */
  shouldShow?: (props: {
    editor: Editor;
    view: any;
    state: any;
    from: number;
    to: number;
  }) => boolean;
  /** Floating UI options (placement, offset, strategy, …). */
  options?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}

export function BubbleMenu({
  editor,
  shouldShow,
  options,
  className,
  children,
}: BubbleMenuProps) {
  const ref    = useRef<HTMLDivElement>(null);
  const keyRef = useRef<PluginKey | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    keyRef.current = new PluginKey(`bubbleMenuReact_${++_uid}`);

    const plugin = BubbleMenuPlugin({
      pluginKey: keyRef.current,
      editor,
      element:   ref.current,
      shouldShow: shouldShow ?? null,
      options,
    } as any);

    editor.registerPlugin(plugin);

    return () => {
      if (keyRef.current) editor.unregisterPlugin(keyRef.current);
    };
    // editor identity is stable for the component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

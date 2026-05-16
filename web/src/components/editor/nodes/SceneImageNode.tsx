"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { ImageIcon, Upload, X, Pencil } from "lucide-react";
import { useState } from "react";
import { imagesApi } from "@/lib/api";
import { useEditorContext } from "@/contexts/EditorContext";

// ── NodeView ──────────────────────────────────────────────────────────────────

export function SceneImageNodeView({ node, updateAttributes, deleteNode }: any) {
  const { sceneId } = useEditorContext();
  const { src, caption } = node.attrs as { src: string; caption: string };
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !sceneId) return;
      setUploading(true);
      try {
        const res = await fetch(`/api/scenes/${sceneId}/images`, {
          method: "POST",
          body: (() => { const f = new FormData(); f.append("file", file); return f; })(),
        });
        if (res.ok) {
          const { src: newSrc } = await res.json();
          updateAttributes({ src: newSrc });
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <NodeViewWrapper as="div">
      <div
        className="my-4 rounded-lg border border-dashed overflow-hidden"
        style={{ borderColor: "#a855f7" }}
        contentEditable={false}
      >
        {src ? (
          <>
            <div className="relative group">
              <img
                src={imagesApi.url(src)}
                alt={caption || ""}
                className="w-full max-h-[480px] object-contain bg-muted/20"
              />
              {/* Overlay actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleUpload}
                  className="bg-background/80 rounded p-1 hover:bg-background"
                  title="Replace image"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={deleteNode}
                  className="bg-background/80 rounded p-1 hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Caption */}
            <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
              {editingCaption ? (
                <input
                  autoFocus
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  onBlur={() => { updateAttributes({ caption: captionDraft }); setEditingCaption(false); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") { updateAttributes({ caption: captionDraft }); setEditingCaption(false); }
                  }}
                  placeholder="Add caption…"
                  className="flex-1 bg-transparent text-xs text-muted-foreground outline-none"
                />
              ) : (
                <span
                  className="flex-1 text-xs text-muted-foreground cursor-text"
                  onClick={() => setEditingCaption(true)}
                >
                  {caption || <span className="opacity-50">Add caption…</span>}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingCaption(true)}
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
            >
              {uploading ? (
                <span className="text-sm">Uploading…</span>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8" style={{ color: "#a855f7" }} />
                  <span className="text-sm font-medium" style={{ color: "#a855f7" }}>
                    Click to upload illustration
                  </span>
                  <span className="text-xs opacity-60">JPG, PNG, WebP</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ── Node definition ───────────────────────────────────────────────────────────

export const SceneImageNode = Node.create({
  name: "sceneImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src:     { default: "",  parseHTML: (el) => el.getAttribute("data-src") ?? "" },
      caption: { default: "",  parseHTML: (el) => el.getAttribute("data-caption") ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="scene-image"]', priority: 100 }];
  },

  renderHTML({ node }) {
    return ["div", {
      "data-type": "scene-image",
      "data-src": node.attrs.src,
      "data-caption": node.attrs.caption,
    }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SceneImageNodeView);
  },
});

"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { GripVertical, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { SingleCard } from "./SceneCard";
import { hexToRgba } from "./ColorPicker";
import type { CorkboardScene } from "@/types";

// ── Node data contract ────────────────────────────────────────────────────────

export interface SceneNodeData extends Record<string, unknown> {
  scenes: CorkboardScene[];
  projectId: number;
  sceneColors: Record<number, string | null>;
  colColor: string;
  showSynopsis: boolean;
  compact: boolean;
  generatingId: number | null;
  availableSubplots: string[];
  onTitleChange: (id: number, title: string) => void;
  onSynopsisChange: (id: number, syn: string | null) => void;
  onGenerateSynopsis: (id: number) => Promise<string>;
  onColorChange: (id: number, color: string | null) => void;
  onSubplotChange: (ids: number[], subplot: string | null) => void;
  onUnstack: (sceneId: number) => void;
}

export type SceneNodeType = Node<SceneNodeData, "sceneNode">;

// ── Stack display (no dnd-kit dependency) ────────────────────────────────────

interface StackDisplayProps {
  scenes: CorkboardScene[];
  projectId: number;
  sceneColors: Record<number, string | null>;
  colColor: string;
  showSynopsis: boolean;
  compact: boolean;
  generatingId: number | null;
  availableSubplots: string[];
  onTitleChange: (id: number, title: string) => void;
  onSynopsisChange: (id: number, syn: string | null) => void;
  onGenerateSynopsis: (id: number) => Promise<string>;
  onColorChange: (id: number, color: string | null) => void;
  onSubplotChange: (ids: number[], subplot: string | null) => void;
  onUnstack: (sceneId: number) => void;
}

function StackDisplay({
  scenes, projectId, sceneColors, showSynopsis, compact, colColor,
  generatingId, availableSubplots,
  onTitleChange, onSynopsisChange, onGenerateSynopsis, onColorChange,
  onSubplotChange, onUnstack,
}: StackDisplayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [stackName, setStackName] = useState(() => {
    if (typeof window === "undefined") return "";
    const sg = scenes[0]?.stack_group ?? "";
    return localStorage.getItem(`lw_stack_name_${sg}`) ?? "";
  });

  const saveStackName = (name: string) => {
    const sg = scenes[0]?.stack_group ?? "";
    if (sg) localStorage.setItem(`lw_stack_name_${sg}`, name);
    setStackName(name);
    setEditingName(false);
  };

  const displayName = stackName || `Stack (${scenes.length})`;

  if (collapsed) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-sm cursor-default"
        style={{ borderLeftColor: hexToRgba(colColor, 0.5), borderLeftWidth: 3, minWidth: compact ? 140 : 180 }}
      >
        {/* Stack name (click to edit) */}
        {editingName ? (
          <input
            autoFocus
            className="nodrag flex-1 text-xs bg-transparent border-b border-primary outline-none"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            onBlur={() => saveStackName(stackName)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveStackName(stackName);
              if (e.key === "Escape") { setEditingName(false); }
            }}
          />
        ) : (
          <span
            className="flex-1 text-xs font-medium truncate cursor-text"
            onClick={() => setEditingName(true)}
          >
            {displayName}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/50">{scenes.length}</span>
        <button
          className="nodrag text-muted-foreground/70 hover:text-foreground"
          onClick={() => setCollapsed(false)}
          title="Expand stack"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0" style={{ minWidth: compact ? 140 : 180 }}>
      {/* Stack header */}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-t-md border border-b-0 border-border bg-muted/30"
        style={{ borderLeftColor: hexToRgba(colColor, 0.5), borderLeftWidth: 3 }}
      >
        {editingName ? (
          <input
            autoFocus
            className="nodrag flex-1 text-xs bg-transparent border-b border-primary outline-none"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            onBlur={() => saveStackName(stackName)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveStackName(stackName);
              if (e.key === "Escape") { setEditingName(false); }
            }}
          />
        ) : (
          <span className="flex-1 text-[11px] font-semibold text-muted-foreground truncate">
            {displayName}
          </span>
        )}
        <button
          className="nodrag text-muted-foreground/30 hover:text-muted-foreground/70 p-0.5"
          onClick={() => setEditingName(true)}
          title="Rename stack"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button
          className="nodrag text-muted-foreground/70 hover:text-foreground"
          onClick={() => setCollapsed(true)}
          title="Collapse stack"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>

      {/* Scene cards in the stack */}
      {scenes.map((scene: CorkboardScene, i: number) => (
        <div
          key={scene.id}
          className="relative border border-t-0 border-border"
          style={{
            borderLeftColor: hexToRgba(colColor, 0.3),
            borderLeftWidth: 3,
            marginTop: i > 0 ? -4 : 0,
            zIndex: scenes.length - i,
          }}
        >
          <SingleCard
            scene={scene}
            projectId={projectId}
            color={sceneColors[scene.id] ?? null}
            dragHandleProps={{ "data-drag": "handle" } as React.HTMLAttributes<HTMLButtonElement>}
            onTitleChange={onTitleChange}
            onSynopsisChange={onSynopsisChange}
            onGenerateSynopsis={onGenerateSynopsis}
            onColorChange={onColorChange}
            isGenerating={generatingId === scene.id}
            showSynopsis={showSynopsis}
            compact={compact}
          />
          {/* Unstack button */}
          <button
            className="nodrag absolute top-1 right-1 text-[9px] text-muted-foreground/30 hover:text-muted-foreground/70 px-1 rounded"
            onClick={() => onUnstack(scene.id)}
            title="Move out of stack"
          >
            ↑
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Subplot selector ──────────────────────────────────────────────────────────

function SubplotChip({
  current, available, onChange,
}: {
  current: string | null;
  available: string[];
  onChange: (val: string | null) => void;
}) {
  const label = current ?? "Main Plot";
  return (
    <select
      className="nodrag text-[9px] bg-transparent border border-border/30 rounded px-1 py-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-pointer outline-none max-w-[90px] truncate"
      value={current ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      title="Change subplot"
    >
      <option value="">Main Plot</option>
      {available.map((sp) => (
        <option key={sp} value={sp}>{sp}</option>
      ))}
    </select>
  );
}

// ── Custom React Flow node ────────────────────────────────────────────────────

export function SceneNode({ data }: NodeProps<SceneNodeType>) {
  const {
    scenes, projectId, sceneColors, colColor, showSynopsis, compact,
    generatingId, availableSubplots,
    onTitleChange, onSynopsisChange, onGenerateSynopsis, onColorChange,
    onSubplotChange, onUnstack,
  } = data;

  const isStack = scenes.length > 1;
  const representative = scenes[0];
  const sceneIds = scenes.map((s) => s.id);

  return (
    <div
      className="nowheel flex flex-col gap-0.5 rounded-lg"
      style={{
        borderLeft: `3px solid ${hexToRgba(colColor, 0.7)}`,
        background: hexToRgba(colColor, 0.05),
      }}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-border !border-border/50"
      />

      {/* Card body */}
      {isStack ? (
        <StackDisplay
          scenes={scenes}
          projectId={projectId}
          sceneColors={sceneColors}
          colColor={colColor}
          showSynopsis={showSynopsis}
          compact={compact}
          generatingId={generatingId}
          availableSubplots={availableSubplots}
          onTitleChange={onTitleChange}
          onSynopsisChange={onSynopsisChange}
          onGenerateSynopsis={onGenerateSynopsis}
          onColorChange={onColorChange}
          onSubplotChange={onSubplotChange}
          onUnstack={onUnstack}
        />
      ) : (
        <SingleCard
          scene={representative}
          projectId={projectId}
          color={sceneColors[representative.id] ?? null}
          dragHandleProps={{ "data-drag": "handle" } as React.HTMLAttributes<HTMLButtonElement>}
          onTitleChange={onTitleChange}
          onSynopsisChange={onSynopsisChange}
          onGenerateSynopsis={onGenerateSynopsis}
          onColorChange={onColorChange}
          isGenerating={generatingId === representative.id}
          showSynopsis={showSynopsis}
          compact={compact}
        />
      )}

      {/* Subplot selector footer */}
      <div className="flex justify-end pr-1">
        <SubplotChip
          current={representative.subplot}
          available={availableSubplots}
          onChange={(val) => onSubplotChange(sceneIds, val)}
        />
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-border !border-border/50"
      />
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ReactFlow,
  Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState,
  MarkerType,
} from "@xyflow/react";
import type { Node, Edge, OnNodeDrag } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, X, AlignJustify, ZoomOut, Layers2, LayoutGrid, TreePine, Group, Link2 } from "lucide-react";
import {
  useCorkboard, useUpdateSceneSynopsis, useGenerateSynopsis,
  useMoveScene, useCodexEntries, useProjectStructure,
} from "@/store/queries";
import { SceneNode } from "@/components/corkboard/SceneNode";
import type { SceneNodeType, SceneNodeData } from "@/components/corkboard/SceneNode";
import { ActNode, ChapterNode, GroupFrameNode } from "@/components/corkboard/HierarchyNodes";
import type { ActNodeType, ChapterNodeType, GroupFrameNodeType } from "@/components/corkboard/HierarchyNodes";
import { ColorPicker, hexToRgba, MAIN_COLOR, SUBPLOT_PALETTE } from "@/components/corkboard/ColorPicker";
import type { CorkboardScene, CorkboardAct } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAIN_COL = "__main__";
const CARD_W    = 230;
const CARD_W_SM = 160;
const COL_GAP   = 100;
const ROW_H     = 200;  // approximate card height + gap

// Group frame geometry
const FRAME_PAD    = 24;   // padding around scenes inside a chapter frame
const SCENE_H_FULL = 180;  // approx card height (normal mode)
const SCENE_H_CMP  = 130;  // approx card height (compact mode)

// Cascade layout geometry
const CDX = 12;   // x offset per scene in a pile
const CDY = 36;   // y offset per scene in a pile
const CH_PAD_TOP = 36;   // chapter node top padding (for label)
const CH_PAD_X   = 14;   // chapter node horizontal padding
const CH_PAD_BOT = 14;   // chapter node bottom padding
const CH_GAP     = 18;   // gap between chapters in an act
const ACT_PAD_TOP = 44;  // act node top padding (for label)
const ACT_PAD_X   = 16;  // act node horizontal padding
const ACT_PAD_BOT = 16;  // act node bottom padding
const ACT_GAP     = 36;  // gap between acts

// ── Persistent storage helpers ────────────────────────────────────────────────

function getSceneColor(id: number): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`lw_scene_hex_${id}`) ?? null;
}
function saveSceneColor(id: number, color: string | null) {
  if (color) localStorage.setItem(`lw_scene_hex_${id}`, color);
  else localStorage.removeItem(`lw_scene_hex_${id}`);
}

function getColColors(pid: number): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(`lw_col_colors_${pid}`) ?? "{}"); }
  catch { return {}; }
}
function saveColColors(pid: number, m: Record<string, string>) {
  localStorage.setItem(`lw_col_colors_${pid}`, JSON.stringify(m));
}

function getStoredSubplots(pid: number): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(`lw_subplots_${pid}`) ?? "[]"); }
  catch { return []; }
}
function saveStoredSubplots(pid: number, sp: string[]) {
  localStorage.setItem(`lw_subplots_${pid}`, JSON.stringify(sp));
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function defaultColColor(col: string, allCols: string[]): string {
  if (col === MAIN_COL) return MAIN_COLOR;
  const idx = allCols.filter((c) => c !== MAIN_COL).indexOf(col);
  return SUBPLOT_PALETTE[idx % SUBPLOT_PALETTE.length];
}

function resolveColColor(col: string, allCols: string[], stored: Record<string, string>, codexMap: Record<string, string>): string {
  return stored[col] ?? codexMap[col.toLowerCase()] ?? defaultColColor(col, allCols);
}

// ── Node group (single scene or a stack) ─────────────────────────────────────

interface NodeGroup {
  id: string;            // RF node id
  scenes: CorkboardScene[];
  subplot: string | null;
  globalOrder: number;   // representative (minimum) global_order
}

function buildNodeGroups(scenes: CorkboardScene[]): NodeGroup[] {
  const stacks = new Map<string, CorkboardScene[]>();
  const singles: CorkboardScene[] = [];

  for (const s of scenes) {
    if (s.stack_group) {
      if (!stacks.has(s.stack_group)) stacks.set(s.stack_group, []);
      stacks.get(s.stack_group)!.push(s);
    } else {
      singles.push(s);
    }
  }

  const groups: NodeGroup[] = [];

  for (const s of singles) {
    groups.push({
      id: `scene-${s.id}`,
      scenes: [s],
      subplot: s.subplot,
      globalOrder: s.global_order ?? 0,
    });
  }

  for (const [sg, scs] of stacks) {
    const sorted = [...scs].sort((a, b) => (a.global_order ?? 0) - (b.global_order ?? 0));
    groups.push({
      id: `stack-${sg}`,
      scenes: sorted,
      subplot: sorted[0].subplot,
      globalOrder: sorted[0].global_order ?? 0,
    });
  }

  return groups;
}

// ── Build RF nodes ────────────────────────────────────────────────────────────

function buildRFNodes(
  groups: NodeGroup[],
  allCols: string[],
  sceneColors: Record<number, string | null>,
  colColors: Record<string, string>,
  showSynopsis: boolean,
  compact: boolean,
  generatingId: number | null,
  availableSubplots: string[],
  handlers: Pick<SceneNodeData,
    "onTitleChange" | "onSynopsisChange" | "onGenerateSynopsis" |
    "onColorChange" | "onSubplotChange" | "onUnstack">,
  projectId: number,
): SceneNodeType[] {
  // Group by subplot to compute row indices for auto-layout
  const colGroups = new Map<string, NodeGroup[]>();
  for (const col of allCols) colGroups.set(col, []);
  for (const g of groups) {
    const col = g.subplot ?? MAIN_COL;
    if (!colGroups.has(col)) colGroups.set(col, []);
    colGroups.get(col)!.push(g);
  }
  // Sort each column by globalOrder for auto-layout row index
  for (const [, arr] of colGroups) arr.sort((a, b) => a.globalOrder - b.globalOrder);

  return groups.map((g): SceneNodeType => {
    const col = g.subplot ?? MAIN_COL;
    const colIdx = allCols.indexOf(col);
    const colArr = colGroups.get(col) ?? [];
    const rowIdx = colArr.indexOf(g);

    // Use saved positions if present, otherwise auto-layout
    const rep = g.scenes[0];
    const x = rep.node_x ?? (colIdx * (CARD_W + COL_GAP));
    const y = rep.node_y ?? (rowIdx * ROW_H + 40);

    return {
      id: g.id,
      type: "sceneNode",
      position: { x, y },
      dragHandle: '[data-drag="handle"]',
      data: {
        scenes: g.scenes,
        projectId,
        sceneColors,
        colColor: colColors[col] ?? defaultColColor(col, allCols),
        showSynopsis,
        compact,
        generatingId,
        availableSubplots,
        ...handlers,
      },
    };
  });
}

// ── Build RF edges ────────────────────────────────────────────────────────────

function buildRFEdges(groups: NodeGroup[]): Edge[] {
  // Within each subplot, connect groups in globalOrder sequence
  const bySubplot = new Map<string | null, NodeGroup[]>();
  for (const g of groups) {
    const key = g.subplot;
    if (!bySubplot.has(key)) bySubplot.set(key, []);
    bySubplot.get(key)!.push(g);
  }

  const edges: Edge[] = [];
  for (const [, arr] of bySubplot) {
    const sorted = [...arr].sort((a, b) => a.globalOrder - b.globalOrder);
    for (let i = 0; i < sorted.length - 1; i++) {
      const src = sorted[i];
      const tgt = sorted[i + 1];
      edges.push({
        id: `e-${src.id}-${tgt.id}`,
        source: src.id,
        target: tgt.id,
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        style: { stroke: "hsl(var(--border))", strokeWidth: 1.5, opacity: 0.6 },
      });
    }
  }
  return edges;
}

// ── Cascade (pile) positions ──────────────────────────────────────────────────

/** Compute tight cascade positions for free-form mode (per subplot column). */
function computeCascadePositions(
  localScenes: CorkboardScene[],
  allCols: string[],
  compact: boolean,
): Map<number, { x: number; y: number }> {
  const result = new Map<number, { x: number; y: number }>();
  const sw = compact ? CARD_W_SM : CARD_W;
  const colW = sw + COL_GAP;
  for (const col of allCols) {
    const colIdx = allCols.indexOf(col);
    const colScenes = localScenes
      .filter((s) => (s.subplot ?? MAIN_COL) === col)
      .sort((a, b) => (a.global_order ?? 0) - (b.global_order ?? 0));
    const x0 = colIdx * colW;
    colScenes.forEach((s, i) => result.set(s.id, { x: x0 + i * CDX, y: 40 + i * CDY }));
  }
  return result;
}

// ── Tree (hierarchy) layout helpers ──────────────────────────────────────────

function chapterBoxSize(nScenes: number, compact: boolean): { w: number; h: number } {
  const sw = compact ? CARD_W_SM : CARD_W;
  const sh = compact ? 130 : 180;
  return {
    w: CH_PAD_X * 2 + sw + Math.max(0, nScenes - 1) * CDX,
    h: CH_PAD_TOP + sh + Math.max(0, nScenes - 1) * CDY + CH_PAD_BOT,
  };
}

type AnyNode = SceneNodeType | ActNodeType | ChapterNodeType | GroupFrameNodeType;

function buildHierarchyNodes(
  localScenes: CorkboardScene[],
  structure: CorkboardAct[],
  sceneColors: Record<number, string | null>,
  resolvedColColors: Record<string, string>,
  allCols: string[],
  showSynopsis: boolean,
  compact: boolean,
  generatingId: number | null,
  availableSubplots: string[],
  handlers: Pick<SceneNodeData,
    "onTitleChange" | "onSynopsisChange" | "onGenerateSynopsis" |
    "onColorChange" | "onSubplotChange" | "onUnstack">,
  projectId: number,
): { nodes: AnyNode[]; edges: Edge[]; positions: Map<number, { x: number; y: number }> } {
  const allNodes: AnyNode[] = [];
  const edges: Edge[] = [];
  const positions = new Map<number, { x: number; y: number }>();

  // Map sceneId → CorkboardScene for fast lookup
  const sceneById = new Map(localScenes.map((s) => [s.id, s]));

  let actY = 0;

  for (const act of [...structure].sort((a, b) => a.order_index - b.order_index)) {
    const chapters = [...act.chapters].sort((a, b) => a.order_index - b.order_index);
    let chX = ACT_PAD_X;
    let maxChH = 0;

    const chapterNodes: AnyNode[] = [];
    const sceneNodes: AnyNode[]   = [];
    const chEdges: Edge[]         = [];

    for (const chapter of chapters) {
      // Scenes for this chapter, in structural order
      const chSceneIds = chapter.scenes.map((s) => s.id);
      const chScenes = chSceneIds
        .map((sid) => sceneById.get(sid))
        .filter((s): s is CorkboardScene => !!s);

      const { w: chW, h: chH } = chapterBoxSize(chScenes.length, compact);
      maxChH = Math.max(maxChH, chH);

      const chNodeId = `chapter-${chapter.id}`;
      chapterNodes.push({
        id: chNodeId,
        type: "chapterNode",
        position: { x: chX, y: actY + ACT_PAD_TOP },
        data: { label: chapter.title, sceneCount: chScenes.length },
        style: { width: chW, height: chH },
        selectable: false,
        draggable: false,
        zIndex: 1,
      } as ChapterNodeType);

      // Scene nodes — cascade within chapter box
      chScenes.forEach((scene, i) => {
        const sx = chX + CH_PAD_X + i * CDX;
        const sy = actY + ACT_PAD_TOP + CH_PAD_TOP + i * CDY;
        positions.set(scene.id, { x: sx, y: sy });

        sceneNodes.push({
          id: `scene-${scene.id}`,
          type: "sceneNode",
          position: { x: sx, y: sy },
          dragHandle: '[data-drag="handle"]',
          zIndex: 10 + i,   // later scenes sit on top (like papers laid down in sequence)
          data: {
            scenes: [scene],
            projectId,
            sceneColors,
            colColor: resolvedColColors[scene.subplot ?? MAIN_COL] ?? defaultColColor(scene.subplot ?? MAIN_COL, allCols),
            showSynopsis,
            compact,
            generatingId,
            availableSubplots,
            ...handlers,
          },
        } as SceneNodeType);

        // Edge: connect consecutive scenes within chapter
        if (i < chScenes.length - 1) {
          chEdges.push({
            id: `e-ch-${scene.id}-${chScenes[i + 1].id}`,
            source: `scene-${scene.id}`,
            target: `scene-${chScenes[i + 1].id}`,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
            style: { stroke: "hsl(var(--border))", strokeWidth: 1.2, opacity: 0.5 },
          });
        }
      });

      chX += chW + CH_GAP;
    }

    const actW = chX - CH_GAP + ACT_PAD_X;
    const actH = ACT_PAD_TOP + maxChH + ACT_PAD_BOT;

    // Act node (background container — added first so it's below chapters)
    allNodes.push({
      id: `act-${act.id}`,
      type: "actNode",
      position: { x: 0, y: actY },
      data: { label: act.title },
      style: { width: actW, height: actH },
      selectable: false,
      draggable: false,
      zIndex: 0,
    } as ActNodeType);

    allNodes.push(...chapterNodes);
    allNodes.push(...sceneNodes);
    edges.push(...chEdges);

    actY += actH + ACT_GAP;
  }

  return { nodes: allNodes, edges, positions };
}

// ── Chapter group frames (free-form mode) ────────────────────────────────────

function buildGroupFrames(
  structure: CorkboardAct[],
  scenePositions: Map<number, { x: number; y: number }>,
  compact: boolean,
): GroupFrameNodeType[] {
  const sh = compact ? SCENE_H_CMP : SCENE_H_FULL;
  const sw = compact ? CARD_W_SM : CARD_W;
  const frames: GroupFrameNodeType[] = [];

  for (const act of structure) {
    for (const chapter of act.chapters) {
      const positions = chapter.scenes
        .map((s) => scenePositions.get(s.id))
        .filter((p): p is { x: number; y: number } => !!p);
      if (positions.length === 0) continue;

      const minX = Math.min(...positions.map((p) => p.x));
      const minY = Math.min(...positions.map((p) => p.y));
      const maxX = Math.max(...positions.map((p) => p.x)) + sw;
      const maxY = Math.max(...positions.map((p) => p.y)) + sh;

      frames.push({
        id: `frame-chapter-${chapter.id}`,
        type: "groupFrameNode",
        position: { x: minX - FRAME_PAD, y: minY - FRAME_PAD - 20 },
        style: { width: maxX - minX + FRAME_PAD * 2, height: maxY - minY + FRAME_PAD * 2 + 20 },
        data: { label: chapter.title, chapterId: chapter.id },
        zIndex: -1,
        selectable: false,
        draggable: true,
      } as GroupFrameNodeType);
    }
  }
  return frames;
}

// ── Node types registration (stable outside component) ────────────────────────

const nodeTypes = { sceneNode: SceneNode, actNode: ActNode, chapterNode: ChapterNode, groupFrameNode: GroupFrameNode };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CorkboardPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data: serverData, isLoading } = useCorkboard(projectId);
  const { data: structure }             = useProjectStructure(projectId);
  const { data: codexEntries }          = useCodexEntries(projectId);
  const updateSynopsis   = useUpdateSceneSynopsis(projectId);
  const generateSynopsis = useGenerateSynopsis(projectId);
  const moveScene        = useMoveScene(projectId);

  // ── Stable mutation refs ──────────────────────────────────────────────────
  // Mutation objects are new references every render; store .mutate in refs so
  // useCallback deps stay empty and the handlers never force a re-render.
  const mutateRef = useRef({
    move:      moveScene.mutate,
    updateSyn: updateSynopsis.mutate,
    genSyn:    generateSynopsis.mutateAsync,
  });
  mutateRef.current.move      = moveScene.mutate;
  mutateRef.current.updateSyn = updateSynopsis.mutate;
  mutateRef.current.genSyn    = generateSynopsis.mutateAsync;

  // Codex name → color map for subplot auto-coloring
  const codexColorByName = useMemo(() => {
    const m: Record<string, string> = {};
    if (codexEntries)
      for (const e of codexEntries as { name: string; color: string }[])
        m[e.name.toLowerCase()] = e.color;
    return m;
  }, [codexEntries]);

  const [localScenes, setLocalScenes]       = useState<CorkboardScene[]>([]);
  const [extraSubplots, setExtraSubplots]   = useState<string[]>([]);
  const [newSubplotName, setNewSubplotName] = useState("");
  const [addingSubplot, setAddingSubplot]   = useState(false);
  const [sceneColors, setSceneColors]       = useState<Record<number, string | null>>({});
  const [colColors, setColColors]           = useState<Record<string, string>>({});
  const [showSynopsis, setShowSynopsis]     = useState(true);
  const [compact, setCompact]               = useState(false);
  const [showHierarchy, setShowHierarchy]   = useState(false);
  const [generatingId, setGeneratingId]     = useState<number | null>(null);
  const [showFrames, setShowFrames]         = useState(false);
  const [scratchMode, setScratchMode]       = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync server → local scenes
  const prevServer = useRef<typeof serverData>(undefined);
  useEffect(() => {
    if (!serverData || serverData === prevServer.current) return;
    prevServer.current = serverData;
    setLocalScenes(serverData.scenes);
    const merged = [...new Set([...serverData.subplots, ...getStoredSubplots(projectId)])];
    setExtraSubplots(merged);
    saveStoredSubplots(projectId, merged);
    const sc: Record<number, string | null> = {};
    for (const s of serverData.scenes) sc[s.id] = getSceneColor(s.id);
    setSceneColors(sc);
    const stored = getColColors(projectId);
    const allCols = [MAIN_COL, ...merged];
    const cc: Record<string, string> = {};
    for (const col of allCols) cc[col] = resolveColColor(col, allCols, stored, codexColorByName);
    setColColors(cc);
  }, [serverData, projectId, codexColorByName]);

  // ── Stable callbacks (all use mutateRef.current so deps stay empty) ─────────

  const handleTitleChange = useCallback((sceneId: number, title: string) => {
    setLocalScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, title } : s));
    mutateRef.current.move({ sceneId, data: { title } });
  }, []); // stable — reads mutation via ref

  const handleSynopsisChange = useCallback((sceneId: number, synopsis: string | null) => {
    mutateRef.current.updateSyn({ sceneId, synopsis });
  }, []); // stable

  const handleGenerateSynopsis = useCallback(async (sceneId: number): Promise<string> => {
    setGeneratingId(sceneId);
    try {
      const result = await mutateRef.current.genSyn(sceneId);
      const gen = result.synopsis;
      setLocalScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, synopsis: gen } : s));
      mutateRef.current.updateSyn({ sceneId, synopsis: gen });
      return gen;
    } finally {
      setGeneratingId(null);
    }
  }, []); // stable

  const handleColorChange = useCallback((sceneId: number, color: string | null) => {
    saveSceneColor(sceneId, color);
    setSceneColors((prev) => ({ ...prev, [sceneId]: color }));
  }, []); // stable

  const handleSubplotChange = useCallback((sceneIds: number[], subplot: string | null) => {
    setLocalScenes((prev) => prev.map((s) => sceneIds.includes(s.id) ? { ...s, subplot } : s));
    sceneIds.forEach((sid) => mutateRef.current.move({ sceneId: sid, data: { subplot } }));
  }, []); // stable

  const handleUnstack = useCallback((sceneId: number) => {
    setLocalScenes((prev) => {
      const scene = prev.find((s) => s.id === sceneId);
      if (!scene?.stack_group) return prev;
      const siblings = prev.filter((s) => s.stack_group === scene.stack_group && s.id !== sceneId);
      return prev.map((s) => {
        if (s.id === sceneId) return { ...s, stack_group: null };
        if (siblings.length === 1 && s.id === siblings[0].id) return { ...s, stack_group: null };
        return s;
      });
    });
    mutateRef.current.move({ sceneId, data: { stack_group: null } });
  }, []); // stable

  const handleColColorChange = useCallback((col: string, color: string) => {
    setColColors((prev) => {
      const next = { ...prev, [col]: color };
      saveColColors(projectId, next);
      return next;
    });
  }, [projectId]); // projectId is stable for lifetime of page

  // ── Stable handlers object — all callbacks above are stable so this never
  //    changes, breaking the useEffect → setNodes → re-render loop ───────────

  const handlers = useMemo(() => ({
    onTitleChange: handleTitleChange,
    onSynopsisChange: handleSynopsisChange,
    onGenerateSynopsis: handleGenerateSynopsis,
    onColorChange: handleColorChange,
    onSubplotChange: handleSubplotChange,
    onUnstack: handleUnstack,
  }), [
    handleTitleChange, handleSynopsisChange, handleGenerateSynopsis,
    handleColorChange, handleSubplotChange, handleUnstack,
  ]);

  // ── Rebuild RF nodes + edges when data changes ────────────────────────────

  const allCols = useMemo(
    () => [MAIN_COL, ...new Set([...extraSubplots, ...localScenes.filter((s) => s.subplot).map((s) => s.subplot!)])],
    [extraSubplots, localScenes],
  );

  const availableSubplots = useMemo(
    () => allCols.filter((c) => c !== MAIN_COL),
    [allCols],
  );

  const resolvedColColors = useMemo(
    () => Object.fromEntries(allCols.map((col) => [col, resolveColColor(col, allCols, colColors, codexColorByName)])),
    [allCols, colColors, codexColorByName],
  );

  useEffect(() => {
    if (localScenes.length === 0) return;

    if (showHierarchy && structure?.length) {
      const { nodes: hn, edges: he } = buildHierarchyNodes(
        localScenes, structure, sceneColors,
        resolvedColColors, allCols,
        showSynopsis, compact, generatingId, availableSubplots, handlers, projectId,
      );
      setNodes(hn);
      setEdges(he);
    } else {
      const groups   = buildNodeGroups(localScenes);
      const newNodes = buildRFNodes(
        groups, allCols, sceneColors, resolvedColColors,
        showSynopsis, compact, generatingId, availableSubplots, handlers, projectId,
      );
      const newEdges = buildRFEdges(groups);
      if (showFrames && structure?.length) {
        const scenePositions = new Map(
          newNodes
            .filter((n) => n.id.startsWith("scene-"))
            .map((n) => [parseInt(n.id.replace("scene-", ""), 10), { ...n.position }]),
        );
        const frames = buildGroupFrames(structure, scenePositions, compact);
        setNodes([...frames, ...newNodes]);
      } else {
        setNodes(newNodes);
      }
      setEdges(newEdges);
    }
  }, [
    localScenes, structure, showHierarchy, showFrames,
    allCols, sceneColors, resolvedColColors,
    showSynopsis, compact, generatingId, availableSubplots,
    handlers, projectId, setNodes, setEdges,
  ]);

  // ── Cascade layout button ─────────────────────────────────────────────────

  const handleCascade = useCallback(() => {
    const posMap = computeCascadePositions(localScenesRef.current, allColsRef.current, compactRef.current);
    setLocalScenes((prev) =>
      prev.map((s) => {
        const p = posMap.get(s.id);
        return p ? { ...s, node_x: p.x, node_y: p.y } : s;
      })
    );
    posMap.forEach((pos, sceneId) =>
      mutateRef.current.move({ sceneId, data: { node_x: pos.x, node_y: pos.y } })
    );
  }, []); // stable via refs

  // ── Save position on drag stop ────────────────────────────────────────────

  // Refs so drag-stop and cascade handlers read latest values without being deps
  const localScenesRef = useRef(localScenes);
  localScenesRef.current = localScenes;
  const allColsRef = useRef(allCols);
  allColsRef.current = allCols;
  const compactRef = useRef(compact);
  compactRef.current = compact;

  // Extra refs for frame-drag and scratch-mode (stable closures)
  const nodesRef        = useRef<Node[]>(nodes);
  nodesRef.current      = nodes;
  const structureRef    = useRef(structure);
  structureRef.current  = structure;
  const showFramesRef    = useRef(showFrames);
  showFramesRef.current  = showFrames;
  const scratchModeRef   = useRef(scratchMode);
  scratchModeRef.current = scratchMode;
  const showHierarchyRef    = useRef(showHierarchy);
  showHierarchyRef.current  = showHierarchy;

  // Drag-state tracking (frame drag and scratch drag)
  const dragStartRef = useRef<{
    nodeId: string;
    nodeType: "frame" | "scratch";
    startPos: { x: number; y: number };
    followers: Array<{ id: string; startPos: { x: number; y: number } }>;
  } | null>(null);

  // ── Drag start — register followers for frame and scratch modes ──────────

  const onNodeDragStart: OnNodeDrag = useCallback((_, node) => {
    const nodeId = node.id;

    // Frame drag: identify all scene nodes that belong to this chapter
    if (nodeId.startsWith("frame-chapter-")) {
      const chapterId = parseInt(nodeId.replace("frame-chapter-", ""), 10);
      const chapterSceneIds = new Set(
        (structureRef.current ?? [])
          .flatMap((act) => act.chapters)
          .find((ch) => ch.id === chapterId)
          ?.scenes.map((s) => s.id) ?? [],
      );
      const followers = nodesRef.current
        .filter((n) => n.id.startsWith("scene-") && chapterSceneIds.has(parseInt(n.id.replace("scene-", ""), 10)))
        .map((n) => ({ id: n.id, startPos: { ...n.position } }));
      dragStartRef.current = { nodeId, nodeType: "frame", startPos: { ...node.position }, followers };
      return;
    }

    // Scratch drag: identify all scene nodes structurally after the dragged one
    if (scratchModeRef.current && nodeId.startsWith("scene-")) {
      const sceneId = parseInt(nodeId.replace("scene-", ""), 10);
      const flatOrder = (structureRef.current ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .flatMap((act) =>
          [...act.chapters]
            .sort((a, b) => a.order_index - b.order_index)
            .flatMap((ch) => ch.scenes.map((s) => s.id)),
        );
      const idx = flatOrder.indexOf(sceneId);
      const followerIds = new Set(idx >= 0 ? flatOrder.slice(idx + 1) : []);
      const followers = nodesRef.current
        .filter((n) => n.id.startsWith("scene-") && followerIds.has(parseInt(n.id.replace("scene-", ""), 10)))
        .map((n) => ({ id: n.id, startPos: { ...n.position } }));
      dragStartRef.current = { nodeId, nodeType: "scratch", startPos: { ...node.position }, followers };
    }
  }, []); // stable — reads via refs

  // ── Drag — move follower nodes by the same delta ──────────────────────────

  const onNodeDrag: OnNodeDrag = useCallback((_, node) => {
    const drag = dragStartRef.current;
    if (!drag || drag.nodeId !== node.id || drag.followers.length === 0) return;
    const dx = node.position.x - drag.startPos.x;
    const dy = node.position.y - drag.startPos.y;
    setNodes((prev) =>
      prev.map((n) => {
        const f = drag.followers.find((fl) => fl.id === n.id);
        return f ? { ...n, position: { x: f.startPos.x + dx, y: f.startPos.y + dy } } : n;
      }),
    );
  }, [setNodes]); // setNodes is stable

  const onNodeDragStop: OnNodeDrag = useCallback((_, node) => {
    const drag = dragStartRef.current;

    // ── Case 1: frame drag — save follower positions by delta ────────────────
    if (drag && drag.nodeType === "frame" && drag.nodeId === node.id) {
      dragStartRef.current = null;
      const dx = node.position.x - drag.startPos.x;
      const dy = node.position.y - drag.startPos.y;
      const updates = drag.followers.map(({ id, startPos }) => ({
        sceneId: parseInt(id.replace("scene-", ""), 10),
        nx: startPos.x + dx,
        ny: startPos.y + dy,
      }));
      setLocalScenes((prev) =>
        prev.map((s) => {
          const u = updates.find((up) => up.sceneId === s.id);
          return u ? { ...s, node_x: u.nx, node_y: u.ny } : s;
        })
      );
      updates.forEach(({ sceneId, nx, ny }) =>
        mutateRef.current.move({ sceneId, data: { node_x: nx, node_y: ny } })
      );
      return;
    }

    // ── Case 2: scratch drag — save dragged + followers, optional chapter ───
    if (drag && drag.nodeType === "scratch" && drag.nodeId === node.id) {
      dragStartRef.current = null;
      const dx = node.position.x - drag.startPos.x;
      const dy = node.position.y - drag.startPos.y;
      const droppedSceneId = parseInt(node.id.replace("scene-", ""), 10);

      // Hit-test: find which chapter frame the dragged scene was dropped into
      let targetChapterId: number | null = null;
      if (showFramesRef.current) {
        for (const frame of nodesRef.current) {
          if (!frame.id.startsWith("frame-chapter-")) continue;
          const s = frame.style as { width?: number; height?: number } | undefined;
          const fw = s?.width ?? 0;
          const fh = s?.height ?? 0;
          if (
            node.position.x >= frame.position.x && node.position.x <= frame.position.x + fw &&
            node.position.y >= frame.position.y && node.position.y <= frame.position.y + fh
          ) {
            targetChapterId = parseInt(frame.id.replace("frame-chapter-", ""), 10);
            break;
          }
        }
      }

      // Build full update list: dragged scene + all followers at their new positions
      const allUpdates = [
        { sceneId: droppedSceneId, nx: node.position.x, ny: node.position.y },
        ...drag.followers.map(({ id, startPos }) => ({
          sceneId: parseInt(id.replace("scene-", ""), 10),
          nx: startPos.x + dx,
          ny: startPos.y + dy,
        })),
      ];
      setLocalScenes((prev) =>
        prev.map((s) => {
          const u = allUpdates.find((up) => up.sceneId === s.id);
          return u ? { ...s, node_x: u.nx, node_y: u.ny } : s;
        })
      );
      allUpdates.forEach(({ sceneId, nx, ny }) => {
        const data: Record<string, unknown> = { node_x: nx, node_y: ny };
        if (targetChapterId !== null) data.chapter_id = targetChapterId;
        mutateRef.current.move({ sceneId, data });
      });
      return;
    }

    // ── Case 3: normal drag ──────────────────────────────────────────────────
    dragStartRef.current = null;
    const { x, y } = node.position;
    const nodeId = node.id;
    if (!nodeId.startsWith("scene-") && !nodeId.startsWith("stack-")) return;
    let sceneIds: number[];
    if (nodeId.startsWith("stack-")) {
      const sg = nodeId.replace("stack-", "");
      sceneIds = localScenesRef.current.filter((s) => s.stack_group === sg).map((s) => s.id);
    } else {
      const sid = parseInt(nodeId.replace("scene-", ""), 10);
      sceneIds = isNaN(sid) ? [] : [sid];
    }
    if (sceneIds.length === 0) return;

    // Tree view: detect chapter the scene was dropped into for cross-chapter moves
    let treeChapterId: number | null = null;
    if (showHierarchyRef.current && sceneIds.length === 1) {
      for (const n of nodesRef.current) {
        if (!n.id.startsWith("chapter-")) continue;
        const cs = n.style as { width?: number; height?: number } | undefined;
        const cw = cs?.width ?? 0;
        const ch = cs?.height ?? 0;
        if (x >= n.position.x && x <= n.position.x + cw && y >= n.position.y && y <= n.position.y + ch) {
          treeChapterId = parseInt(n.id.replace("chapter-", ""), 10);
          break;
        }
      }
    }

    setLocalScenes((prev) =>
      prev.map((s) => sceneIds.includes(s.id) ? { ...s, node_x: x, node_y: y } : s)
    );
    sceneIds.forEach((sid) => {
      const data: Record<string, unknown> = { node_x: x, node_y: y };
      if (treeChapterId !== null) {
        const currentChapterId = localScenesRef.current.find((s) => s.id === sid)?.chapter_id;
        if (currentChapterId !== treeChapterId) data.chapter_id = treeChapterId;
      }
      mutateRef.current.move({ sceneId: sid, data });
    });
  }, []); // stable — reads all values via refs

  // ── Subplot management ────────────────────────────────────────────────────

  const handleAddSubplot = () => {
    const name = newSubplotName.trim();
    if (!name || extraSubplots.includes(name)) return;
    setExtraSubplots((prev) => {
      const next = [...prev, name];
      saveStoredSubplots(projectId, next);
      return next;
    });
    setColColors((prev) => {
      const allC = [MAIN_COL, ...extraSubplots, name];
      const next = { ...prev, [name]: resolveColColor(name, allC, getColColors(projectId), codexColorByName) };
      saveColColors(projectId, next);
      return next;
    });
    setNewSubplotName("");
    setAddingSubplot(false);
  };

  const handleRemoveSubplot = (subplot: string) => {
    const affected = localScenes.filter((s) => s.subplot === subplot);
    affected.forEach((s) => moveScene.mutate({ sceneId: s.id, data: { subplot: null } }));
    setLocalScenes((prev) => prev.map((s) => s.subplot === subplot ? { ...s, subplot: null } : s));
    setExtraSubplots((prev) => {
      const next = prev.filter((x) => x !== subplot);
      saveStoredSubplots(projectId, next);
      return next;
    });
    setColColors((prev) => {
      const { [subplot]: _, ...rest } = prev;
      saveColColors(projectId, rest);
      return rest;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading corkboard…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}      // prevent accidental node deletion
        className="bg-background"
      >
        <Background color="hsl(var(--border))" gap={24} size={1} />
        <Controls
          className="!border-border/50 !shadow-lg [&>button]:!bg-background [&>button]:!text-foreground [&>button]:!border-border/40 [&>button:hover]:!bg-muted"
          style={{ background: "hsl(var(--background))" }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = (n as SceneNodeType).data;
            return d?.colColor ?? "#888";
          }}
          className="!bg-card !border-border"
          maskColor="hsl(var(--background)/0.7)"
        />

        {/* ── Top toolbar ───────────────────────────────────────────────── */}
        <Panel position="top-left" className="flex items-center gap-2 m-0 p-2 bg-card/90 backdrop-blur border border-border rounded-lg shadow-sm">
          {/* Synopsis toggle */}
          <button
            onClick={() => setShowSynopsis((v) => !v)}
            title={showSynopsis ? "Hide synopsis" : "Show synopsis"}
            className={[
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
              showSynopsis ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
            ].join(" ")}
          >
            <AlignJustify className="h-3.5 w-3.5" />
            Synopsis
          </button>

          {/* Compact toggle */}
          <button
            onClick={() => setCompact((v) => !v)}
            title={compact ? "Normal view" : "Compact view"}
            className={[
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
              compact ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
            ].join(" ")}
          >
            <ZoomOut className="h-3.5 w-3.5" />
            Compact
          </button>

          {/* Tree (hierarchy) toggle */}
          <button
            onClick={() => setShowHierarchy((v) => !v)}
            title={showHierarchy ? "Free-form canvas" : "Tree view — acts → chapters → scenes"}
            className={[
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
              showHierarchy ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
            ].join(" ")}
          >
            <TreePine className="h-3.5 w-3.5" />
            Tree
          </button>

          {/* Cascade / Frames / Chain — only in free-form mode */}
          {!showHierarchy && (
            <>
              <button
                onClick={handleCascade}
                title="Stack all scenes in cascading piles"
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-transparent text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cascade
              </button>
              <button
                onClick={() => setShowFrames((v) => !v)}
                title={showFrames ? "Hide chapter frames" : "Show chapter frames — drag a frame to move all its scenes"}
                className={[
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
                  showFrames ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
                ].join(" ")}
              >
                <Group className="h-3.5 w-3.5" />
                Frames
              </button>
              <button
                onClick={() => setScratchMode((v) => !v)}
                title={scratchMode ? "Switch to normal drag" : "Chain drag — grab a scene to pull all later scenes with it"}
                className={[
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
                  scratchMode ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
                ].join(" ")}
              >
                <Link2 className="h-3.5 w-3.5" />
                Chain
              </button>
            </>
          )}

          <div className="w-px h-4 bg-border" />

          {/* Subplot legend + management */}
          {allCols.map((col) => {
            const color = resolvedColColors[col];
            return (
              <div key={col} className="flex items-center gap-1">
                <ColorPicker
                  color={color}
                  onChange={(hex) => handleColColorChange(col, hex ?? MAIN_COLOR)}
                  alignLeft={col === MAIN_COL}
                />
                <span className="text-xs font-medium" style={{ color }}>
                  {col === MAIN_COL ? "Main" : col}
                </span>
                {col !== MAIN_COL && (
                  <button
                    onClick={() => handleRemoveSubplot(col)}
                    className="text-muted-foreground/30 hover:text-destructive"
                    title="Remove subplot"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add subplot */}
          {addingSubplot ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => { e.preventDefault(); handleAddSubplot(); }}
            >
              <input
                autoFocus
                value={newSubplotName}
                onChange={(e) => setNewSubplotName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setAddingSubplot(false)}
                placeholder="Name…"
                className="text-xs bg-background border border-border rounded px-2 py-0.5 w-24 outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/40"
              />
              <button type="submit" className="text-xs text-primary">Add</button>
              <button type="button" className="text-xs text-muted-foreground/50" onClick={() => setAddingSubplot(false)}>✕</button>
            </form>
          ) : (
            <button
              onClick={() => setAddingSubplot(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              Subplot
            </button>
          )}
        </Panel>

        {/* ── Help hint ─────────────────────────────────────────────────── */}
        <Panel position="bottom-center">
          <div className="text-[10px] text-muted-foreground/40 flex items-center gap-1 bg-card/70 px-2 py-1 rounded-md border border-border/30">
            <Layers2 className="h-3 w-3" />
            {showHierarchy
              ? "Tree view — acts & chapters as containers · drag scenes freely · cables follow sidebar order"
              : scratchMode ? "Chain mode — drag a scene to pull all later scenes with it · drop in a frame to reassign chapter"
              : showFrames ? "Frames on — drag a frame to move its whole chapter · drop scenes into another frame to reassign"
              : "Drag to reposition · subplot via card footer · Cascade to pile scenes · scroll to zoom"}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

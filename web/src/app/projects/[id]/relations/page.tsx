"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { User, MapPin, Package, Scroll, Tag, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodexEntryDialog } from "@/components/codex/CodexEntryDialog";
import { useCodexEntries, useUpdateCodexEntry } from "@/store/queries";
import type { CodexEntry } from "@/types";

interface GraphNode {
  id: string;
  codex_id: number | null;
  entry_type: string;
  color: string;
}

interface GraphEdge {
  source: string | null;
  target: string;
  type: string;
  scene_id?: number;
  scene_title?: string;
  chapter_title?: string;
  via: "codex" | "inline";
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  character: User, location: MapPin, item: Package, lore: Scroll, custom: Tag,
};

const W = 900;
const H = 680;
const CX = W / 2;
const CY = H / 2;
const R1 = 220;   // radius for direct connections
const NODE_R = 28;

function radialPos(index: number, total: number, radius: number, offset = 0) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2 + offset;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function NodeCircle({
  node, x, y, selected, onClick,
}: { node: GraphNode; x: number; y: number; selected: boolean; onClick: () => void }) {
  const Icon = TYPE_ICONS[node.entry_type] ?? Tag;
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      className="cursor-pointer"
      style={{ userSelect: "none" }}
    >
      <circle
        r={NODE_R}
        fill={node.color + "33"}
        stroke={node.color}
        strokeWidth={selected ? 3 : 1.5}
        className="transition-all"
      />
      <foreignObject x={-10} y={-10} width={20} height={20}>
        <div className="flex items-center justify-center w-full h-full">
          <Icon size={14} color={node.color} />
        </div>
      </foreignObject>
      <text
        y={NODE_R + 14}
        textAnchor="middle"
        fontSize={11}
        fill="currentColor"
        className="fill-foreground"
        style={{ fontWeight: selected ? 600 : 400 }}
      >
        {node.id.length > 14 ? node.id.slice(0, 13) + "…" : node.id}
      </text>
    </g>
  );
}

function EdgePath({
  x1, y1, x2, y2, label, color, dashed,
}: { x1: number; y1: number; x2: number; y2: number; label: string; color: string; dashed: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
        strokeOpacity={0.6}
        markerEnd="url(#arrow)"
      />
      {label && (
        <text
          x={mx} y={my - 5}
          textAnchor="middle"
          fontSize={9}
          fill={color}
          fillOpacity={0.85}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function RelationsPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data, isLoading, error } = useQuery<GraphData>({
    queryKey: ["graph", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/graph`).then(r => r.json()),
  });

  const { data: codexEntries = [] } = useCodexEntries(projectId);
  const updateEntry = useUpdateCodexEntry(projectId);

  const [centerId, setCenterId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [dialogEntry, setDialogEntry] = useState<CodexEntry | null>(null);

  // Open the codex entry dialog for a graph node (if it has a codex_id)
  const openEntryDialog = (node: GraphNode) => {
    if (!node.codex_id) return;
    const entry = codexEntries.find(e => e.id === node.codex_id);
    if (entry) setDialogEntry(entry);
  };

  const centerNode = useMemo(() => {
    if (!data) return null;
    let defaultId = centerId;
    if (!defaultId) {
      // Prefer is_main_char=true characters
      const mainChar = codexEntries.find(e => e.is_main_char && e.entry_type === "character");
      if (mainChar) {
        const node = data.nodes.find(n => n.codex_id === mainChar.id);
        if (node) defaultId = node.id;
      }
      if (!defaultId) {
        defaultId = data.nodes.find(n => n.entry_type === "character")?.id ?? data.nodes[0]?.id ?? null;
      }
    }
    return data.nodes.find(n => n.id === defaultId) ?? null;
  }, [data, centerId, codexEntries]);

  // Layout: center node + connected nodes arranged radially
  const layout = useMemo(() => {
    if (!data || !centerNode) return { positions: {}, visibleEdges: [] };

    const centerName = centerNode.id;
    const positions: Record<string, { x: number; y: number }> = {};
    positions[centerName] = { x: CX, y: CY };

    const directEdges = data.edges.filter(
      e => e.source === centerName || e.target === centerName
    );
    const directNames = new Set<string>();
    for (const e of directEdges) {
      if (e.source && e.source !== centerName) directNames.add(e.source);
      if (e.target !== centerName) directNames.add(e.target);
    }
    const directArr = [...directNames];
    directArr.forEach((name, i) => {
      positions[name] = radialPos(i, directArr.length, R1);
    });

    const visibleEdges = data.edges.filter(
      e => positions[e.source ?? ""] && positions[e.target]
    );

    return { positions, visibleEdges };
  }, [data, centerNode]);

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading graph…</div>;
  if (error || !data) return <div className="flex items-center justify-center h-full text-destructive text-sm">Failed to load graph</div>;
  if (!data.nodes.length) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
      <p className="mb-2">No relations yet.</p>
      <p className="text-xs">Add codex relations or use <code className="bg-secondary px-1 rounded">[rel:Name|type]</code> tags in your scenes.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h1 className="text-base font-semibold">Relations</h1>
          <p className="text-xs text-muted-foreground">{data.nodes.length} nodes · {data.edges.length} edges · click a node to re-centre</p>
        </div>
        {hoveredEdge && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            {hoveredEdge.via === "inline"
              ? `In scene: "${hoveredEdge.scene_title}" (${hoveredEdge.chapter_title})`
              : "Defined in Codex"}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Node list — click opens codex dialog (if entry exists), SVG node click re-centres */}
        <aside className="w-48 border-r border-border overflow-y-auto py-2 shrink-0">
          {data.nodes.map(n => {
            const Icon = TYPE_ICONS[n.entry_type] ?? Tag;
            const hasCodexEntry = !!n.codex_id && codexEntries.some(e => e.id === n.codex_id);
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (hasCodexEntry) {
                    openEntryDialog(n);
                  } else {
                    setCenterId(n.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left",
                  centerNode?.id === n.id && "bg-secondary font-medium"
                )}
                title={hasCodexEntry ? "Click to edit entry" : undefined}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: n.color }} />
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{n.id}</span>
              </button>
            );
          })}
        </aside>

        {/* SVG canvas — clicking a node re-centres */}
        <div className="flex-1 overflow-auto bg-background/50">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="min-w-full"
          >
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#6b7280" fillOpacity={0.6} />
              </marker>
            </defs>

            {/* Edges */}
            {layout.visibleEdges.map((edge, i) => {
              const src = edge.source ?? centerNode?.id ?? "";
              const sp = layout.positions[src];
              const tp = layout.positions[edge.target];
              if (!sp || !tp) return null;
              const nodeColor = data.nodes.find(n => n.id === src)?.color ?? "#6b7280";
              return (
                <g key={i}
                  onMouseEnter={() => setHoveredEdge(edge)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  <EdgePath
                    x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                    label={edge.type}
                    color={nodeColor}
                    dashed={edge.via === "inline"}
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {Object.entries(layout.positions).map(([name, pos]) => {
              const node = data.nodes.find(n => n.id === name);
              if (!node) return null;
              return (
                <NodeCircle
                  key={name}
                  node={node}
                  x={pos.x}
                  y={pos.y}
                  selected={centerNode?.id === name}
                  onClick={() => setCenterId(name)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground flex gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-muted-foreground" /> Codex relation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-muted-foreground" /> Inline <code>[rel:]</code> tag
        </span>
      </div>

      {/* Codex entry edit dialog — opened by clicking left panel entries */}
      {dialogEntry && (
        <CodexEntryDialog
          open={!!dialogEntry}
          onClose={() => setDialogEntry(null)}
          onSave={(data) => {
            updateEntry.mutate({ id: dialogEntry.id, data });
            setDialogEntry(null);
          }}
          initial={dialogEntry}
          title="Edit Entry"
          allEntries={codexEntries}
        />
      )}
    </div>
  );
}

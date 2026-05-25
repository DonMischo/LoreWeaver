"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { scenesApi } from "@/lib/api";
import { usePovStats, useCodexEntries, useProjectScenes, useCorkboard } from "@/store/queries";
import type { EntryType } from "@/types";
import { cn } from "@/lib/utils";

// ── POV Distribution Bar ──────────────────────────────────────────────────────

function PovBar({ color, count, total }: { color: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1 bg-secondary/30 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PovPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const qc = useQueryClient();

  const { data: povStats } = usePovStats(projectId);
  const { data: entries = [] } = useCodexEntries(projectId);
  const { data: projectScenes = [] } = useProjectScenes(projectId);
  const { data: corkboard } = useCorkboard(projectId);

  const [localPov, setLocalPov] = useState<Record<number, number | null>>({});
  const [savingSceneId, setSavingSceneId] = useState<number | null>(null);

  // Characters only (for POV assignment)
  const characters = useMemo(
    () => entries
      .filter(e => e.entry_type === ("character" as EntryType))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => ({ id: e.id, name: e.name, color: e.color })),
    [entries],
  );

  // Build pov_character_id map from corkboard
  const corkboardPovMap = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const s of corkboard?.scenes ?? []) {
      map[s.id] = s.pov_character_id ?? null;
    }
    return map;
  }, [corkboard]);

  // Mutation for updating scene POV
  const updatePov = useMutation({
    mutationFn: ({ sceneId, povCharacterId }: { sceneId: number; povCharacterId: number | null }) =>
      scenesApi.update(sceneId, { pov_character_id: povCharacterId }),
    onSuccess: (_, { sceneId, povCharacterId }) => {
      setLocalPov(prev => ({ ...prev, [sceneId]: povCharacterId }));
      setSavingSceneId(null);
      qc.invalidateQueries({ queryKey: ["pov-stats", projectId] });
      qc.invalidateQueries({ queryKey: ["corkboard", projectId] });
    },
    onError: () => setSavingSceneId(null),
  });

  const handleUpdate = (sceneId: number, val: string) => {
    const povCharacterId = val ? Number(val) : null;
    setSavingSceneId(sceneId);
    setLocalPov(prev => ({ ...prev, [sceneId]: povCharacterId }));  // optimistic
    updatePov.mutate({ sceneId, povCharacterId });
  };

  const total = povStats?.total_scenes ?? 0;
  const stats = povStats?.stats ?? [];

  // Character lookup for the color dot in the select border
  const charMap = useMemo(
    () => Object.fromEntries(characters.map(c => [c.id, c])),
    [characters],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <Link href={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            POV Balance
          </h1>
          <p className="text-xs text-muted-foreground">{total} scene{total !== 1 ? "s" : ""} total</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Distribution chart ─────────────────────────────────────────── */}
        {stats.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-4">POV Distribution</h2>
            <div className="space-y-3 max-w-2xl">
              {stats.map(stat => (
                <div key={stat.pov_character_id ?? "none"} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-border"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-sm w-44 shrink-0 truncate">{stat.name}</span>
                  <PovBar color={stat.color} count={stat.count} total={total} />
                  <span className="text-xs text-muted-foreground tabular-nums w-28 text-right shrink-0">
                    {stat.count} scene{stat.count !== 1 ? "s" : ""} ({total > 0 ? Math.round((stat.count / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Scene assignment table ─────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Scene Assignments</h2>
          {projectScenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scenes yet.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-secondary/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">Act</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-36">Chapter</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Scene</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-52">POV Character</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {projectScenes.map(s => {
                    const currentPov = localPov[s.id] !== undefined ? localPov[s.id] : (corkboardPovMap[s.id] ?? null);
                    const currentChar = currentPov != null ? charMap[currentPov] : null;
                    const isSaving = savingSceneId === s.id;
                    return (
                      <tr key={s.id} className={cn("group hover:bg-secondary/20", isSaving && "opacity-60")}>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.act_title}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.chapter_title}</td>
                        <td className="px-3 py-2.5 font-medium">{s.title}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {currentChar && (
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: currentChar.color }}
                              />
                            )}
                            <select
                              value={currentPov ?? ""}
                              onChange={e => handleUpdate(s.id, e.target.value)}
                              disabled={isSaving}
                              className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer min-w-0"
                            >
                              <option value="">— No POV —</option>
                              {characters.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Shared store for corkboard column (subplot) colors.
 * The corkboard writes here; the sidebar reads from here so colors stay in
 * sync within the same tab without polling localStorage.
 */
import { create } from "zustand";

// ── localStorage persistence helpers ─────────────────────────────────────────

const LS_KEY = (pid: number) => `lw_col_colors_${pid}`;

export function loadColColors(pid: number): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY(pid)) ?? "{}"); }
  catch { return {}; }
}

function persist(pid: number, m: Record<string, string>) {
  localStorage.setItem(LS_KEY(pid), JSON.stringify(m));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ColColorsState {
  /** colColors[projectId][colName] = hex */
  byProject: Record<number, Record<string, string>>;

  /** Load from localStorage if not yet in store — safe to call in useEffect */
  ensureLoaded: (projectId: number) => void;

  /** Set a single column's color — updates store and localStorage */
  setColor: (projectId: number, col: string, hex: string) => void;

  /** Replace the entire color map for a project — used on corkboard init */
  setColors: (projectId: number, colors: Record<string, string>) => void;
}

export const useColColorsStore = create<ColColorsState>((set) => ({
  byProject: {},

  ensureLoaded: (projectId) =>
    set((s) => {
      if (s.byProject[projectId] !== undefined) return s; // already initialised
      return { byProject: { ...s.byProject, [projectId]: loadColColors(projectId) } };
    }),

  setColor: (projectId, col, hex) =>
    set((s) => {
      const prev = s.byProject[projectId] ?? loadColColors(projectId);
      const next = { ...prev, [col]: hex };
      persist(projectId, next);
      return { byProject: { ...s.byProject, [projectId]: next } };
    }),

  setColors: (projectId, colors) =>
    set((s) => {
      persist(projectId, colors);
      return { byProject: { ...s.byProject, [projectId]: colors } };
    }),
}));

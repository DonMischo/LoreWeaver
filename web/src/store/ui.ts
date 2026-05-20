import { create } from "zustand";
import type { SaveStatus } from "@/types";

function ls(key: string, fallback: string): string {
  if (typeof localStorage === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

interface UIState {
  sidebarOpen: boolean;
  codexSidebarOpen: boolean;
  saveStatus: SaveStatus;
  showParagraphNumbers: boolean;
  typewriterMode: boolean;
  typewriterOffset: number;   // 0-100, vertical % position for cursor
  focusMode: boolean;
  // Session timer
  sessionTimerEnabled: boolean;
  sessionGoal: number | null;       // target word delta for this session
  sessionStartTime: number | null;  // Date.now() when session began
  sessionBaseWords: number | null;  // word count at session start
  setSidebarOpen: (open: boolean) => void;
  setCodexSidebarOpen: (open: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setShowParagraphNumbers: (show: boolean) => void;
  setTypewriterMode: (on: boolean) => void;
  setTypewriterOffset: (pct: number) => void;
  setFocusMode: (on: boolean) => void;
  setSessionTimerEnabled: (on: boolean) => void;
  setSessionGoal: (goal: number, baseWords: number) => void;
  clearSession: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  codexSidebarOpen: false,
  saveStatus: "idle",
  showParagraphNumbers: ls("lw_para_numbers", "false") === "true",
  typewriterMode: ls("lw_typewriter", "false") === "true",
  typewriterOffset: Number(ls("lw_typewriter_offset", "50")),
  focusMode: false,
  sessionTimerEnabled: ls("lw_session_timer", "true") === "true",
  sessionGoal: null,
  sessionStartTime: null,
  sessionBaseWords: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCodexSidebarOpen: (open) => set({ codexSidebarOpen: open }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setShowParagraphNumbers: (show) => {
    localStorage.setItem("lw_para_numbers", String(show));
    set({ showParagraphNumbers: show });
  },
  setTypewriterMode: (on) => {
    localStorage.setItem("lw_typewriter", String(on));
    set({ typewriterMode: on });
  },
  setTypewriterOffset: (pct) => {
    localStorage.setItem("lw_typewriter_offset", String(pct));
    set({ typewriterOffset: pct });
  },
  setFocusMode: (on) => set({ focusMode: on }),
  setSessionTimerEnabled: (on) => {
    localStorage.setItem("lw_session_timer", String(on));
    set({ sessionTimerEnabled: on, sessionGoal: null, sessionStartTime: null, sessionBaseWords: null });
  },
  setSessionGoal: (goal, baseWords) =>
    set({ sessionGoal: goal, sessionStartTime: Date.now(), sessionBaseWords: baseWords }),
  clearSession: () =>
    set({ sessionGoal: null, sessionStartTime: null, sessionBaseWords: null }),
}));

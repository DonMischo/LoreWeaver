import { create } from "zustand";
import type { SaveStatus } from "@/types";

const LS_KEY = "lw_show_paragraph_numbers";

function readParagraphNumbers(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(LS_KEY) === "true";
}

interface UIState {
  sidebarOpen: boolean;
  codexSidebarOpen: boolean;
  saveStatus: SaveStatus;
  showParagraphNumbers: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCodexSidebarOpen: (open: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setShowParagraphNumbers: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  codexSidebarOpen: false,
  saveStatus: "idle",
  showParagraphNumbers: readParagraphNumbers(),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCodexSidebarOpen: (open) => set({ codexSidebarOpen: open }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setShowParagraphNumbers: (show) => {
    localStorage.setItem(LS_KEY, String(show));
    set({ showParagraphNumbers: show });
  },
}));

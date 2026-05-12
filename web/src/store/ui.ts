import { create } from "zustand";
import type { SaveStatus } from "@/types";

interface UIState {
  sidebarOpen: boolean;
  codexSidebarOpen: boolean;
  aiPanelOpen: boolean;
  saveStatus: SaveStatus;
  setSidebarOpen: (open: boolean) => void;
  setCodexSidebarOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  codexSidebarOpen: false,
  aiPanelOpen: false,
  saveStatus: "idle",
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCodexSidebarOpen: (open) => set({ codexSidebarOpen: open }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));

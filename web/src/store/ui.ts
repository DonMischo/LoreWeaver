import { create } from "zustand";
import type { SaveStatus } from "@/types";

interface UIState {
  sidebarOpen: boolean;
  codexSidebarOpen: boolean;
  saveStatus: SaveStatus;
  setSidebarOpen: (open: boolean) => void;
  setCodexSidebarOpen: (open: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  codexSidebarOpen: false,
  saveStatus: "idle",
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCodexSidebarOpen: (open) => set({ codexSidebarOpen: open }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
}

interface ScenePlansState {
  plans: Record<number, PlanItem[]>;
  addItem:    (sceneId: number, text: string) => void;
  toggleItem: (sceneId: number, itemId: string) => void;
  updateItem: (sceneId: number, itemId: string, text: string) => void;
  deleteItem: (sceneId: number, itemId: string) => void;
  clearDone:  (sceneId: number) => void;
}

export const useScenePlansStore = create<ScenePlansState>()(
  persist(
    (set) => ({
      plans: {},

      addItem: (sceneId, text) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [sceneId]: [
              ...(s.plans[sceneId] ?? []),
              { id: crypto.randomUUID(), text, done: false },
            ],
          },
        })),

      toggleItem: (sceneId, itemId) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [sceneId]: (s.plans[sceneId] ?? []).map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          },
        })),

      updateItem: (sceneId, itemId, text) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [sceneId]: (s.plans[sceneId] ?? []).map((item) =>
              item.id === itemId ? { ...item, text } : item
            ),
          },
        })),

      deleteItem: (sceneId, itemId) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [sceneId]: (s.plans[sceneId] ?? []).filter((item) => item.id !== itemId),
          },
        })),

      clearDone: (sceneId) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [sceneId]: (s.plans[sceneId] ?? []).filter((item) => !item.done),
          },
        })),
    }),
    { name: "foliantica-scene-plans" }
  )
);

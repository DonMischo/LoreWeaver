import { createContext, useContext } from "react";
import type { CodexEntry } from "@/types";

export interface EditorContextValue {
  characters: CodexEntry[];
  items: CodexEntry[];
  sceneId: number;
}

export const EditorContext = createContext<EditorContextValue>({
  characters: [],
  items: [],
  sceneId: 0,
});

export function useEditorContext() {
  return useContext(EditorContext);
}

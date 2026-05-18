import { createContext, useContext } from "react";
import type { CodexEntry } from "@/types";

export interface EditorContextValue {
  characters: CodexEntry[];
  items: CodexEntry[];
  allEntries: CodexEntry[];
  sceneId: number;
}

export const EditorContext = createContext<EditorContextValue>({
  characters: [],
  items: [],
  allEntries: [],
  sceneId: 0,
});

export function useEditorContext() {
  return useContext(EditorContext);
}

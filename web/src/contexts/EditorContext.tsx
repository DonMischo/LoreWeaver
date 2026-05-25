import { createContext, useContext } from "react";
import type { CodexEntry } from "@/types";

export interface EditorContextValue {
  characters: CodexEntry[];
  items: CodexEntry[];
  allEntries: CodexEntry[];
  sceneId: number;
  projectId: number;
  /** Open the new-entry dialog pre-filled with AI-extracted data */
  onPrefillEntry?: (data: Partial<CodexEntry>) => void;
}

export const EditorContext = createContext<EditorContextValue>({
  characters: [],
  items: [],
  allEntries: [],
  sceneId: 0,
  projectId: 0,
});

export function useEditorContext() {
  return useContext(EditorContext);
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Act {
  id: number;
  project_id: number;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Chapter {
  id: number;
  act_id: number;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Scene {
  id: number;
  chapter_id: number;
  title: string | null;
  content: string | null;
  order_index: number;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export type EntryType = "character" | "location" | "item" | "lore" | "custom";

export interface CodexEntry {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  entry_type: EntryType;
  description: string | null;
  notes: string | null;
  color: string;
  group: string | null;
  species: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodexRelation {
  id: number;
  source_id: number;
  target_id: number;
  relation_type: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  has_api_key: boolean;
  default_model: string;
  theme: string;
}

export type SaveStatus = "saved" | "saving" | "error" | "idle";

// Flowing read view shapes
export interface ChapterReadScene {
  id: number;
  title: string;
  content: string;
}

export interface ChapterReadData {
  id: number;
  title: string;
  act_id: number;
  act_title: string;
  scenes: ChapterReadScene[];
}

export interface ActReadChapter {
  id: number;
  title: string;
  scenes: ChapterReadScene[];
}

export interface ActReadData {
  id: number;
  title: string;
  chapters: ActReadChapter[];
}

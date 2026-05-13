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

export type SceneTime = Record<string, number>;  // unit_id → value

export interface Scene {
  id: number;
  chapter_id: number;
  title: string | null;
  content: string | null;
  order_index: number;
  word_count: number;
  scene_time: SceneTime | null;
  created_at: string;
  updated_at: string;
}

// ── Time Config ───────────────────────────────────────────────────────────────

export interface TimeUnit {
  id: string;
  singular: string;
  plural: string;
  count_per_parent: number | null;
  value_names: string[];
  enabled: boolean;
}

export interface DayNightConfig {
  hours_per_day: number;
  night_start_hour: number;
  night_duration: number;
}

export interface TimeConfig {
  units: TimeUnit[];
  day_night: DayNightConfig;
}

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  units: [
    { id: "age",    singular: "Age",    plural: "Ages",    count_per_parent: null, value_names: [],                                        enabled: false },
    { id: "year",   singular: "Year",   plural: "Years",   count_per_parent: 1000, value_names: [],                                        enabled: true  },
    { id: "season", singular: "Season", plural: "Seasons", count_per_parent: 4,    value_names: ["Spring","Summer","Autumn","Winter"],      enabled: false },
    { id: "month",  singular: "Month",  plural: "Months",  count_per_parent: 12,   value_names: [],                                        enabled: true  },
    { id: "day",    singular: "Day",    plural: "Days",    count_per_parent: 30,   value_names: [],                                        enabled: true  },
    { id: "hour",   singular: "Hour",   plural: "Hours",   count_per_parent: 24,   value_names: [],                                        enabled: true  },
    { id: "minute", singular: "Minute", plural: "Minutes", count_per_parent: 60,   value_names: [],                                        enabled: false },
    { id: "second", singular: "Second", plural: "Seconds", count_per_parent: 60,   value_names: [],                                        enabled: false },
  ],
  day_night: { hours_per_day: 24, night_start_hour: 20, night_duration: 10 },
};

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
  subtype: string | null;
  tags: string[];
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

export interface CodexRelationResolved {
  id: number;
  source_id: number;
  target_id: number;
  other_id: number;
  other_name: string;
  other_color: string;
  other_type: EntryType;
  relation_type: string;
  direction: "from" | "to";
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

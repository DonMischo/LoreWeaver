// ── Book metadata (EPUB Dublin Core fields) ───────────────────────────────────

export interface BookMeta {
  author?: string;          // dc:creator
  author_sort?: string;     // sort key, e.g. "Tolkien, J.R.R."
  subtitle?: string;        // secondary title
  language?: string;        // BCP 47 language code
  publisher?: string;       // dc:publisher
  published_date?: string;  // dc:date — YYYY or YYYY-MM-DD
  isbn?: string;            // dc:identifier scheme=ISBN
  rights?: string;          // dc:rights (copyright statement)
  series?: string;          // series name
  series_index?: string;    // position in series
  genre?: string;           // primary subject/category
  subjects?: string[];      // additional subject tags
  synopsis?: string;        // dc:description (separate from project.description)
  translator?: string;      // dc:contributor role="trl"
  editor?: string;          // dc:contributor role="edt"
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  book_meta: BookMeta | null;
  shared_codex_project_id: number | null;
  cover_image: string | null;
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

export interface Currency {
  name: string;
  amount: number;
}

export interface Possession {
  entry_id: number;
  quantity: number;
  notes?: string;
}

export interface CharacterInventory {
  currencies: Currency[];
  possessions: Possession[];
}

export interface CodexEntry {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  entry_type: EntryType;
  description: string | null;
  notes: string | null;
  color: string;
  groups: string[];
  species: string | null;
  subtype: string | null;
  tags: string[];
  is_main_char: boolean;
  inventory: CharacterInventory | null;
  image_path: string | null;
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
  enabled_models: string[];
}

// ── Fragments ─────────────────────────────────────────────────────────────────

export const BUILTIN_TABS = ["snippets", "ideas", "archive"] as const;
export type BuiltinTab = typeof BUILTIN_TABS[number];

export interface Fragment {
  id: number;
  project_id: number;
  tab: string;
  title: string | null;
  content: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface FragmentTabs {
  builtin: string[];
  custom: string[];
  all: string[];
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

export interface AIPrompt {
  id: number;
  name: string;
  description: string;
  system: string;
  user_template: string;
  is_built_in: boolean;
  built_in_key: string | null;
}

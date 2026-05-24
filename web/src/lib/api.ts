import type {
  Project, Act, Chapter, Scene, CodexEntry, CodexRelation, CodexRelationResolved,
  Settings, ChapterReadData, ActReadData, TimeConfig, SceneTime,
  Fragment, FragmentTabs, BookMeta, AIPrompt, ProjectSceneItem,
  SceneVersion, SceneVersionDetail, MentionStat, SceneMentionStat,
  WritingLogEntry, GhostTextScene, CorkboardAct, CorkboardData,
  TimelineTrack, TimelineEventItem,
} from "@/types";

const BASE = "/api";

// ── Export types ──────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: "md" | "tex" | "epub-style" | "pdf" | "epub";
  scene_ids?: number[] | null;
  include_act_headings: boolean;
  include_chapter_headings: boolean;
  include_scene_headings: boolean;
  font?: string;
  font_size: "10pt" | "11pt" | "12pt";
  line_spacing: "1" | "1.5" | "2";
  paper_size: "a4paper" | "letterpaper";
  text_color: string;
  bg_color: string;
  page_margin: string;
  // author and other metadata come from project.book_meta (set via Project Info)
  /** When true the backend saves to {dataDir}/exports/ and returns {saved_to, filename} */
  save_to_disk?: boolean;
  // ── Style ──────────────────────────────────────────────────────────────────
  heading_font?: string | null;
  heading_align?: "center" | "left";
  h1_size?: string;
  h2_size?: string;
  h3_size?: string;
  h3_style?: "italic" | "normal" | "bold";
  paragraph_indent?: string;
  text_align?: "justify" | "left";
  pdf_margin?: string;
  page_numbers?: boolean;
  drop_caps?: boolean;
}

export interface ExportScene   { id: number; title: string; order_index: number }
export interface ExportChapter { id: number; title: string; order_index: number; scenes: ExportScene[] }
export interface ExportAct     { id: number; title: string; order_index: number; chapters: ExportChapter[] }
export interface ExportStructure { title: string; acts: ExportAct[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Projects ──────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: () => req<Project[]>("/projects"),
  get: (id: number) => req<Project>(`/projects/${id}`),
  create: (data: { title: string; description?: string; copy_codex_from?: number; share_codex_from?: number }) =>
    req<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Project, "title" | "description">> & { book_meta?: BookMeta | null }) =>
    req<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/projects/${id}`, { method: "DELETE" }),
  exportStructure: (id: number) =>
    req<ExportStructure>(`/projects/${id}/export/structure`),
  export: (id: number, opts: ExportOptions): Promise<Response> =>
    fetch(`${BASE}/projects/${id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),
  listScenes: (id: number) => req<ProjectSceneItem[]>(`/projects/${id}/scenes`),
  structure: (id: number) => req<CorkboardAct[]>(`/projects/${id}/structure`),
  corkboard: (id: number) => req<CorkboardData>(`/projects/${id}/corkboard`),
  setSubplotNames: (id: number, names: string[]) =>
    req<string[]>(`/projects/${id}/subplot-names`, { method: "PATCH", body: JSON.stringify({ names }) }),
};

// ── Export fonts ──────────────────────────────────────────────────────────────

export const fontsApi = {
  /** List font families available in the Pandoc container for PDF/EPUB exports. */
  pandocFonts: () => req<{ fonts: string[] }>("/projects/export/fonts"),
};

// ── Acts ──────────────────────────────────────────────────────────────────────

export const actsApi = {
  list: (projectId: number) => req<Act[]>(`/projects/${projectId}/acts`),
  create: (data: { project_id: number; title: string; order_index?: number }) =>
    req<Act>("/acts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Act, "title" | "order_index">>) =>
    req<Act>(`/acts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/acts/${id}`, { method: "DELETE" }),
  reorder: (items: { id: number; order_index: number }[]) =>
    req<void>("/acts/reorder", { method: "POST", body: JSON.stringify({ items }) }),
  read: (id: number) => req<ActReadData>(`/acts/${id}/read`),
};

// ── Chapters ──────────────────────────────────────────────────────────────────

export const chaptersApi = {
  list: (actId: number) => req<Chapter[]>(`/acts/${actId}/chapters`),
  create: (data: { act_id: number; title: string; order_index?: number }) =>
    req<Chapter>("/chapters", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Chapter, "title" | "order_index">>) =>
    req<Chapter>(`/chapters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/chapters/${id}`, { method: "DELETE" }),
  reorder: (items: { id: number; order_index: number }[]) =>
    req<void>("/chapters/reorder", { method: "POST", body: JSON.stringify({ items }) }),
  read: (id: number) => req<ChapterReadData>(`/chapters/${id}/read`),
};

// ── Scenes ────────────────────────────────────────────────────────────────────

export const scenesApi = {
  list: (chapterId: number) => req<Scene[]>(`/chapters/${chapterId}/scenes`),
  get: (id: number) => req<Scene>(`/scenes/${id}`),
  create: (data: { chapter_id: number; title?: string; content?: string; order_index?: number }) =>
    req<Scene>("/scenes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Scene, "title" | "content" | "synopsis" | "order_index" | "word_count" | "scene_time" | "chapter_id">> & {
    subplot?: string | null;
    stack_group?: string | null;
    global_order?: number;
    node_x?: number | null;
    node_y?: number | null;
  }) =>
    req<Scene>(`/scenes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/scenes/${id}`, { method: "DELETE" }),
  reorder: (items: { id: number; order_index: number }[]) =>
    req<void>("/scenes/reorder", { method: "POST", body: JSON.stringify({ items }) }),
};

// ── Codex ─────────────────────────────────────────────────────────────────────

export const codexApi = {
  list: (projectId: number) => req<CodexEntry[]>(`/projects/${projectId}/codex`),
  get: (id: number) => req<CodexEntry>(`/codex/${id}`),
  create: (data: Omit<CodexEntry, "id" | "created_at" | "updated_at">) =>
    req<CodexEntry>("/codex", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Omit<CodexEntry, "id" | "project_id" | "created_at" | "updated_at">>) =>
    req<CodexEntry>(`/codex/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/codex/${id}`, { method: "DELETE" }),
  getRelations: (id: number) => req<CodexRelationResolved[]>(`/codex/${id}/relations`),
  createRelation: (data: { source_id: number; target_id: number; relation_type?: string }) =>
    req<CodexRelation>("/codex/relations", { method: "POST", body: JSON.stringify(data) }),
  deleteRelation: (id: number) => req<void>(`/codex/relations/${id}`, { method: "DELETE" }),
  getCharacterCurrencies: (characterId: number) =>
    req<string[]>(`/codex/${characterId}/currencies`),
  getInventorySummary: (characterId: number) =>
    req<InventorySummary>(`/codex/${characterId}/inventory-summary`),
  getCharacterItemLog: (characterId: number, itemId: number) =>
    req<ProjectItemLogEntry[]>(`/codex/${characterId}/item-log?item_id=${itemId}`),
  getCharacterCurrencyLog: (characterId: number, currencyName: string) =>
    req<ProjectCurrencyLogEntry[]>(`/codex/${characterId}/currency-log?currency_name=${encodeURIComponent(currencyName)}`),
};

// ── Images ────────────────────────────────────────────────────────────────────

async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteImage(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

export const imagesApi = {
  uploadProjectCover: (projectId: number, file: File) =>
    upload<{ cover_image: string }>(`/projects/${projectId}/cover`, file),
  deleteProjectCover: (projectId: number) =>
    deleteImage(`/projects/${projectId}/cover`),
  uploadCodexImage: (entryId: number, file: File) =>
    upload<{ image_path: string }>(`/codex/${entryId}/image`, file),
  deleteCodexImage: (entryId: number) =>
    deleteImage(`/codex/${entryId}/image`),
  /** Convert a stored relative path to an absolute URL for <img src> */
  url: (path: string) => `/${path}`,
};

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  message: string;
  project_id?: number;
  acts?: number;
  chapters?: number;
  scenes?: number;
  created?: number;
  skipped?: number;
}

export const importApi = {
  story: (projectId: number, file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/projects/${projectId}/import/story`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });
  },
  codex: (projectId: number, file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/projects/${projectId}/import/codex`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });
  },
};

// ── Scene Commands ────────────────────────────────────────────────────────────

export interface ItemLogEntry {
  scene_id: number;
  scene_title: string;
  qty: number;
  is_current_scene: boolean;
}

export interface ProjectItemLogEntry {
  scene_id: number;
  scene_title: string;
  delta: number;
  total: number;
}

export interface ProjectCurrencyLogEntry {
  scene_id: number;
  scene_title: string;
  delta: number;
  balance: number;
}

export interface InventorySummary {
  items: { item_id: number; qty: number }[];
  currencies: { name: string; balance: number }[];
}

export interface SceneCommandIn {
  command_type: "currency" | "item";
  character_id: number;
  item_id?: number | null;
  data?: Record<string, unknown> | null;
  order_index: number;
}

export const sceneCommandsApi = {
  sync: (sceneId: number, commands: SceneCommandIn[]) =>
    req(`/scenes/${sceneId}/commands/sync`, {
      method: "POST",
      body: JSON.stringify({ commands }),
    }),
  history: (projectId: number, params?: { command_type?: string; character_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.command_type) qs.set("command_type", params.command_type);
    if (params?.character_id) qs.set("character_id", String(params.character_id));
    return req<unknown[]>(`/projects/${projectId}/command-history?${qs}`);
  },
  getItemLog: (sceneId: number, itemId: number, characterId: number) =>
    req<ItemLogEntry[]>(
      `/scenes/${sceneId}/item-log?item_id=${itemId}&character_id=${characterId}`
    ),
  getCurrencyBalance: (sceneId: number, characterId: number, currencyName: string) =>
    req<{ balance: number }>(
      `/scenes/${sceneId}/currency-balance?character_id=${characterId}&currency_name=${encodeURIComponent(currencyName)}`
    ),
  getProjectItemLog: (projectId: number, itemId: number, characterId: number) =>
    req<ProjectItemLogEntry[]>(
      `/projects/${projectId}/item-log?item_id=${itemId}&character_id=${characterId}`
    ),
  getProjectCurrencyLog: (projectId: number, characterId: number, currencyName: string) =>
    req<ProjectCurrencyLogEntry[]>(
      `/projects/${projectId}/currency-log?character_id=${characterId}&currency_name=${encodeURIComponent(currencyName)}`
    ),
  resyncAll: (projectId: number) =>
    req<{ ok: boolean }>(`/projects/${projectId}/commands/resync`, { method: "POST" }),
};

// ── Time Config ───────────────────────────────────────────────────────────────

export const timeApi = {
  getConfig: (projectId: number) => req<TimeConfig>(`/projects/${projectId}/time-config`),
  updateConfig: (projectId: number, config: TimeConfig) =>
    req<TimeConfig>(`/projects/${projectId}/time-config`, { method: "PATCH", body: JSON.stringify(config) }),
  getTimeline: (projectId: number) => req<TimelineData>(`/projects/${projectId}/timeline`),
  getTimelineV2: (projectId: number) => req<TimelineV2Data>(`/projects/${projectId}/timeline-v2`),
};

export interface TimelineEntry {
  scene_id: number;
  scene_title: string;
  act_title: string;
  chapter_title: string;
  scene_time: SceneTime;
  time_display: string;
  day_night: "Day" | "Night" | null;
  sort_key: number[];
}

export interface TimelineData {
  config: TimeConfig;
  entries: TimelineEntry[];
}

export interface TimelineNode {
  id: string;
  type: "scene" | "event";
  scene_id?: number;
  event_id?: number;
  track_id?: number | null;
  title: string;
  time_display: string;
  sort_key: number[];
  day_night: "Day" | "Night" | null;
  act_title?: string;
  chapter_title?: string;
  subplot?: string | null;
  color?: string;
  description?: string | null;
}

export interface TimelineV2Data {
  config: TimeConfig;
  tracks: TimelineTrack[];
  story_nodes: TimelineNode[];
  event_nodes: TimelineNode[];
  available_subplots: string[];
}

export const timelineTracksApi = {
  list:   (pid: number) => req<TimelineTrack[]>(`/projects/${pid}/timeline-tracks`),
  create: (pid: number, body: Partial<TimelineTrack>) =>
    req<TimelineTrack>(`/projects/${pid}/timeline-tracks`, { method: "POST", body: JSON.stringify(body) }),
  update: (pid: number, id: number, body: Partial<TimelineTrack>) =>
    req<TimelineTrack>(`/projects/${pid}/timeline-tracks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (pid: number, id: number) =>
    req<void>(`/projects/${pid}/timeline-tracks/${id}`, { method: "DELETE" }),
};

export const timelineEventsApi = {
  list:   (pid: number) => req<TimelineEventItem[]>(`/projects/${pid}/timeline-events`),
  create: (pid: number, body: Partial<TimelineEventItem>) =>
    req<TimelineEventItem>(`/projects/${pid}/timeline-events`, { method: "POST", body: JSON.stringify(body) }),
  update: (pid: number, id: number, body: Partial<TimelineEventItem>) =>
    req<TimelineEventItem>(`/projects/${pid}/timeline-events/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (pid: number, id: number) =>
    req<void>(`/projects/${pid}/timeline-events/${id}`, { method: "DELETE" }),
};

// ── Fragments ─────────────────────────────────────────────────────────────────

export const fragmentsApi = {
  getTabs: (projectId: number) =>
    req<FragmentTabs>(`/projects/${projectId}/fragment-tabs`),
  updateTabs: (projectId: number, customTabs: string[]) =>
    req<FragmentTabs>(`/projects/${projectId}/fragment-tabs`, {
      method: "PATCH", body: JSON.stringify({ custom_tabs: customTabs }),
    }),
  list: (projectId: number, tab?: string) =>
    req<Fragment[]>(`/projects/${projectId}/fragments${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`),
  create: (projectId: number, data: { tab: string; title?: string; content?: string }) =>
    req<Fragment>(`/projects/${projectId}/fragments`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Fragment, "tab" | "title" | "content" | "category" | "order_index">>) =>
    req<Fragment>(`/fragments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/fragments/${id}`, { method: "DELETE" }),
  import: (projectId: number, files: File[]): Promise<{ message: string; created: number; skipped: number }> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return fetch(`${BASE}/projects/${projectId}/fragments/import`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
}

export const settingsApi = {
  get: () => req<Settings>("/settings"),
  update: (data: {
    openrouter_api_key?: string;
    default_model?: string;
    default_chat_model?: string | null;
    theme?: string;
    enabled_models?: string[];
    language?: string;
    show_paragraph_numbers?: boolean;
    typewriter_mode?: boolean;
    typewriter_offset?: number;
    session_timer_enabled?: boolean;
    grammar_check_enabled?: boolean;
    grammar_check_url?: string;
    grammar_languages?: string[];
    pandoc_enabled?: boolean;
    pandoc_url?: string;
  }) => req<Settings>("/settings", { method: "POST", body: JSON.stringify(data) }),
  getModels: () => req<OpenRouterModel[]>("/settings/models"),
  serviceStatus: () => req<{ languagetool: "ok" | "error" | "offline"; pandoc: "ok" | "error" | "offline" }>("/settings/service-status"),
  dockerComposeUp: () => req<{ status: string; output: string }>("/settings/docker/up", { method: "POST" }),
};

// ── AI Prompts ────────────────────────────────────────────────────────────────

export const promptsApi = {
  list: () => req<AIPrompt[]>("/settings/prompts"),
  create: (data: { name: string; description?: string; system?: string; user_template?: string; word_count?: number }) =>
    req<AIPrompt>("/settings/prompts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string; description?: string; system?: string; user_template?: string; word_count?: number }) =>
    req<AIPrompt>(`/settings/prompts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => req<void>(`/settings/prompts/${id}`, { method: "DELETE" }),
  revert: (id: number) => req<AIPrompt>(`/settings/prompts/${id}/revert`, { method: "POST" }),
};

// ── Data directory ────────────────────────────────────────────────────────────

export const dataDirApi = {
  get: () => req<{ current: string; configured: string | null }>("/settings/data-dir"),
  pick: async (): Promise<{ path: string | null }> => {
    // Start the native dialog in a background thread (returns immediately).
    const { session_id } = await req<{ session_id: string }>(
      "/settings/data-dir/pick", { method: "POST" }
    );
    // Poll until the user closes the dialog (up to 5 minutes).
    for (let i = 0; i < 300; i++) {
      await new Promise<void>(r => setTimeout(r, 1000));
      const res = await req<{ status: string; path?: string | null; error?: string }>(
        `/settings/data-dir/pick/${session_id}`
      );
      if (res.status === "done")  return { path: res.path ?? null };
      if (res.status === "error") throw new Error(res.error ?? "Folder picker failed");
    }
    throw new Error("Timed out waiting for folder selection");
  },
  check: (path: string) =>
    req<{ has_db: boolean }>(`/settings/data-dir/check?path=${encodeURIComponent(path)}`),
  set: (p: string | null, migrate = false) =>
    req<{ current: string; configured: string | null }>("/settings/data-dir", {
      method: "POST",
      body: JSON.stringify({ path: p, migrate }),
    }),
  restart: () => req<{ status: string }>("/settings/restart", { method: "POST" }),
};

// ── Scene Versions ────────────────────────────────────────────────────────────

export const versionsApi = {
  create: (sceneId: number, content: string) =>
    req<SceneVersion>(`/scenes/${sceneId}/versions`, { method: "POST", body: JSON.stringify({ content }) }),
  list: (sceneId: number) =>
    req<SceneVersion[]>(`/scenes/${sceneId}/versions`),
  get: (sceneId: number, versionId: number) =>
    req<SceneVersionDetail>(`/scenes/${sceneId}/versions/${versionId}`),
  restore: (sceneId: number, versionId: number) =>
    req<SceneVersionDetail>(`/scenes/${sceneId}/versions/${versionId}/restore`, { method: "POST" }),
};

// ── AI synopsis ───────────────────────────────────────────────────────────────

export const synopsisApi = {
  generate: (sceneId: number) =>
    req<{ synopsis: string }>(`/ai/scenes/${sceneId}/synopsis`, { method: "POST" }),
};

// ── Ki (AI Generate) ──────────────────────────────────────────────────────────

export const kiApi = {
  generate: (data: {
    scene_id: number;
    model: string;
    codex_ids: number[];
    extra_scene_ids: number[];
    prompt: string;
    prompt_id?: number | null;
    entry_type?: string;
    word_count?: number | null;
  }) => req<{ text: string }>("/ai/ki", { method: "POST", body: JSON.stringify(data) }),
};

// ── Mention stats ─────────────────────────────────────────────────────────────

export const mentionStatsApi = {
  forScene: (sceneId: number) =>
    req<MentionStat[]>(`/scenes/${sceneId}/mention-stats`),
  forProject: (projectId: number) =>
    req<MentionStat[]>(`/projects/${projectId}/mention-stats`),
  forEntry: (entryId: number) =>
    req<SceneMentionStat[]>(`/codex/${entryId}/scene-mentions`),
  rescanProject: (projectId: number) =>
    req<{ scanned: number }>(`/projects/${projectId}/mentions/rescan`, { method: "POST" }),
};

// ── Writing log / streaks ─────────────────────────────────────────────────────

export const writingLogApi = {
  forProject: (projectId: number) =>
    req<WritingLogEntry[]>(`/projects/${projectId}/writing-log`),
  global: () =>
    req<WritingLogEntry[]>(`/writing-log`),
  ghostTexts: (projectId: number) =>
    req<GhostTextScene[]>(`/projects/${projectId}/ghost-texts`),
};

export const chatApi = {
  stream: (
    sceneId: number,
    messages: { role: string; content: string }[],
    model?: string,
  ) =>
    fetch(`${BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene_id: sceneId, messages, model }),
    }),
};

// ── Grammar check ─────────────────────────────────────────────────────────────

export interface GrammarMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; description: string; issueType: string };
  context: { text: string; offset: number; length: number };
}

export interface GrammarCheckResult {
  matches: GrammarMatch[];
}

export const grammarApi = {
  check: (text: string, language = "auto") =>
    req<GrammarCheckResult>("/grammar/check", {
      method: "POST",
      body: JSON.stringify({ text, language }),
      // LanguageTool can be slow on first use or long texts; give it 3 minutes.
      signal: AbortSignal.timeout(180_000),
    }),
  languages: () =>
    req<{ name: string; code: string; longCode: string }[]>("/grammar/languages"),
};

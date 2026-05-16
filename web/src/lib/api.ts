import type {
  Project, Act, Chapter, Scene, CodexEntry, CodexRelation, CodexRelationResolved,
  Settings, ChapterReadData, ActReadData, TimeConfig, SceneTime,
  Fragment, FragmentTabs, BookMeta,
} from "@/types";

const BASE = "/api";

// ── Export types ──────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: "md" | "tex" | "epub-style";
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
  update: (id: number, data: Partial<Pick<Scene, "title" | "content" | "order_index" | "word_count" | "scene_time">>) =>
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

// ── Time Config ───────────────────────────────────────────────────────────────

export const timeApi = {
  getConfig: (projectId: number) => req<TimeConfig>(`/projects/${projectId}/time-config`),
  updateConfig: (projectId: number, config: TimeConfig) =>
    req<TimeConfig>(`/projects/${projectId}/time-config`, { method: "PATCH", body: JSON.stringify(config) }),
  getTimeline: (projectId: number) => req<TimelineData>(`/projects/${projectId}/timeline`),
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
  update: (id: number, data: Partial<Pick<Fragment, "tab" | "title" | "content" | "order_index">>) =>
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

export const settingsApi = {
  get: () => req<Settings>("/settings"),
  update: (data: { openrouter_api_key?: string; default_model?: string; theme?: string }) =>
    req<Settings>("/settings", { method: "POST", body: JSON.stringify(data) }),
};

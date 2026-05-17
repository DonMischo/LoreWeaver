import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, actsApi, chaptersApi, scenesApi, codexApi, settingsApi, timeApi, fragmentsApi, imagesApi, sceneCommandsApi } from "@/lib/api";
import type { SceneCommandIn, ProjectItemLogEntry, ProjectCurrencyLogEntry } from "@/lib/api";

// ── Projects ──────────────────────────────────────────────────────────────────

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

export const useProject = (id: number) =>
  useQuery({ queryKey: ["projects", id], queryFn: () => projectsApi.get(id), enabled: !!id });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof projectsApi.update>[1] }) =>
      projectsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};

// ── Acts ──────────────────────────────────────────────────────────────────────

export const useActs = (projectId: number) =>
  useQuery({
    queryKey: ["acts", projectId],
    queryFn: () => actsApi.list(projectId),
    enabled: !!projectId,
  });

export const useCreateAct = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acts", projectId] }),
  });
};

export const useUpdateAct = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof actsApi.update>[1] }) =>
      actsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acts", projectId] }),
  });
};

export const useDeleteAct = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acts", projectId] }),
  });
};

export const useReorderActs = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actsApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acts", projectId] }),
  });
};

export const useActRead = (actId: number) =>
  useQuery({
    queryKey: ["act-read", actId],
    queryFn: () => actsApi.read(actId),
    enabled: !!actId,
  });

// ── Chapters ──────────────────────────────────────────────────────────────────

export const useChapters = (actId: number) =>
  useQuery({
    queryKey: ["chapters", actId],
    queryFn: () => chaptersApi.list(actId),
    enabled: !!actId,
  });

export const useCreateChapter = (actId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", actId] }),
  });
};

export const useUpdateChapter = (actId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof chaptersApi.update>[1] }) =>
      chaptersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapters", actId] });
      qc.invalidateQueries({ queryKey: ["acts"] }); // update chapter title in act views
    },
  });
};

export const useDeleteChapter = (actId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", actId] }),
  });
};

export const useReorderChapters = (actId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", actId] }),
  });
};

export const useChapterRead = (chapterId: number) =>
  useQuery({
    queryKey: ["chapter-read", chapterId],
    queryFn: () => chaptersApi.read(chapterId),
    enabled: !!chapterId,
  });

// ── Scenes ────────────────────────────────────────────────────────────────────

export const useScenes = (chapterId: number) =>
  useQuery({
    queryKey: ["scenes", chapterId],
    queryFn: () => scenesApi.list(chapterId),
    enabled: !!chapterId,
  });

export const useScene = (sceneId: number) =>
  useQuery({
    queryKey: ["scene", sceneId],
    queryFn: () => scenesApi.get(sceneId),
    enabled: !!sceneId,
  });

export const useCreateScene = (chapterId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scenesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", chapterId] }),
  });
};

export const useUpdateScene = (sceneId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: Parameters<typeof scenesApi.update>[1] }) =>
      scenesApi.update(sceneId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scene", sceneId] });
      qc.invalidateQueries({ queryKey: ["scenes"] }); // update title in sidebar lists
    },
  });
};

export const useDeleteScene = (chapterId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scenesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", chapterId] }),
  });
};

export const useReorderScenes = (chapterId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scenesApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", chapterId] }),
  });
};

// ── Codex ─────────────────────────────────────────────────────────────────────

export const useCodexEntries = (projectId: number) =>
  useQuery({
    queryKey: ["codex", projectId],
    queryFn: () => codexApi.list(projectId),
    enabled: !!projectId,
  });

export const useCreateCodexEntry = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: codexApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex", projectId] }),
  });
};

export const useUpdateCodexEntry = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof codexApi.update>[1] }) =>
      codexApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["codex", projectId] });
      qc.invalidateQueries({ queryKey: ["inventory-summary", id] });
    },
  });
};

export const useDeleteCodexEntry = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: codexApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex", projectId] }),
  });
};

export const useEntryRelations = (entryId: number) =>
  useQuery({
    queryKey: ["codex-relations", entryId],
    queryFn: () => codexApi.getRelations(entryId),
    enabled: !!entryId,
  });

export const useCreateRelation = (entryId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: codexApi.createRelation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex-relations", entryId] }),
  });
};

export const useDeleteRelation = (entryId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: codexApi.deleteRelation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex-relations", entryId] }),
  });
};

// ── Time Config ───────────────────────────────────────────────────────────────

export const useTimeConfig = (projectId: number) =>
  useQuery({
    queryKey: ["time-config", projectId],
    queryFn: () => timeApi.getConfig(projectId),
    enabled: !!projectId,
  });

export const useUpdateTimeConfig = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Parameters<typeof timeApi.updateConfig>[1]) =>
      timeApi.updateConfig(projectId, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-config", projectId] }),
  });
};

export const useTimeline = (projectId: number) =>
  useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => timeApi.getTimeline(projectId),
    enabled: !!projectId,
  });

// ── Fragments ─────────────────────────────────────────────────────────────────

export const useFragmentTabs = (projectId: number) =>
  useQuery({
    queryKey: ["fragment-tabs", projectId],
    queryFn: () => fragmentsApi.getTabs(projectId),
    enabled: !!projectId,
  });

export const useUpdateFragmentTabs = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customTabs: string[]) => fragmentsApi.updateTabs(projectId, customTabs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragment-tabs", projectId] }),
  });
};

export const useFragments = (projectId: number) =>
  useQuery({
    queryKey: ["fragments", projectId],
    queryFn: () => fragmentsApi.list(projectId),
    enabled: !!projectId,
  });

export const useCreateFragment = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fragmentsApi.create>[1]) =>
      fragmentsApi.create(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragments", projectId] }),
  });
};

export const useUpdateFragment = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof fragmentsApi.update>[1] }) =>
      fragmentsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragments", projectId] }),
  });
};

export const useDeleteFragment = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fragmentsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragments", projectId] }),
  });
};

// ── Scene Commands ────────────────────────────────────────────────────────────

export const useSyncSceneCommands = (sceneId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commands: SceneCommandIn[]) => sceneCommandsApi.sync(sceneId, commands),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["codex"] });           // refreshes CodexEntry.inventory
      qc.invalidateQueries({ queryKey: ["codex-relations"] });
      qc.invalidateQueries({ queryKey: ["item-log"] });
      qc.invalidateQueries({ queryKey: ["currency-balance"] });
      qc.invalidateQueries({ queryKey: ["character-currencies"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });
};

export const useItemLog = (sceneId: number, itemId: number, characterId: number) =>
  useQuery({
    queryKey: ["item-log", sceneId, itemId, characterId],
    queryFn: () => sceneCommandsApi.getItemLog(sceneId, itemId, characterId),
    enabled: sceneId > 0 && itemId > 0 && characterId > 0,
  });

export const useCurrencyBalance = (sceneId: number, characterId: number, currencyName: string) =>
  useQuery({
    queryKey: ["currency-balance", sceneId, characterId, currencyName],
    queryFn: () => sceneCommandsApi.getCurrencyBalance(sceneId, characterId, currencyName),
    enabled: sceneId > 0 && characterId > 0 && !!currencyName,
  });

export const useCharacterCurrencies = (characterId: number) =>
  useQuery({
    queryKey: ["character-currencies", characterId],
    queryFn: () => codexApi.getCharacterCurrencies(characterId),
    enabled: characterId > 0,
  });

export const useInventorySummary = (characterId: number) =>
  useQuery({
    queryKey: ["inventory-summary", characterId],
    queryFn: () => codexApi.getInventorySummary(characterId),
    enabled: characterId > 0,
  });

export const useResyncProjectCommands = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sceneCommandsApi.resyncAll(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
      qc.invalidateQueries({ queryKey: ["project-item-log"] });
      qc.invalidateQueries({ queryKey: ["project-currency-log"] });
      qc.invalidateQueries({ queryKey: ["codex"] });
    },
  });
};

export const useProjectItemLog = (projectId: number, itemId: number, characterId: number) =>
  useQuery<ProjectItemLogEntry[]>({
    queryKey: ["project-item-log", projectId, itemId, characterId],
    queryFn: () => sceneCommandsApi.getProjectItemLog(projectId, itemId, characterId),
    enabled: projectId > 0 && itemId > 0 && characterId > 0,
  });

export const useProjectCurrencyLog = (projectId: number, characterId: number, currencyName: string) =>
  useQuery<ProjectCurrencyLogEntry[]>({
    queryKey: ["project-currency-log", projectId, characterId, currencyName],
    queryFn: () => sceneCommandsApi.getProjectCurrencyLog(projectId, characterId, currencyName),
    enabled: projectId > 0 && characterId > 0 && !!currencyName,
  });

export const useCharacterItemLog = (characterId: number, itemId: number) =>
  useQuery<ProjectItemLogEntry[]>({
    queryKey: ["character-item-log", characterId, itemId],
    queryFn: () => codexApi.getCharacterItemLog(characterId, itemId),
    enabled: characterId > 0 && itemId > 0,
  });

export const useCharacterCurrencyLog = (characterId: number, currencyName: string) =>
  useQuery<ProjectCurrencyLogEntry[]>({
    queryKey: ["character-currency-log", characterId, currencyName],
    queryFn: () => codexApi.getCharacterCurrencyLog(characterId, currencyName),
    enabled: characterId > 0 && !!currencyName,
  });

// ── Images ────────────────────────────────────────────────────────────────────

export const useUploadProjectCover = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => imagesApi.uploadProjectCover(projectId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
};

export const useDeleteProjectCover = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => imagesApi.deleteProjectCover(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
};

export const useUploadCodexImage = (entryId: number, projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => imagesApi.uploadCodexImage(entryId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex", projectId] }),
  });
};

export const useDeleteCodexImage = (entryId: number, projectId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => imagesApi.deleteCodexImage(entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex", projectId] }),
  });
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
};

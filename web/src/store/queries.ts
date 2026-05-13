import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, actsApi, chaptersApi, scenesApi, codexApi, settingsApi } from "@/lib/api";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", actId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codex", projectId] }),
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

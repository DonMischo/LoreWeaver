"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActs, useChapters, useScenes } from "@/store/queries";

/** Auto-redirect to the first scene on project open. */
function FirstSceneRedirect({ projectId, actId }: { projectId: number; actId: number }) {
  const router = useRouter();
  const { data: chapters = [], isLoading: chapLoading } = useChapters(actId);

  useEffect(() => {
    if (chapLoading || chapters.length === 0) return;
    router.replace(`/projects/${projectId}/chapters/${chapters[0].id}/first`);
  }, [chapters, chapLoading, projectId, router]);

  return null;
}

/** Drill to first scene via first act's first chapter. */
export default function ProjectPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();

  const { data: acts = [], isLoading } = useActs(projectId);

  // Once we have acts, if first act has chapters, drill down to first scene
  const { data: chapters = [], isLoading: chapLoading } = useChapters(
    acts[0]?.id ?? 0
  );
  const { data: scenes = [], isLoading: scenesLoading } = useScenes(
    chapters[0]?.id ?? 0
  );

  useEffect(() => {
    if (isLoading || chapLoading || scenesLoading) return;
    if (acts.length === 0) return;
    if (chapters.length === 0) return;
    if (scenes.length === 0) {
      // No scenes yet — go to chapter read view
      router.replace(`/projects/${projectId}/chapters/${chapters[0].id}`);
      return;
    }
    router.replace(`/projects/${projectId}/scenes/${scenes[0].id}`);
  }, [acts, chapters, scenes, isLoading, chapLoading, scenesLoading, projectId, router]);

  if (!isLoading && acts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-muted-foreground mb-2">No acts yet.</p>
        <p className="text-sm text-muted-foreground">Use the + in the sidebar to add an act.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}

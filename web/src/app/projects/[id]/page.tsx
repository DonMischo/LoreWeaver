"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChapters, useScenes } from "@/store/queries";

export default function ProjectPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();
  const { data: chapters = [], isLoading } = useChapters(projectId);

  useEffect(() => {
    if (isLoading || chapters.length === 0) return;
    const firstChapter = chapters[0];
    if (!firstChapter) return;
    // We need scenes for this chapter — redirect handled via redirect page
    router.replace(`/projects/${projectId}/redirect`);
  }, [chapters, isLoading, projectId, router]);

  if (!isLoading && chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-muted-foreground mb-2">No chapters yet.</p>
        <p className="text-sm text-muted-foreground">Use the sidebar to add a chapter and start writing.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

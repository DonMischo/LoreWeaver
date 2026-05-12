"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { chaptersApi, scenesApi } from "@/lib/api";

export default function RedirectToFirstScene() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    const go = async () => {
      try {
        const chapters = await chaptersApi.list(Number(id));
        if (!chapters.length) { router.replace(`/projects/${id}`); return; }
        const scenes = await scenesApi.list(chapters[0].id);
        if (!scenes.length) { router.replace(`/projects/${id}`); return; }
        router.replace(`/projects/${id}/scenes/${scenes[0].id}`);
      } catch {
        router.replace(`/projects/${id}`);
      }
    };
    go();
  }, [id, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

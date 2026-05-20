"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { useUIStore } from "@/store/ui";
import { useProject } from "@/store/queries";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const projectId = Number(id);
  const focusMode = useUIStore((s) => s.focusMode);
  const { data: project } = useProject(projectId);

  // Keep Electron's spellchecker in sync with the project language.
  useEffect(() => {
    const lang = project?.book_meta?.language;
    if (lang && typeof window !== "undefined" && (window as any).electron) {
      (window as any).electron.setSpellcheckLanguage(lang);
    }
  }, [project?.book_meta?.language]);

  return (
    <div className="flex h-screen overflow-hidden">
      {!focusMode && <ProjectSidebar projectId={projectId} />}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

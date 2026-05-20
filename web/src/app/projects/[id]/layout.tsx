"use client";

import { useParams } from "next/navigation";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { useUIStore } from "@/store/ui";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const projectId = Number(id);
  const focusMode = useUIStore((s) => s.focusMode);

  return (
    <div className="flex h-screen overflow-hidden">
      {!focusMode && <ProjectSidebar projectId={projectId} />}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

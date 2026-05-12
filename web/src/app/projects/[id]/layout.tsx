"use client";

import { useParams } from "next/navigation";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const projectId = Number(id);

  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar projectId={projectId} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

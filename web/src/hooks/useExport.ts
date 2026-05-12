import { projectsApi } from "@/lib/api";

export function useExport() {
  const exportProject = async (projectId: number, format: "md" | "tex", title: string) => {
    const res = await projectsApi.export(projectId, format);
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_\-]/g, "_")}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportProject };
}

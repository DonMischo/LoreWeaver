"use client";

import { useRef, useState } from "react";
import { Upload, FolderOpen, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { fragmentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  projectId: number;
}

type Status = "idle" | "loading" | "success" | "error";

export function FragmentImportButton({ projectId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef  = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const qc = useQueryClient();

  const run = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const accepted = Array.from(files).filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".txt")
    );

    if (accepted.length === 0) {
      setStatus("error");
      setMessage("No .md or .txt files found");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const result = await fragmentsApi.import(projectId, accepted);
      setStatus("success");
      setMessage(result.message + (result.skipped ? ` (${result.skipped} skipped)` : ""));
      qc.invalidateQueries({ queryKey: ["fragments", projectId] });
    } catch (err: any) {
      setStatus("error");
      let msg = err.message ?? "Import failed";
      try { msg = JSON.parse(msg).detail ?? msg; } catch {}
      setMessage(msg);
    } finally {
      // Reset file inputs
      if (fileRef.current) fileRef.current.value = "";
      if (dirRef.current)  dirRef.current.value  = "";
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 4000);
    }
  };

  const StatusIcon =
    status === "loading" ? Loader2 :
    status === "success" ? CheckCircle2 :
    status === "error"   ? AlertCircle :
    null;

  const iconClass =
    status === "loading" ? "animate-spin text-muted-foreground" :
    status === "success" ? "text-green-500" :
    status === "error"   ? "text-destructive" : "";

  if (status !== "idle") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1", iconClass)}>
        {StatusIcon && <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />}
        <span className="truncate max-w-[200px]">{message}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt"
        multiple
        className="hidden"
        onChange={(e) => run(e.target.files)}
      />
      {/* Directory input — webkitdirectory lets users pick a whole folder */}
      <input
        ref={dirRef}
        type="file"
        accept=".md,.txt"
        // @ts-ignore — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        className="hidden"
        onChange={(e) => run(e.target.files)}
      />

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        title="Import snippet file(s)"
      >
        <Upload className="h-3.5 w-3.5" />
        Import files
      </button>

      <button
        onClick={() => dirRef.current?.click()}
        className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        title="Import all snippets from a folder"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Import folder
      </button>
    </div>
  );
}

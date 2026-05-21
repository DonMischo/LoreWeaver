"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { importApi, type ImportResult } from "@/lib/api";

interface Props {
  projectId: number;
  mode: "story" | "codex";
  className?: string;
  buttonClassName?: string;
}

type Status = "idle" | "loading" | "success" | "error";

export function ImportButton({ projectId, mode, className, buttonClassName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const qc = useQueryClient();

  const label = mode === "story" ? "Import .md story" : "Import .md codex";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = "";          // reset so same file can be re-selected
    if (!file) return;

    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setStatus("error");
      setMessage("Please select a .md file");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const result: ImportResult =
        mode === "story"
          ? await importApi.story(projectId, file)
          : await importApi.codex(projectId, file);

      setStatus("success");
      setMessage(result.message);

      // Invalidate relevant caches
      if (mode === "story") {
        qc.invalidateQueries({ queryKey: ["acts", projectId] });
        qc.invalidateQueries({ queryKey: ["chapters"] });        // keyed by actId — invalidate all
        qc.invalidateQueries({ queryKey: ["scenes"] });          // keyed by chapterId — invalidate all
        qc.invalidateQueries({ queryKey: ["structure", projectId] });
        qc.invalidateQueries({ queryKey: ["corkboard", projectId] });
      } else {
        qc.invalidateQueries({ queryKey: ["codex", projectId] });
      }
    } catch (err: any) {
      setStatus("error");
      // Parse FastAPI detail string
      let msg = err.message ?? "Import failed";
      try { msg = JSON.parse(msg).detail ?? msg; } catch {}
      setMessage(msg);
    } finally {
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 4000);
    }
  };

  const Icon =
    status === "loading" ? Loader2 :
    status === "success" ? CheckCircle2 :
    status === "error"   ? AlertCircle :
    Upload;

  const iconClass =
    status === "loading" ? "animate-spin" :
    status === "success" ? "text-green-500" :
    status === "error"   ? "text-destructive" :
    "";

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "loading"}
        title={message || label}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 text-sm rounded w-full",
          "hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          status === "error" && "text-destructive",
          buttonClassName
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
        <span className="truncate">
          {message || label}
        </span>
      </button>
    </div>
  );
}

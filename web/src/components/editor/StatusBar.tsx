"use client";

import { CheckCircle2, AlertCircle, Loader2, Circle } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { formatWordCount } from "@/lib/utils";

interface Props {
  sceneWordCount: number;
}

const STATUS_CONFIG = {
  saved: { icon: CheckCircle2, label: "Saved", className: "text-green-500" },
  saving: { icon: Loader2, label: "Saving…", className: "text-yellow-500 animate-spin" },
  error: { icon: AlertCircle, label: "Unsaved changes", className: "text-red-500" },
  idle: { icon: Circle, label: "", className: "text-muted-foreground" },
};

export function StatusBar({ sceneWordCount }: Props) {
  const saveStatus = useUIStore((s) => s.saveStatus);
  const { icon: Icon, label, className } = STATUS_CONFIG[saveStatus];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-xs text-muted-foreground">
      <span>{formatWordCount(sceneWordCount)}</span>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${className}`} />
        {label && <span className={className}>{label}</span>}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/store/ui";
import { scenesApi } from "@/lib/api";

const DEBOUNCE_MS = 1000;
const INTERVAL_MS = 60_000;
const STORAGE_PREFIX = "lw_pending_";

interface Options {
  sceneId: number;
  content: string;
  enabled: boolean;
}

export function useAutosave({ sceneId, content, enabled }: Options) {
  const setSaveStatus = useUIStore((s) => s.setSaveStatus);
  const qc = useQueryClient();
  const pendingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const save = useCallback(async (value: string) => {
    if (!enabled) return;
    setSaveStatus("saving");
    pendingRef.current = true;
    try {
      await scenesApi.update(sceneId, { content: value });
      // Keep React Query cache in sync so remounts read fresh content
      qc.setQueryData(["scene", sceneId], (old: any) =>
        old ? { ...old, content: value } : old
      );
      localStorage.removeItem(`${STORAGE_PREFIX}${sceneId}`);
      setSaveStatus("saved");
    } catch {
      localStorage.setItem(`${STORAGE_PREFIX}${sceneId}`, value);
      setSaveStatus("error");
    } finally {
      pendingRef.current = false;
    }
  }, [sceneId, enabled, setSaveStatus, qc]);

  // Debounced save on content change
  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    debounceRef.current = setTimeout(() => save(contentRef.current), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [content, save, enabled, setSaveStatus]);

  // Interval save
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => save(contentRef.current), INTERVAL_MS);
    return () => clearInterval(interval);
  }, [save, enabled]);

  // Warn on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Sync any locally stored changes on mount
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${sceneId}`);
    if (stored) save(stored);
  }, [sceneId, save]);
}

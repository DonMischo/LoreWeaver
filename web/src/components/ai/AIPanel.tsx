"use client";

import { useState, useRef } from "react";
import { X, Sparkles, RotateCcw, Plus, MessageSquare, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Mode = "continue" | "rewrite" | "brainstorm" | "ask" | "custom";

const MODES: { id: Mode; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: "continue", label: "Continue", icon: Plus, placeholder: "Continue writing the scene..." },
  { id: "rewrite", label: "Rewrite", icon: RotateCcw, placeholder: "Rewrite and improve the selected text..." },
  { id: "brainstorm", label: "Brainstorm", icon: Sparkles, placeholder: "Generate ideas for where the story could go..." },
  { id: "ask", label: "Ask", icon: MessageSquare, placeholder: "Ask a question about the story..." },
  { id: "custom", label: "Custom", icon: Wand2, placeholder: "Write a custom instruction..." },
];

interface Props {
  sceneId: number;
  onInsert: (text: string) => void;
  onClose: () => void;
}

export function AIPanel({ sceneId, onInsert, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("continue");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (loading) {
      abortRef.current?.abort();
      return;
    }
    setResult("");
    setError("");
    setLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene_id: sceneId, mode, custom_prompt: customPrompt || undefined }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) setResult((prev) => prev + delta);
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const currentMode = MODES.find((m) => m.id === mode)!;
  const needsPrompt = mode === "ask" || mode === "custom";

  return (
    <div className="flex flex-col w-80 border-l border-border bg-card h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap px-3 py-2 border-b border-border">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-colors",
              mode === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
        {needsPrompt && (
          <Textarea
            className="text-sm resize-none"
            placeholder={currentMode.placeholder}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
          />
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</p>
        )}

        {result && (
          <div className="flex-1 overflow-y-auto text-sm bg-secondary/30 rounded p-3 leading-relaxed whitespace-pre-wrap">
            {result}
          </div>
        )}

        {!result && !error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <currentMode.icon className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">{currentMode.placeholder}</p>
          </div>
        )}

        {loading && !result && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        {result && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => { setResult(""); setError(""); }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => { onInsert(result); setResult(""); }}
            >
              Insert
            </Button>
          </div>
        )}
        <Button
          className="w-full"
          size="sm"
          onClick={generate}
          variant={loading ? "outline" : "default"}
        >
          {loading ? "Stop" : "Generate"}
        </Button>
      </div>
    </div>
  );
}

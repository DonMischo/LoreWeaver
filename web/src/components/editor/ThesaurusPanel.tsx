"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatasmuseWord { word: string; score: number }

type Tab = "synonyms" | "antonyms" | "related";

interface Props {
  selectedWord: string;
  onReplaceWord: (word: string) => void;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; param: string }[] = [
  { id: "synonyms", label: "Synonyms", param: "rel_syn" },
  { id: "antonyms", label: "Antonyms", param: "rel_ant" },
  { id: "related",  label: "Related",  param: "ml" },
];

async function fetchWords(param: string, word: string): Promise<string[]> {
  if (!word.trim()) return [];
  const url = `https://api.datamuse.com/words?${param}=${encodeURIComponent(word.trim())}&max=24`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: DatasmuseWord[] = await res.json();
  return data.map((d) => d.word);
}

export function ThesaurusPanel({ selectedWord, onReplaceWord, onClose }: Props) {
  const [query, setQuery]   = useState(selectedWord);
  const [tab, setTab]       = useState<Tab>("synonyms");
  const [results, setResults] = useState<Record<Tab, string[]>>({ synonyms: [], antonyms: [], related: [] });
  const [loading, setLoading] = useState(false);

  // Sync query when the editor selection changes
  useEffect(() => {
    if (selectedWord) setQuery(selectedWord);
  }, [selectedWord]);

  const search = useCallback(async (word: string) => {
    if (!word.trim()) { setResults({ synonyms: [], antonyms: [], related: [] }); return; }
    setLoading(true);
    try {
      const [synonyms, antonyms, related] = await Promise.all([
        fetchWords("rel_syn", word),
        fetchWords("rel_ant", word),
        fetchWords("ml", word),
      ]);
      setResults({ synonyms, antonyms, related });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search when query changes (debounced)
  useEffect(() => {
    const id = setTimeout(() => search(query), 350);
    return () => clearTimeout(id);
  }, [query, search]);

  const currentResults = results[tab];

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-foreground">Thesaurus</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a word…"
            className="w-full pl-6 pr-2 py-1.5 text-xs bg-secondary/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "text-[11px] px-2 py-1.5 border-b-2 transition-colors -mb-px",
              tab === t.id
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {results[t.id].length > 0 && (
              <span className="ml-1 text-[9px] text-muted-foreground">({results[t.id].length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Looking up…
          </div>
        ) : currentResults.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {query.trim() ? "No results found." : "Select a word in the editor or type above."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {currentResults.map((word) => (
              <button
                key={word}
                onClick={() => onReplaceWord(word)}
                className="text-xs px-2 py-1 rounded bg-secondary/60 hover:bg-primary/20 hover:text-primary border border-border hover:border-primary/40 transition-colors"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center pb-2">
        via Datamuse API
      </p>
    </div>
  );
}

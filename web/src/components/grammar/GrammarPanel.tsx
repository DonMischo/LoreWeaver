"use client";

import { useState } from "react";
import { X, SpellCheck, ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGrammarCheck } from "@/store/queries";
import type { GrammarMatch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  /** Plain text of the scene (HTML tags stripped) */
  text: string;
  language?: string;
  onClose: () => void;
}

const ISSUE_COLOR: Record<string, string> = {
  misspelling:       "text-red-500",
  grammar:           "text-amber-500",
  style:             "text-blue-500",
  typographical:     "text-purple-500",
  punctuation:       "text-orange-500",
};

function issueColor(type: string) {
  return ISSUE_COLOR[type] ?? "text-muted-foreground";
}

function MatchCard({ match }: { match: GrammarMatch }) {
  const [open, setOpen] = useState(false);
  const ctx = match.context;
  const before = ctx.text.slice(0, ctx.offset);
  const marked  = ctx.text.slice(ctx.offset, ctx.offset + ctx.length);
  const after  = ctx.text.slice(ctx.offset + ctx.length);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors"
      >
        <AlertCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", issueColor(match.rule.issueType))} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug">{match.shortMessage || match.message}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
            …{before}<span className={cn("underline decoration-dotted", issueColor(match.rule.issueType))}>{marked}</span>{after}…
          </p>
        </div>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border bg-secondary/20">
          <p className="text-[11px] text-muted-foreground pt-2">{match.message}</p>
          {match.replacements.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground self-center">Suggestions:</span>
              {match.replacements.slice(0, 5).map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigator.clipboard.writeText(r.value)}
                  title="Click to copy"
                  className="text-[11px] px-2 py-0.5 rounded border border-border bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors font-mono"
                >
                  {r.value}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/60">{match.rule.description} ({match.rule.id})</p>
        </div>
      )}
    </div>
  );
}

export function GrammarPanel({ text, language = "auto", onClose }: Props) {
  const check = useGrammarCheck();

  const handleCheck = () => {
    check.mutate({ text, language });
  };

  const matches = check.data?.matches ?? [];
  const hasRun = check.isSuccess || check.isError;

  return (
    <div className="w-72 flex flex-col border-l border-border bg-card overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <SpellCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-medium flex-1">Grammar Check</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <Button
          size="sm"
          onClick={handleCheck}
          disabled={check.isPending || !text.trim()}
          className="w-full gap-2"
        >
          {check.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</>
            : <><SpellCheck className="h-3.5 w-3.5" />{hasRun ? "Re-check" : "Check grammar"}</>
          }
        </Button>

        {check.isError && (
          <p className="text-xs text-destructive">
            {check.error instanceof Error ? check.error.message : "Grammar check failed. Is LanguageTool running?"}
          </p>
        )}

        {check.isSuccess && (
          matches.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-4">No issues found.</p>
            : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {matches.length} issue{matches.length !== 1 ? "s" : ""} found
                </p>
                {matches.map((m, i) => <MatchCard key={i} match={m} />)}
              </div>
            )
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { generateName, NAME_TYPE_LABELS, type NameType } from "@/lib/nameGenerator";

// ── Grouped options for the <select> ─────────────────────────────────────────

const GROUPS: Array<{ label: string; types: NameType[] }> = [
  {
    label: "Real-world cultures",
    types: ["german","nordic","russian","chinese","japanese","arabic","french","italian","spanish","celtic"],
  },
  {
    label: "Classic fantasy",
    types: ["elvish","dwarven","orcish","klingon","fantasy"],
  },
  {
    label: "Robots & mechs",
    types: ["droid","robot"],
  },
  {
    label: "Cyberpunk",
    types: ["cyberpunk_human","cyberpunk_tech"],
  },
  {
    label: "Steampunk",
    types: ["steampunk_human","steampunk_tech"],
  },
  {
    label: "Sci-Fi",
    types: ["scifi_human","scifi_tech"],
  },
  {
    label: "Cloudpunk / neon-noir",
    types: ["cloudpunk_human","cloudpunk_tech"],
  },
  {
    label: "Star Wars species",
    types: ["sw_twi_lek","sw_zabrak","sw_togruta","sw_chiss","sw_mandalorian"],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  nameType: NameType | "";
  onNameTypeChange: (t: NameType) => void;
  /** Called with the chosen name string so the parent can apply it to the name field. */
  onApply: (name: string) => void;
}

export function NameGeneratorWidget({ nameType, onNameTypeChange, onApply }: Props) {
  const [generated, setGenerated] = useState<{ first: string; last: string } | null>(null);

  const roll = () => {
    if (!nameType) return;
    setGenerated(generateName(nameType as NameType));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Grouped name style picker */}
      <select
        value={nameType}
        onChange={(e) => {
          onNameTypeChange(e.target.value as NameType);
          setGenerated(null);
        }}
        className="h-8 flex-1 min-w-[160px] text-xs rounded border border-border bg-background px-2 text-foreground"
      >
        <option value="">— Name Style —</option>
        {GROUPS.map(({ label, types }) => (
          <optgroup key={label} label={label}>
            {types.map((t) => (
              <option key={t} value={t}>{NAME_TYPE_LABELS[t]}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Roll button */}
      <button
        type="button"
        onClick={roll}
        disabled={!nameType}
        className="h-8 w-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 shrink-0"
        title="Roll a name"
      >
        <Dices className="h-4 w-4" />
      </button>

      {/* Generated name — click to apply whole name, or first/last separately */}
      {generated && (
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            title="Use full name"
            onClick={() => onApply(`${generated.first} ${generated.last}`)}
            className="text-primary hover:underline font-medium"
          >
            {generated.first} {generated.last}
          </button>
          <span className="text-muted-foreground/40 select-none">·</span>
          <button
            type="button"
            title="Use first name only"
            onClick={() => onApply(generated.first)}
            className="text-muted-foreground hover:text-foreground"
          >
            {generated.first}
          </button>
          <span className="text-muted-foreground/40 select-none">·</span>
          <button
            type="button"
            title="Use last name only"
            onClick={() => onApply(generated.last)}
            className="text-muted-foreground hover:text-foreground"
          >
            {generated.last}
          </button>
        </div>
      )}
    </div>
  );
}

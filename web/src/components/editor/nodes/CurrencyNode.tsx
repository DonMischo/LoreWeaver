"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Coins, X } from "lucide-react";
import { useState } from "react";
import { useEditorContext } from "@/contexts/EditorContext";
import { useCharacterCurrencies, useCurrencyBalance } from "@/store/queries";

// ── NodeView ──────────────────────────────────────────────────────────────────

export function CurrencyNodeView({ node, updateAttributes, deleteNode }: any) {
  const { characters, sceneId } = useEditorContext();
  const { charId, currencyName, delta } = node.attrs as {
    charId: number; currencyName: string; delta: number;
  };

  // Track whether user is typing a new currency name
  const [addingNew, setAddingNew] = useState(false);
  const [newNameDraft, setNewNameDraft] = useState("");

  const { data: existingCurrencies = [] } = useCharacterCurrencies(charId);
  const { data: balanceData } = useCurrencyBalance(
    sceneId, charId, currencyName
  );

  const balanceBefore = balanceData?.balance ?? null;

  // The input field shows the resulting absolute balance, not the raw delta.
  // When balanceBefore is known: displayed = balanceBefore + delta (so the field
  // always reads "what the character ends up with").
  // When unknown (no prior data): displayed = delta as-is.
  const displayValue = balanceBefore !== null ? balanceBefore + delta : delta;

  // Show dropdown when character is selected and there are known currencies
  const currencyInList = existingCurrencies.includes(currencyName);
  const showDropdown   = charId > 0 && (existingCurrencies.length > 0 || currencyInList) && !addingNew;

  const handleSelectCurrency = (val: string) => {
    if (val === "__new__") {
      setAddingNew(true);
      setNewNameDraft("");
    } else {
      updateAttributes({ currencyName: val });
    }
  };

  const commitNewName = () => {
    const name = newNameDraft.trim();
    if (name) updateAttributes({ currencyName: name });
    setAddingNew(false);
  };

  const isGain = delta >= 0;

  return (
    <NodeViewWrapper as="div">
      <div
        className="my-3 rounded-lg border-l-[3px] px-4 py-2.5"
        style={{ borderColor: "#22c55e", background: "rgba(34,197,94,0.08)" }}
        contentEditable={false}
      >
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <Coins className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#22c55e" }}>
            Currency
          </span>

          {/* Character */}
          <select
            value={charId}
            onChange={(e) => updateAttributes({ charId: Number(e.target.value) })}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-background text-sm rounded border border-border px-1.5 py-0.5 outline-none h-7"
          >
            <option value={0}>— character —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Currency name — dropdown or text input */}
          {showDropdown ? (
            <select
              value={currencyInList ? currencyName : "__new__"}
              onChange={(e) => handleSelectCurrency(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-background text-sm rounded border border-border px-1.5 py-0.5 outline-none h-7"
            >
              <option value="">— currency —</option>
              {existingCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ New currency…</option>
            </select>
          ) : (
            <input
              value={addingNew ? newNameDraft : currencyName}
              onChange={(e) => addingNew ? setNewNameDraft(e.target.value) : updateAttributes({ currencyName: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitNewName();
                if (e.key === "Escape") { setAddingNew(false); }
              }}
              onBlur={addingNew ? commitNewName : undefined}
              placeholder="currency name…"
              autoFocus={addingNew}
              className="bg-background text-sm rounded border border-border px-2 py-0.5 h-7 w-32 outline-none"
            />
          )}

          {/* Balance controls — input shows absolute resulting balance */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateAttributes({ delta: delta - 1 })}
              className="text-xs text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center border border-border rounded"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!isNaN(raw)) {
                  updateAttributes({ delta: raw - (balanceBefore ?? 0) });
                }
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-background text-sm text-center rounded border border-border w-16 h-7 outline-none"
            />
            <button
              type="button"
              onClick={() => updateAttributes({ delta: delta + 1 })}
              className="text-xs text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center border border-border rounded"
            >+</button>
          </div>

          {/* Signed delta badge */}
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              background: isGain ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
              color: isGain ? "#22c55e" : "#ef4444",
            }}
          >
            {isGain ? "+" : ""}{delta}
          </span>

          <div className="flex-1" />
          <button type="button" onClick={deleteNode} className="text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Previous balance hint */}
        {balanceBefore !== null && currencyName && (
          <div className="mt-1.5 text-xs text-muted-foreground">
            was <span className="font-mono">{balanceBefore}</span>
            <span className="opacity-50"> {currencyName}</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ── Node definition ───────────────────────────────────────────────────────────

export const CurrencyNode = Node.create({
  name: "currency",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      charId:       { default: 0,  parseHTML: (el) => Number(el.getAttribute("data-char-id") ?? 0) },
      currencyName: { default: "", parseHTML: (el) => el.getAttribute("data-currency-name") ?? "" },
      delta:        { default: 0,  parseHTML: (el) => Number(el.getAttribute("data-delta") ?? 0) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="currency"]', priority: 100 }];
  },

  renderHTML({ node }) {
    return ["div", {
      "data-type": "currency",
      "data-char-id": String(node.attrs.charId),
      "data-currency-name": node.attrs.currencyName,
      "data-delta": String(node.attrs.delta),
    }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CurrencyNodeView);
  },
});

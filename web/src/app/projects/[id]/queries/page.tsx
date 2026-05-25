"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Send, Clock, CheckCircle2, XCircle, MinusCircle, AlertCircle,
  Plus, Pencil, Trash2, Mail, BookOpen, Loader2, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useSubmissions, useCreateSubmission,
  useUpdateSubmission, useDeleteSubmission,
} from "@/store/queries";
import type { QuerySubmission, SubmissionStatus } from "@/types";
import type { QuerySubmissionCreate } from "@/lib/api";

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META: Record<SubmissionStatus, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  queried:           { label: "Queried",          color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",        Icon: Send },
  partial_requested: { label: "Partial Requested", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",     Icon: BookOpen },
  full_requested:    { label: "Full Requested",    color: "bg-violet-500/15 text-violet-600 dark:text-violet-400",  Icon: BookOpen },
  offer:             { label: "Offer",             color: "bg-green-500/15 text-green-600 dark:text-green-400",     Icon: CheckCircle2 },
  pass:              { label: "Pass",              color: "bg-rose-500/15 text-rose-500 dark:text-rose-400",        Icon: XCircle },
  no_response:       { label: "No Response",       color: "bg-muted text-muted-foreground",                         Icon: MinusCircle },
  withdrawn:         { label: "Withdrawn",         color: "bg-muted text-muted-foreground",                         Icon: MinusCircle },
};

const ALL_STATUSES = Object.keys(STATUS_META) as SubmissionStatus[];

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", m.color)}>
      <m.Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

// ── Days-until helper ─────────────────────────────────────────────────────────

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-muted-foreground">—</span>;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  const color = days < 0
    ? "text-rose-500"
    : days <= 7
      ? "text-amber-500"
      : "text-muted-foreground";
  return (
    <span className={cn("text-xs", color)}>
      {deadline}
      {days >= 0
        ? <span className="ml-1 opacity-70">({days}d)</span>
        : <span className="ml-1 font-semibold">(overdue)</span>}
    </span>
  );
}

// ── Empty submission form values ──────────────────────────────────────────────

const EMPTY: QuerySubmissionCreate = {
  agent_name: "",
  agency: "",
  email: "",
  submission_type: "query",
  date_sent: "",
  response_deadline: "",
  status: "queried",
  notes: "",
};

// ── Dialog ────────────────────────────────────────────────────────────────────

interface DialogProps {
  initial?: QuerySubmission | null;
  onSave: (data: QuerySubmissionCreate) => Promise<void>;
  onClose: () => void;
}

function SubmissionDialog({ initial, onSave, onClose }: DialogProps) {
  const [form, setForm] = useState<QuerySubmissionCreate>(initial
    ? {
        agent_name:        initial.agent_name,
        agency:            initial.agency ?? "",
        email:             initial.email ?? "",
        submission_type:   initial.submission_type,
        date_sent:         initial.date_sent ?? "",
        response_deadline: initial.response_deadline ?? "",
        status:            initial.status,
        notes:             initial.notes ?? "",
      }
    : EMPTY);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof QuerySubmissionCreate>(k: K, v: QuerySubmissionCreate[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.agent_name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        agency:            form.agency?.trim() || null,
        email:             form.email?.trim() || null,
        date_sent:         form.date_sent?.trim() || null,
        response_deadline: form.response_deadline?.trim() || null,
        notes:             form.notes?.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{initial ? "Edit Submission" : "Add Submission"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg px-1">×</button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[70vh]">
          {/* Agent */}
          <div>
            <Label className="text-xs">Agent name <span className="text-destructive">*</span></Label>
            <Input value={form.agent_name} onChange={e => set("agent_name", e.target.value)}
              placeholder="Jane Smith" className="mt-1 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Agency</Label>
              <Input value={form.agency ?? ""} onChange={e => set("agency", e.target.value)}
                placeholder="Literary Agency" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)}
                placeholder="agent@agency.com" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Submission type</Label>
              <select
                value={form.submission_type}
                onChange={e => set("submission_type", e.target.value)}
                className="mt-1 w-full h-8 text-sm rounded-md border border-input bg-background px-2"
              >
                <option value="query">Query letter</option>
                <option value="partial">Partial (chapters)</option>
                <option value="full">Full manuscript</option>
                <option value="unsolicited">Unsolicited full</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value as SubmissionStatus)}
                className="mt-1 w-full h-8 text-sm rounded-md border border-input bg-background px-2"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date sent</Label>
              <Input type="date" value={form.date_sent ?? ""} onChange={e => set("date_sent", e.target.value)}
                className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Response deadline</Label>
              <Input type="date" value={form.response_deadline ?? ""} onChange={e => set("response_deadline", e.target.value)}
                className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <textarea
              value={form.notes ?? ""}
              onChange={e => set("notes", e.target.value)}
              placeholder="Personalization notes, requested materials, any relevant details…"
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.agent_name.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {initial ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ items }: { items: QuerySubmission[] }) {
  const total   = items.length;
  const waiting = items.filter(i => i.status === "queried" || i.status === "partial_requested" || i.status === "full_requested").length;
  const passes  = items.filter(i => i.status === "pass").length;
  const offers  = items.filter(i => i.status === "offer").length;
  const requests = items.filter(i => i.status === "partial_requested" || i.status === "full_requested").length;

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total",    value: total,    color: "text-foreground" },
        { label: "Waiting",  value: waiting,  color: "text-amber-500" },
        { label: "Requests", value: requests, color: "text-violet-500" },
        { label: "Offers",   value: offers,   color: offers > 0 ? "text-green-500" : "text-muted-foreground" },
      ].map(s => (
        <div key={s.label} className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-center">
          <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = "date_sent" | "agent_name" | "status" | "response_deadline";

export default function QueriesPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { data: items = [], isLoading } = useSubmissions(projectId);
  const create = useCreateSubmission(projectId);
  const update = useUpdateSubmission(projectId);
  const remove = useDeleteSubmission(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuerySubmission | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date_sent");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "all">("all");

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(false); }
  };

  const filtered = items.filter(i => filterStatus === "all" || i.status === filterStatus);
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "agent_name") cmp = a.agent_name.localeCompare(b.agent_name);
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    else if (sortKey === "date_sent") cmp = (a.date_sent ?? "").localeCompare(b.date_sent ?? "");
    else if (sortKey === "response_deadline") cmp = (a.response_deadline ?? "").localeCompare(b.response_deadline ?? "");
    return sortAsc ? cmp : -cmp;
  });

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item: QuerySubmission) => { setEditing(item); setDialogOpen(true); };

  const handleSave = async (data: QuerySubmissionCreate) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, data });
    } else {
      await create.mutateAsync(data);
    }
  };

  const handleDelete = async (item: QuerySubmission) => {
    if (!confirm(`Delete submission to ${item.agent_name}?`)) return;
    await remove.mutateAsync(item.id);
  };

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3 shrink-0", sortKey === col ? "opacity-100" : "opacity-30")} />
      </span>
    </th>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Query Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track agent queries, partial and full manuscript requests.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Add submission
        </Button>
      </div>

      {/* Stats */}
      {items.length > 0 && <StatsStrip items={items} />}

      {/* Status filter */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(["all", ...ALL_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filterStatus === s
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {s === "all" ? "All" : STATUS_META[s].label}
              {s !== "all" && (
                <span className="ml-1 opacity-60">
                  ({items.filter(i => i.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground rounded-xl border border-dashed border-border">
          <Send className="h-8 w-8 mb-3 opacity-30" />
          <p className="text-sm font-medium">No submissions yet</p>
          <p className="text-xs mt-1">Log your first query letter to get started.</p>
          <Button size="sm" variant="outline" onClick={openNew} className="mt-4 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add submission
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <SortTh col="agent_name" label="Agent" />
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agency</th>
                <SortTh col="status" label="Status" />
                <SortTh col="date_sent" label="Date sent" />
                <SortTh col="response_deadline" label="Deadline" />
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border/50 last:border-b-0 hover:bg-secondary/20 transition-colors cursor-pointer",
                    i % 2 === 0 ? "" : "bg-secondary/5"
                  )}
                  onClick={() => openEdit(item)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{item.agent_name}</div>
                    {item.email && (
                      <a
                        href={`mailto:${item.email}`}
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        <Mail className="h-3 w-3" />
                        {item.email}
                      </a>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1 max-w-xs">{item.notes}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.agency ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={item.status} />
                    {item.submission_type !== "query" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.submission_type}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {item.date_sent ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <DeadlineBadge deadline={item.response_deadline} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <SubmissionDialog
          initial={editing}
          onSave={handleSave}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

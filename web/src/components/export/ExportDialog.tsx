"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText, FileCode2, BookOpen,
  FolderOpen, Upload, Check, Loader2, ChevronDown, ChevronRight, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { projectsApi } from "@/lib/api";
import type { ExportOptions, ExportAct } from "@/lib/api";
import type { BookMeta } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const SERIF_FONTS = [
  "EB Garamond", "Linux Libertine O", "Palatino Linotype",
  "TeX Gyre Pagella", "Crimson Pro", "Cormorant Garamond",
  "GFS Artemisia", "Junicode",
];
const SANS_FONTS = [
  "Fira Sans", "Source Sans Pro", "Lato", "Open Sans",
  "Linux Biolinum O", "Cabin",
];

const DEFAULT_OPTS: ExportOptions = {
  format: "md",
  scene_ids: null,
  include_act_headings: true,
  include_chapter_headings: true,
  include_scene_headings: true,
  font: "",
  font_size: "12pt",
  line_spacing: "1.5",
  paper_size: "a4paper",
  text_color: "#1a1a1a",
  bg_color: "#ffffff",
  page_margin: "2em",
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden text-xs">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("flex-1 px-3 py-1.5 transition-colors",
            value === o.value ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary text-muted-foreground"
          )}
        >{o.label}</button>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-2 first:mt-0">{children}</p>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-0.5">
      <span className="text-sm">{label}</span>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-input")}
      >
        <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
          checked ? "translate-x-4" : "translate-x-0")} />
      </button>
    </label>
  );
}

// ── Tri-state checkbox ────────────────────────────────────────────────────────

type CheckState = "all" | "none" | "partial";

function TriCheckbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === "partial";
      ref.current.checked = state === "all";
    }
  }, [state]);
  return (
    <input ref={ref} type="checkbox" onChange={onChange}
      className="h-3.5 w-3.5 rounded shrink-0 cursor-pointer accent-primary" />
  );
}

// ── 3-level content tree ──────────────────────────────────────────────────────

function ContentTree({
  acts,
  selected,
  onToggleAll,
  onToggleAct,
  onToggleChapter,
  onToggleScene,
}: {
  acts: ExportAct[];
  selected: Set<number>;
  onToggleAll: () => void;
  onToggleAct: (sceneIds: number[]) => void;
  onToggleChapter: (sceneIds: number[]) => void;
  onToggleScene: (id: number) => void;
}) {
  const allSceneIds = acts.flatMap(a => a.chapters.flatMap(c => c.scenes.map(s => s.id)));
  const totalSelected = allSceneIds.filter(id => selected.has(id)).length;
  const globalState: CheckState = totalSelected === 0 ? "none" : totalSelected === allSceneIds.length ? "all" : "partial";

  const [expandedActs, setExpandedActs] = useState<Set<number>>(new Set(acts.map(a => a.id)));
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(
    new Set(acts.flatMap(a => a.chapters.map(c => c.id)))
  );

  const toggleExpandAct = (id: number) =>
    setExpandedActs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpandChapter = (id: number) =>
    setExpandedChapters(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="border border-border rounded-md overflow-hidden text-sm select-none">
      {/* Global select-all row */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary/40 border-b border-border">
        <div className="w-3.5 shrink-0" />
        <TriCheckbox state={globalState} onChange={onToggleAll} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          All content ({totalSelected}/{allSceneIds.length} scenes)
        </span>
      </div>

      {acts.map(act => {
        const actSceneIds = act.chapters.flatMap(c => c.scenes.map(s => s.id));
        const actSel = actSceneIds.filter(id => selected.has(id)).length;
        const actState: CheckState = actSel === 0 ? "none" : actSel === actSceneIds.length ? "all" : "partial";
        const actOpen = expandedActs.has(act.id);

        return (
          <div key={act.id} className="border-b border-border last:border-b-0">
            {/* Act row */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary/20 hover:bg-secondary/30 transition-colors">
              <button onClick={() => toggleExpandAct(act.id)} className="shrink-0">
                {actOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <TriCheckbox state={actState} onChange={() => onToggleAct(actSceneIds)} />
              <span className="font-medium truncate">{act.title}</span>
              {actState === "partial" && (
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{actSel}/{actSceneIds.length}</span>
              )}
            </div>

            {actOpen && act.chapters.map(chapter => {
              const chapSceneIds = chapter.scenes.map(s => s.id);
              const chapSel = chapSceneIds.filter(id => selected.has(id)).length;
              const chapState: CheckState = chapSel === 0 ? "none" : chapSel === chapSceneIds.length ? "all" : "partial";
              const chapOpen = expandedChapters.has(chapter.id);

              return (
                <div key={chapter.id} className="border-t border-border/50">
                  {/* Chapter row */}
                  <div className="flex items-center gap-2 pl-6 pr-2 py-1 hover:bg-secondary/20 transition-colors">
                    <button onClick={() => toggleExpandChapter(chapter.id)} className="shrink-0">
                      {chapOpen
                        ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <TriCheckbox state={chapState} onChange={() => onToggleChapter(chapSceneIds)} />
                    <span className="text-xs truncate text-foreground/80">{chapter.title}</span>
                    {chapState === "partial" && (
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{chapSel}/{chapSceneIds.length}</span>
                    )}
                  </div>

                  {chapOpen && chapter.scenes.map(scene => {
                    const sceneSel = selected.has(scene.id);
                    return (
                      <div key={scene.id}
                        className="flex items-center gap-2 pl-12 pr-2 py-0.5 hover:bg-secondary/10 transition-colors cursor-pointer"
                        onClick={() => onToggleScene(scene.id)}
                      >
                        <input type="checkbox" checked={sceneSel} onChange={() => onToggleScene(scene.id)}
                          className="h-3 w-3 rounded shrink-0 accent-primary cursor-pointer" />
                        <span className="text-[11px] truncate text-muted-foreground">{scene.title}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  projectTitle: string;
  bookMeta?: BookMeta | null;
  open: boolean;
  onClose: () => void;
}

const hasFolderPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

export function ExportDialog({ projectId, projectTitle, bookMeta, open, onClose }: Props) {
  const [opts, setOpts] = useState<ExportOptions>({ ...DEFAULT_OPTS });
  const [acts, setActs] = useState<ExportAct[]>([]);
  const [allContent, setAllContent] = useState(true);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<number>>(new Set());
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("idle"); setStatusMsg("");
    projectsApi.exportStructure(projectId).then(s => {
      setActs(s.acts);
      const allIds = new Set(s.acts.flatMap(a => a.chapters.flatMap(c => c.scenes.map(sc => sc.id))));
      setSelectedSceneIds(allIds);
    });
  }, [open, projectId]);

  if (!open) return null;

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  // Tree toggle helpers
  const toggleAll = () => {
    const allIds = acts.flatMap(a => a.chapters.flatMap(c => c.scenes.map(s => s.id)));
    const allSelected = allIds.every(id => selectedSceneIds.has(id));
    setSelectedSceneIds(allSelected ? new Set() : new Set(allIds));
  };
  const toggleGroup = (ids: number[]) => {
    const allSelected = ids.every(id => selectedSceneIds.has(id));
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };
  const toggleScene = (id: number) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
    } catch { /* cancelled */ }
  };

  const triggerDownload = (text: string, filename: string, mimeType: string) => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setStatus("busy"); setStatusMsg("");

    const payload: ExportOptions = {
      ...opts,
      scene_ids: allContent ? null : Array.from(selectedSceneIds),
      font: opts.font || undefined,
    };

    try {
      const res = await projectsApi.export(projectId, payload);
      if (!res.ok) throw new Error(await res.text());

      const ext = opts.format === "md" ? "md" : opts.format === "tex" ? "tex" : "css";
      const suffix = opts.format === "epub-style" ? "-style" : "";
      const safeName = projectTitle.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const filename = `${safeName}${suffix}.${ext}`;
      const mimeType = opts.format === "md" ? "text/markdown" : opts.format === "tex" ? "application/x-tex" : "text/css";

      const text = await res.text();

      if (dirHandle) {
        // Write to chosen folder
        const fh = await dirHandle.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(text); await w.close();

        if (opts.format === "epub-style" && coverFile) {
          const coverExt = coverFile.name.split(".").pop() ?? "jpg";
          const ch = await dirHandle.getFileHandle(`cover.${coverExt}`, { create: true });
          const cw = await ch.createWritable();
          await cw.write(await coverFile.arrayBuffer()); await cw.close();
        }

        setStatus("done");
        setStatusMsg(`Saved to "${dirHandle.name}/" — ${filename}${opts.format === "epub-style" && coverFile ? " + cover" : ""}`);
      } else {
        // Fallback: browser download
        triggerDownload(text, filename, mimeType);
        if (opts.format === "epub-style" && coverFile) {
          // Also download cover with original name
          const coverUrl = URL.createObjectURL(coverFile);
          const a = document.createElement("a");
          a.href = coverUrl; a.download = coverFile.name; a.click();
          URL.revokeObjectURL(coverUrl);
        }
        setStatus("done");
        setStatusMsg(`Downloaded ${filename}`);
      }
    } catch (e: any) {
      setStatus("error");
      setStatusMsg(e.message ?? "Export failed");
    }
  };

  const fmtLabel = opts.format === "md" ? "Markdown" : opts.format === "tex" ? "LaTeX" : "EPUB Style";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Export</h2>
            <p className="text-xs text-muted-foreground">{projectTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none px-1">×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Format */}
          <SectionHeading>Format</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            {(["md", "tex", "epub-style"] as const).map(fmt => {
              const Icon = fmt === "md" ? FileText : fmt === "tex" ? FileCode2 : BookOpen;
              const label = fmt === "md" ? "Markdown" : fmt === "tex" ? "LaTeX" : "EPUB Style";
              const sub   = fmt === "md" ? ".md file"  : fmt === "tex" ? "LuaLaTeX / fontspec" : "CSS + cover";
              return (
                <button key={fmt} onClick={() => set("format", fmt)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs transition-colors",
                    opts.format === fmt
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                  <span className="text-[10px] opacity-70">{sub}</span>
                </button>
              );
            })}
          </div>

          {/* Content selection */}
          <SectionHeading>Content</SectionHeading>
          <div className="mb-2">
            <ToggleGroup
              value={allContent ? "all" : "custom"}
              onChange={v => setAllContent(v === "all")}
              options={[{ value: "all", label: "All content" }, { value: "custom", label: "Select scenes" }]}
            />
          </div>

          {!allContent && acts.length > 0 && (
            <ContentTree
              acts={acts}
              selected={selectedSceneIds}
              onToggleAll={toggleAll}
              onToggleAct={toggleGroup}
              onToggleChapter={toggleGroup}
              onToggleScene={toggleScene}
            />
          )}

          <div className="mt-3 space-y-1">
            <ToggleRow label="Include act headings"     checked={opts.include_act_headings}     onChange={v => set("include_act_headings", v)} />
            <ToggleRow label="Include chapter headings" checked={opts.include_chapter_headings} onChange={v => set("include_chapter_headings", v)} />
            <ToggleRow label="Include scene headings"   checked={opts.include_scene_headings}   onChange={v => set("include_scene_headings", v)} />
          </div>

          {/* Metadata summary — set via Project Info in the sidebar */}
          <SectionHeading>Metadata</SectionHeading>
          <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs space-y-0.5">
            {bookMeta?.author || bookMeta?.publisher || bookMeta?.published_date || bookMeta?.language ? (
              <>
                {bookMeta.author      && <p><span className="text-muted-foreground w-20 inline-block">Author</span>{bookMeta.author}</p>}
                {bookMeta.subtitle    && <p><span className="text-muted-foreground w-20 inline-block">Subtitle</span>{bookMeta.subtitle}</p>}
                {bookMeta.language    && <p><span className="text-muted-foreground w-20 inline-block">Language</span>{bookMeta.language}</p>}
                {bookMeta.publisher   && <p><span className="text-muted-foreground w-20 inline-block">Publisher</span>{bookMeta.publisher}</p>}
                {bookMeta.published_date && <p><span className="text-muted-foreground w-20 inline-block">Date</span>{bookMeta.published_date}</p>}
                {bookMeta.series      && <p><span className="text-muted-foreground w-20 inline-block">Series</span>{bookMeta.series}{bookMeta.series_index ? ` #${bookMeta.series_index}` : ""}</p>}
              </>
            ) : (
              <p className="text-muted-foreground italic">No metadata set — use <strong className="font-medium not-italic">Project Info</strong> in the sidebar to add author, language, publisher, etc.</p>
            )}
          </div>

          {/* Typography (LaTeX + EPUB) */}
          {opts.format !== "md" && (
            <>
              <SectionHeading>Typography</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Main font</Label>
                  <Input value={opts.font ?? ""} onChange={e => set("font", e.target.value)}
                    placeholder="e.g. EB Garamond, Palatino Linotype"
                    className="h-8 text-sm mt-1" list="lw-font-suggestions" />
                  <datalist id="lw-font-suggestions">
                    {[...SERIF_FONTS, ...SANS_FONTS].map(f => <option key={f} value={f} />)}
                  </datalist>
                  <p className="text-[10px] text-muted-foreground mt-1">Font must be installed on the compilation machine</p>
                </div>
                <div>
                  <Label className="text-xs">Font size</Label>
                  <ToggleGroup value={opts.font_size} onChange={v => set("font_size", v)}
                    options={[{ value: "10pt", label: "10pt" }, { value: "11pt", label: "11pt" }, { value: "12pt", label: "12pt" }]} />
                </div>
                <div>
                  <Label className="text-xs">Line spacing</Label>
                  <ToggleGroup value={opts.line_spacing} onChange={v => set("line_spacing", v)}
                    options={[{ value: "1", label: "Single" }, { value: "1.5", label: "1.5×" }, { value: "2", label: "Double" }]} />
                </div>
              </div>
            </>
          )}

          {/* LaTeX-specific */}
          {opts.format === "tex" && (
            <>
              <SectionHeading>LaTeX Settings</SectionHeading>
              <div>
                <Label className="text-xs">Paper size</Label>
                <ToggleGroup value={opts.paper_size} onChange={v => set("paper_size", v)}
                  options={[{ value: "a4paper", label: "A4" }, { value: "letterpaper", label: "Letter" }]} />
              </div>
            </>
          )}

          {/* EPUB-specific */}
          {opts.format === "epub-style" && (
            <>
              <SectionHeading>EPUB Style</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Text colour</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={opts.text_color} onChange={e => set("text_color", e.target.value)}
                      className="h-8 w-10 rounded cursor-pointer border border-border bg-transparent p-0.5" />
                    <Input value={opts.text_color} onChange={e => set("text_color", e.target.value)} className="h-8 text-sm flex-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Background colour</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={opts.bg_color} onChange={e => set("bg_color", e.target.value)}
                      className="h-8 w-10 rounded cursor-pointer border border-border bg-transparent p-0.5" />
                    <Input value={opts.bg_color} onChange={e => set("bg_color", e.target.value)} className="h-8 text-sm flex-1" />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Page margin</Label>
                  <Input value={opts.page_margin} onChange={e => set("page_margin", e.target.value)}
                    placeholder="e.g. 2em or 1.5cm" className="h-8 text-sm mt-1" />
                </div>
              </div>

              <SectionHeading>Cover Image</SectionHeading>
              <input ref={coverRef} type="file" accept="image/*" className="hidden"
                onChange={e => setCoverFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => coverRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors w-full"
              >
                <Upload className="h-4 w-4 shrink-0" />
                {coverFile ? coverFile.name : "Upload cover image (optional)"}
              </button>
              {coverFile && (
                <button onClick={() => setCoverFile(null)} className="text-xs text-muted-foreground hover:text-destructive mt-1 block">
                  Remove cover
                </button>
              )}
            </>
          )}

          {/* Output */}
          <SectionHeading>Output</SectionHeading>
          {hasFolderPicker ? (
            <button onClick={pickFolder}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors w-full",
                dirHandle
                  ? "border-primary/50 text-foreground bg-primary/5"
                  : "border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground"
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              {dirHandle ? (
                <span className="truncate">
                  <span className="font-medium">{dirHandle.name}/</span>
                  <span className="text-muted-foreground text-xs ml-1">— click to change</span>
                </span>
              ) : (
                <span>
                  Choose output folder
                  <span className="text-muted-foreground/70 ml-1">(or export will download to browser default)</span>
                </span>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border text-muted-foreground">
              <Download className="h-4 w-4 shrink-0" />
              File will be downloaded to your browser&apos;s default download folder
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <div className="flex-1 text-xs min-w-0">
            {status === "done"  && <span className="text-green-500 flex items-center gap-1 truncate"><Check className="h-3.5 w-3.5 shrink-0" />{statusMsg}</span>}
            {status === "error" && <span className="text-destructive truncate">{statusMsg}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleExport} disabled={status === "busy"} className="gap-1.5 shrink-0">
            {status === "busy"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : dirHandle ? <FolderOpen className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            Export {fmtLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

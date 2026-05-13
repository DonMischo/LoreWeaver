# LoreWeaver Personal Writer Studio

A local-first novel writing studio — write, world-build, and track your story's timeline and relationships, all running on your own machine. No subscriptions, no cloud sync.

## Quick Start

Open two PowerShell terminals from the `loreweaver/` directory:

**Terminal 1 — Backend (Python/FastAPI):**
```powershell
.\start-backend.ps1
```

**Terminal 2 — Frontend (Next.js):**
```powershell
.\start-frontend.ps1
```

Then open **http://localhost:3000** in your browser.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | TipTap with Codex highlight extension |
| State | Zustand + TanStack Query v5 |
| Backend | FastAPI, SQLAlchemy 2.0, SQLite (WAL mode) |
| AI | OpenRouter (any model, proxied via backend) WIP |
| Export | Markdown + LaTeX (Jinja2 templates) |

---

## Features

### ✍️ Story Editor
- 4-level hierarchy: **Project → Act → Chapter → Scene**
- Drag-and-drop reordering at every level (acts, chapters, scenes)
- Insert a scene between existing scenes using the **+** divider that appears on hover
- Double-click an act or chapter title in the sidebar to rename it inline
- Scene titles auto-generated from content if left blank
- Debounced **autosave** (1 s) + periodic interval save; localStorage fallback when the backend is unreachable
- Word count in the status bar; per-scene counts persist to the database
- **Export** to `.md` (Markdown) or `.tex` (LaTeX) — LaTeX output uses `\chapter` / `\section` structure with proper special-character escaping
- **Import** a Markdown story file (splits on `##` / `###` / `####` headings into acts / chapters / scenes)
- Read view per chapter and per act — flowing prose layout with story typography (indent, justify, no-indent after headings)

### 📚 Codex (World-building Database)
- Entry types: **Character**, **Location**, **Item**, **Lore**, **Custom**
- Fields: name, aliases, description, notes, colour tag, group, species (characters) / subtype (others), tags
- Inline **Codex highlighting** in the editor — any word matching a Codex entry name or alias gets a coloured underline; click it to open the entry in the sidebar
- **List view** (default) — sortable table with columns for type/subtype, group, tags, description; click column headers to sort ↑↓
- **Grid view** — colour-coded cards with sort pill-bar
- **Filters**: entry type, group, species, subtype, tags — each a multi-select dropdown with checkboxes; combine freely
- **Multi-select**: check entries (or click while another is selected) to enter selection mode; floating action bar lets you bulk-edit type, subtype/species, add shared tags, add shared relations, or delete
- Click any entry name or card to open the full edit dialog
- **Relations**: link any two entries with a typed relation (Friend, Enemy, Ally, Rival, Family, Mentor, Student, Possession, Home, Origin, Member Of, Leads, or a custom label); direction-aware — shows "→ target" and "← source" in the detail view
- **Import Codex** from CSV/JSON

### 🕸️ Relations Graph
- SVG radial mindmap — one entry at the centre, linked entries on the outer ring
- Click any outer node to re-centre the graph on that entry
- Colour-coded by entry type; relation type shown on the connecting line

### 🕐 Time System
- Per-project **configurable time units** — choose any combination of Age, Year, Season, Month, Day, Hour, Minute, Second; rename them to fit your world (e.g. "Cycle" instead of "Year")
- Set **count-per-parent** for each unit (e.g. 13 months per year, 28 days per month)
- Define **custom value names** for any unit with ≤ 60 values (e.g. month names, season names)
- **Day/Night cycle dial** — set how many hours a day has, when night starts, and how long it lasts; a purple arc on the SVG clock shows nighttime visually
- Accessible from the sidebar **Time System** button or from within any scene
- Per-scene **Time** panel (clock button in the scene toolbar):
  - Inputs for each enabled unit; named-value units show a dropdown (e.g. pick "Spring" instead of typing 1)
  - Live preview badge shows formatted time + ☀ Day / 🌙 Night label
  - "Configure time system…" link to jump straight to the config dialog
  - Apply saves immediately; Clear removes the scene's time stamp
- A small **🕐 icon** appears next to scene titles in the sidebar when they have a time set

### 📅 Timeline
- Horizontal grid — each **row** is a scene, each **column** is a distinct point in time
- Column headers show the formatted time label and a ☀/🌙 Day/Night badge
- Click any cell to navigate directly to that scene
- Hover to see the full Act → Chapter → Scene breadcrumb
- Empty-state prompt with a direct link to configure the time system
- **Time config** button in the header to adjust the time system without leaving the page

### 🤖 AI Assistant
- Sidebar panel in the scene editor (Sparkles button)
- Actions: **Continue**, **Rewrite**, **Brainstorm**, **Ask**, **Custom**
- Streams output from any [OpenRouter](https://openrouter.ai) model
- Insert generated text directly into the editor at the cursor

---

## Settings

Open `/settings` or click **Settings** in the sidebar to:

- Add your [OpenRouter API key](https://openrouter.ai/keys) — stored server-side, never sent to the browser
- Choose your default AI model
- Switch between **dark** and **light** theme

---

## Tips & Hints

| Tip | How |
|-----|-----|
| Rename an act or chapter | Double-click its title in the sidebar |
| Insert a scene between two scenes | Hover the divider line between them → click **+** |
| Reorder anything | Grab the ⠿ drag handle that appears on hover |
| Open a Codex entry from the editor | Click the coloured underline under any highlighted word |
| Jump to a scene from the Timeline | Click its diamond marker |
| Clear a scene's time stamp | Time panel → **Clear** button |
| Bulk-edit Codex entries | Check multiple entries → use the floating action bar |
| Add custom month/season names | Time System → unit row → **Custom names** |
| Export the whole project | Sidebar → **Export .md** or **.tex** |
| Import a Markdown draft | Sidebar → **Import** — headings `##` / `###` / `####` map to acts / chapters / scenes |

---

## Project Structure

```
loreweaver/
├── api/                  # FastAPI backend
│   ├── routers/          # projects, acts, chapters, scenes, codex, time, graph, ai, export, imports
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── database.py       # Engine, session, migration helpers
│   └── services/         # Tag parsing, AI streaming, export templates
└── web/                  # Next.js 14 frontend
    └── src/
        ├── app/          # App Router pages (projects, codex, timeline, settings…)
        ├── components/   # Editor, Codex, AI panel, Time panel, layout
        ├── store/        # Zustand UI store + TanStack Query hooks
        ├── hooks/        # useAutosave, useExport
        └── types/        # Shared TypeScript interfaces
```

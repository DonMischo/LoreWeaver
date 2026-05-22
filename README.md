# Foliantica Personal Novel Writer Studio

A local-first novel writing studio — write, world-build, and track your story's timeline and relationships, all running on your own machine. No subscriptions, no cloud required.

Available as a **standalone desktop app** (Windows, macOS, Linux) or run directly from source.

---

## Desktop App (recommended)

Download the latest installer from [Releases](../../releases) and run it. Foliantica starts as a self-contained app — no Node.js or Python required.

**Cloud sync:** point Foliantica at a folder inside your Dropbox, Google Drive, or OneDrive and it syncs automatically across devices. *(Settings → Data folder — coming soon as a UI option; advanced users can set `dataDir` in `config.json` manually.)*

---

## Development / Run from Source

Open two PowerShell terminals from the `foliantica/` directory:

**Terminal 1 — Backend (Python/FastAPI):**
```powershell
.\start-backend.ps1
```

**Terminal 2 — Frontend (Next.js):**
```powershell
.\start-frontend.ps1
```

Then open **http://localhost:3000** in your browser.

### Build the desktop app locally

```powershell
# Windows
.\build.ps1
```
```bash
# macOS / Linux
./build.sh
```

Requires Node.js 20+, Python 3.11+, and [uv](https://github.com/astral-sh/uv). Produces an installer in `dist/`.

---

## Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 36, electron-builder |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | TipTap with Codex highlight extension |
| State | Zustand + TanStack Query v5 |
| Backend | FastAPI, SQLAlchemy 2.0, SQLite (WAL mode) |
| AI | OpenRouter (any model, proxied via backend) |
| Export | Markdown, LaTeX, EPUB-style HTML (Jinja2 templates) |

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
- **Export** to `.md` (Markdown), `.tex` (LaTeX), or EPUB-style HTML — LaTeX output uses `\chapter` / `\section` structure with proper special-character escaping
- **Import** a Markdown story file (splits on `##` / `###` / `####` headings into acts / chapters / scenes) — always imports into the current project
- Read view per chapter and per act — flowing prose layout with story typography (indent, justify, no-indent after headings)

### 🕓 Version History
- **Automatic snapshots** every 5 minutes while a scene is open (only when content has changed)
- **Scene-leave snapshot** — a snapshot is taken automatically when navigating away from a scene
- **Pre-restore snapshot** — before restoring an older version, the current content is always saved first so nothing is lost
- SHA-256 deduplication — identical content is never saved twice
- Retention policy: up to **30 versions** per scene; if over 30, versions older than 30 days are pruned first, then the oldest overall
- **History sidebar** (History button in the scene toolbar):
  - Lists all snapshots with relative time ("5m ago") and absolute timestamp in your local timezone
  - Hover any entry to reveal **Preview** (eye icon) and **Restore** (↺ icon) buttons
  - Preview renders the snapshot content inline without leaving the editor
  - Restore shows an inline confirmation before applying

### 📚 Codex (World-building Database)
- Entry types: **Character**, **Location**, **Item**, **Lore**, **Custom**
- Fields: name, aliases, description, notes, colour tag, groups (multi-value), species (characters) / subtype (others), tags
- **Main character flag** — mark any character as a protagonist; main characters are starred (★) in relation dropdowns and used as the default centre of the Relations graph
- **Character inventory** — track currencies (custom names + amounts) and possessions (linked to item/location/lore entries with quantity and notes)
- **Multi-group** — assign an entry to any number of groups via a dropdown with existing group suggestions; filter by group in the Codex list
- Inline **Codex highlighting** in the editor — any word matching a Codex entry name or alias gets a coloured underline; click it to open the entry in the sidebar
- **List view** (default) — sortable table with columns for type/subtype, groups, tags, description; click column headers to sort ↑↓
- **Grid view** — colour-coded cards with sort pill-bar
- **Filters**: entry type, group, species, subtype, tags — each a multi-select dropdown with checkboxes; combine freely
- **Multi-select**: check entries (or click while another is selected) to enter selection mode; floating action bar lets you bulk-edit type, subtype/species, add shared tags, add shared relations, or delete
- Click any entry name or card to open the full edit dialog (two-column layout: options left, description right)
- **Relations**: link any two entries with a typed relation (Friend, Enemy, Ally, Rival, Family, Mentor, Student, Possession, Home, Origin, Member Of, Leads, or a custom label); direction-aware — shows "→ target" and "← source" in the detail view; relation target dropdown defaults to the first main character
- **Import Codex** from CSV/JSON or a folder of `.md` files

### 🔗 Shared Codex
- When creating a project, choose **Share codex** to live-link it to an existing project's world bible — both projects read and write the same codex entries
- Or choose **Copy codex** to start with an independent snapshot that can diverge freely
- Projects that share a codex also share a **combined timeline** spanning scenes from all sibling projects
- The source project is protected from deletion while any other project links to its codex; unlink first to delete
- Shared codex shown with a link badge on the dashboard project cards

### 🕸️ Relations Graph
- SVG radial mindmap — one entry at the centre, linked entries on the inner ring, second-degree connections on the outer ring
- **Depth slider (1–3)** — control how many relationship hops are shown at once
- Defaults to centring on the first **main character** (★) in the codex; falls back to the first character, then the first node
- Click any **node in the SVG** to re-centre the graph on that entry
- **Right-click a node** for a context menu: *Edit Codex Entry* or *Remove Relation*
- Click any **entry in the left panel** to open its full edit dialog inline — edit name, description, relations, inventory, and more without leaving the page
- Nodes rendered with a **spheric gradient** style, colour-coded by entry type; relation type shown on the connecting line with larger labels
- Solid lines = Codex relations; dashed lines = inline `[rel:]` tags from scene text

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
- When codex is shared between projects, the timeline **spans all sibling projects** with a project label on each row
- Empty-state prompt with a direct link to configure the time system
- **Time config** button in the header to adjust the time system without leaving the page

### 🤖 AI Assistant
- Sidebar panel in the scene editor (Sparkles button)
- Classic actions: **Continue**, **Rewrite**, **Brainstorm**, **Ask**, **Custom**
- **KI inline command** (`/ki` in the editor) — insert an AI generation node directly into the prose flow:
  - Select a **wrapper prompt** (Story Generation, Lector Review, Codex Entry Distillation, or any custom prompt)
  - Pick **codex entries** to inject as world-building context
  - Add **extra scenes** for additional context beyond the active scene
  - Set a **word count** target (presets: 600 / 800 / 1000, or enter any value); defaults to the prompt's configured word count
  - For the Codex Entry Distillation prompt, choose the **entry type** to extract (Character, Location, Item, Lore)
- Streams output from any [OpenRouter](https://openrouter.ai) model
- Insert generated text directly into the editor at the cursor

### 📝 AI Prompts
- Three **built-in prompts** shipped with the app:
  - **Story Generation** — continues or fills a scene, mirrors the author's voice; uses `{{WORD_COUNT}}` and `{{LANGUAGE}}`
  - **Lector Review** — full editorial report across grammar, logic, character consistency, prose quality, pacing, and dialogue
  - **Codex Entry Distillation** — extracts a structured codex entry (character, location, item, or lore) from scene content
- All built-in prompts inject the **project language** automatically (e.g. `language: "de"` → writes in German)
- **Custom prompts** — create your own with a name, description, system instruction, user template, and default word count
- Manage all prompts from **Settings → AI Prompts**: edit, create, delete, and **revert to default** (built-ins only)
- Template placeholders: `{{SCENE_CONTENT}}`, `{{CODEX_ENTRIES}}`, `{{USER_PROMPT}}`, `{{LANGUAGE}}`, `{{WORD_COUNT}}`, `{{ENTRY_TYPE}}`

---

## Settings

Open `/settings` or click **Settings** in the sidebar to:

- Add your [OpenRouter API key](https://openrouter.ai/keys) — stored server-side, never sent to the browser
- Choose your default AI model and enable/disable available models
- Switch between **dark** and **light** theme
- **AI Prompts** — view, edit, create, and revert all story generation prompts

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
| Mark a protagonist | Codex entry → **Main character** checkbox (character type only) |
| Edit an entry from the Relations graph | Click its name in the left panel |
| Edit or remove a relation | Right-click a node in the Relations graph |
| Adjust graph depth | Relations graph → depth slider (1–3 hops) |
| Share a world bible across projects | New Project → **Share codex** → pick the source project |
| Track what a character owns | Codex entry (character) → **Inventory** section |
| Browse scene snapshots | Scene editor → **History** button (top toolbar) |
| Restore an older version of a scene | History sidebar → hover a version → ↺ Restore |
| Preview a version without restoring | History sidebar → hover a version → 👁 eye icon |
| Generate text inline with AI | Type `/ki` in the editor, configure the node, click Generate |
| Customise an AI prompt | Settings → AI Prompts → select a prompt → edit system/template |
| Revert a built-in prompt to default | Settings → AI Prompts → select built-in → Revert to Default |
| Set the language for AI output | Project settings → Book Metadata → Language (BCP 47 code, e.g. `de`) |

---

## Project Structure

```
foliantica/
├── electron/             # Electron main process + splash screen
│   └── assets/           # App icons (ico, icns, png)
├── scripts/              # electron-builder hooks (afterPack)
├── api/                  # FastAPI backend
│   ├── routers/          # projects, acts, chapters, scenes, codex, time, graph, ai, settings, export, imports
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── database.py       # Engine, session, migration helpers
│   └── services/         # Tag parsing, AI streaming, export templates
└── web/                  # Next.js 14 frontend
    └── src/
        ├── app/          # App Router pages (projects, codex, timeline, relations, settings…)
        ├── components/   # Editor, Codex, AI panel, Time panel, Version History panel, layout
        ├── store/        # Zustand UI store + TanStack Query hooks
        ├── hooks/        # useAutosave, useExport
        └── types/        # Shared TypeScript interfaces
```

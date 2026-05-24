# Foliantica — Personal Novel Writer Studio

> *Every story has its own logic, its own language, its own world.*
> *Foliantica is the desk you build around it.*

You open the app. Your manuscript is there, exactly where you left it. Your world bible is a sidebar click away. The AI knows your characters and speaks your language. The timeline remembers every hour of every day you mapped. Nothing is in someone else's cloud. Nothing runs on someone else's clock.

**Foliantica is a local-first writing studio for novelists and world-builders** — a single app where manuscript, codex, timeline, and AI assistant live together, offline, on your own machine. Write your novel in long quiet sessions. Build lore entries between chapters. Ask the AI to draft a scene and then take it apart line by line. Come back tomorrow and nothing has moved.

No subscriptions. No accounts. No telemetry. Your words stay yours.

Available as a **standalone desktop app** (Windows, macOS, Linux) or run directly from source.

---

## Desktop App (recommended)

Download the latest installer from [Releases](../../releases) and run it. Foliantica starts as a self-contained app — no Node.js or Python required.

**Cloud sync:** point Foliantica at a folder inside your Dropbox, Google Drive, or OneDrive and it syncs automatically across devices. *(Settings → Data folder)*

---

## Development / Run from Source

Open two terminals from the `foliantica/` directory:

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
| Desktop | Electron 42, electron-builder |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | TipTap v3 — Typography, Underline, TextAlign, TaskList, Table + custom extensions |
| State | Zustand + TanStack Query v5 |
| Backend | FastAPI, SQLAlchemy 2.0, SQLite (WAL mode) |
| AI | OpenRouter (any model, proxied via backend) |
| Export | Markdown, LaTeX, PDF (Pandoc), EPUB (Pandoc) |

---

## Features

### ✍️ Story Editor

- **4-level hierarchy**: Project → Act → Chapter → Scene
- Drag-and-drop reordering at every level; insert a scene between existing ones via the **+** divider on hover
- Double-click any act or chapter title to rename inline
- Scene titles auto-generated from content if left blank
- Debounced **autosave** (1 s) + periodic interval save; localStorage fallback when the backend is unreachable
- Word count in the status bar; per-scene counts persist to the database
- **Slash commands** (`/`) — headings, lists, blockquote, task list, table, divider, images, currency/item nodes, AI nodes, and more
- **Rich formatting toolbar** — appears on text selection with bold, italic, underline, strikethrough, headings, lists, blockquote, and text alignment; stays out of the way otherwise
- **Smart typography** — curly quotes, en/em dashes, and ellipses applied automatically as you type
- **Task lists** — interactive checkboxes directly in the prose (`/tasklist`)
- **Tables** — insert a full table with header row via `/table`
- **Spellcheck** with native dictionary suggestions — right-click any underlined word to see corrections or add it to your personal dictionary
- **Typewriter mode** — the cursor stays pinned at a configurable vertical position as you write
- **Focus mode** — dims everything outside the active paragraph
- **Paragraph numbers** — optional count markers every 5 / 10 paragraphs
- **Find & Replace** — Ctrl+F / Cmd+F opens an in-editor search bar with match highlighting and replace
- **Export** to `.md`, `.tex` (LaTeX), PDF (via Pandoc), and EPUB
- **Import** a Markdown draft — headings `##` / `###` / `####` map to acts / chapters / scenes
- Read view per chapter and per act — flowing prose with story typography

### 🗒️ Scene Plan

- Each scene has a **plan checklist** — click the clipboard icon that appears next to its name in the sidebar
- Add tasks, check them off, edit inline (double-click), delete individually or bulk-clear completed
- A progress bar fills as tasks are ticked off; a green ✓ badge replaces the count when all are done
- Plans are stored locally (no backend changes needed) and survive app restarts

### 🕓 Version History

- **Automatic snapshots** every 5 minutes while a scene is open (only when content changed)
- **Scene-leave snapshot** on navigation; **pre-restore snapshot** before any restore
- SHA-256 deduplication — identical content never saved twice
- Retention: up to **30 versions** per scene; oldest pruned first after 30 days
- **History sidebar** — relative timestamps, inline preview (eye icon), and one-click restore with confirmation

### 📚 Codex (World-building Database)

- Entry types: **Character**, **Location**, **Item**, **Lore**, **Custom**
- Fields: name, aliases, description, notes, colour tag, groups, species / subtype, tags
- **Main character flag** — protagonists are starred (★) in dropdowns and centred in the relations graph
- **Character inventory** — currencies (custom names + amounts) and possessions (linked items with quantity and notes)
- Inline **Codex highlighting** — any word matching an entry name or alias gets a coloured underline; click to open
- **List view** — sortable by name, type, group, colour, or **tags**; click column headers to toggle ↑↓
- **Grid view** — colour-coded cards with the same sort pill-bar
- **Filters**: type, group, species, subtype, tags — multi-select dropdowns, combine freely
- **Multi-select** + bulk-edit: change type, subtype/species, add shared tags/relations, or delete in one action
- **Relations**: typed links between entries (Friend, Enemy, Family, Leads, Possession, custom…); direction-aware
- **Import** from CSV, JSON, or a folder of `.md` files

### 🔗 Shared Codex

- Link a new project to an existing one's world bible — both projects read and write the same codex
- Or **copy** the codex to start an independent fork
- Shared projects share a combined timeline spanning all their scenes

### 🕸️ Relations Graph

- SVG radial mindmap — one entry at centre, linked entries on the inner ring, second-degree on the outer ring
- **Depth slider (1–3)** — control relationship hops
- Click any node to re-centre; right-click for *Edit Entry* / *Remove Relation*
- Solid lines = explicit relations; dashed lines = inline `[rel:]` tags from scene text

### 🕐 Time System

- Per-project **configurable time units** — any combination of Age, Year, Season, Month, Day, Hour, Minute, Second; rename any unit to fit your world
- Custom count-per-parent (e.g. 13 months/year) and **named values** (e.g. month names, season names)
- **Day/Night cycle dial** — set day length, night start, and night duration; visualised as a purple arc on the SVG clock
- Per-scene **Time panel** — inputs for each enabled unit, live preview badge with ☀ / 🌙 label

### 📅 Timeline

- Horizontal grid — rows are scenes, columns are time points
- Column headers show formatted time and ☀ / 🌙 badge; click a cell to jump to that scene
- **Timeline tracks** — add named parallel story threads (e.g. "Parallel world", "Backstory"), each with its own colour and time range
- **Timeline events** — free-standing named events at any point in time, linked to a track; add them directly from the scene editor with the `/timeline` slash command (auto-fills the scene title and time)
- Shared-codex projects show a combined multi-project timeline

### 🤖 AI Assistant

- Sidebar panel — **Continue**, **Rewrite**, **Brainstorm**, **Ask**, **Custom** modes
- **`/ki` inline AI node** — insert a generation block directly into the prose:
  - Choose a **prompt** (Story Generation, Lector Review, Codex Distillation, or any custom prompt)
  - Inject **codex entries** and **extra scenes** as context
  - Set a **word count** target; entry-type selector for codex distillation
- **Auto-synopsis** — one-click scene synopsis generation from the scene toolbar
- Streams output from any [OpenRouter](https://openrouter.ai) model
- **Per-operation model overrides**: set a dedicated model for synopsis generation and codex distillation in Settings, independent of the global default

### 📝 AI Prompts

- Three built-in prompts: **Story Generation**, **Lector Review**, **Codex Entry Distillation**
- All inject the project language automatically (e.g. writes in German when `language: "de"`)
- **Custom prompts** — name, system instruction, user template, word count target
- Template placeholders: `{{SCENE_CONTENT}}`, `{{CODEX_ENTRIES}}`, `{{USER_PROMPT}}`, `{{LANGUAGE}}`, `{{WORD_COUNT}}`, `{{ENTRY_TYPE}}`
- Manage all prompts in **Settings → AI Prompts**; revert built-ins to factory defaults any time

### 🔍 Grammar & Style Check

- Powered by **LanguageTool** (self-hosted via Docker — your text never leaves your machine)
- Highlights grammar, style, spelling, and punctuation issues with colour-coded categories
- Click any issue to jump to the exact occurrence in the editor (handles repeated phrases correctly)
- One-click **Apply suggestion** to accept a fix in place
- 3-minute generous timeout with an immediate patience message while the check runs
- Supported languages: English, German, French, Spanish, Portuguese, Italian, Dutch, Polish, Russian, and more

### 📤 Export

- **Markdown** — clean `.md` output
- **LaTeX** — `\chapter` / `\section` structure with proper escaping; configurable font, size, margins, drop caps, page numbers
- **PDF** — via Pandoc (Docker); full LaTeX pipeline with custom typography settings
- **EPUB** — via Pandoc; configurable fonts, colours, margins
- Scene selection, heading inclusion, and typography all configurable from the export dialog

---

## Settings

- **OpenRouter API key** — stored server-side, never sent to the browser
- **Default AI model** — used for the writing panel; override separately for chat, synopsis, and codex distillation
- **Default Chat Model** — dedicated model for the Scene Chat panel
- **Default Synopsis Model** — dedicated model for auto-synopsis generation
- **Default Codex Distillation Model** — dedicated model for `/ki` codex distillation
- Enable/disable individual models for the `/ki` command
- **Themes** — Dark, Light, and themed variants
- **Paragraph numbers**, **session timer**, **typewriter position**
- **Grammar Check** — enable, set service URL and languages
- **PDF/EPUB Export** — enable Pandoc service and set URL
- **Data folder** — point to Dropbox / Drive / OneDrive for cross-device sync; migrate existing data in one click
- **AI Prompts** — edit, create, delete, revert built-ins

---

## Tips & Hints

| Tip | How |
|-----|-----|
| Rename an act or chapter | Double-click its title in the sidebar |
| Insert a scene between two scenes | Hover the divider → click **+** |
| Reorder anything | Grab the ⠿ drag handle on hover |
| Plan your scene | Click the 📋 icon next to its name in the sidebar |
| Open a Codex entry from the editor | Click the coloured underline under a highlighted word |
| Fix a spelling error | Right-click the underlined word → pick a suggestion |
| Add a word to the dictionary | Right-click → **Add to dictionary** |
| Insert a table | Type `/table` in the editor |
| Insert a task list | Type `/tasklist` in the editor |
| Smart quotes & em-dashes | Just type — they're applied automatically |
| Format selected text | Select text → use the bubble toolbar |
| Jump to a scene from the Timeline | Click the cell |
| Add an event to the timeline from a scene | Type `/timeline` in the editor |
| Clear a scene's time stamp | Time panel → **Clear** |
| Bulk-edit Codex entries | Check multiple entries → floating action bar |
| Sort codex by tags | List view → click **Tags** column header |
| Add custom month/season names | Time System → unit row → **Custom names** |
| Export the project | Sidebar → **Export** |
| Import a Markdown draft | Sidebar → **Import** — `##`/`###`/`####` → acts/chapters/scenes |
| Mark a protagonist | Codex entry → **Main character** checkbox |
| Edit an entry from the Relations graph | Click its name in the left panel |
| Share a world bible across projects | New Project → **Share codex** |
| Track character possessions | Codex entry (character) → **Inventory** |
| Browse scene snapshots | Scene editor → **History** button |
| Restore an older version | History sidebar → hover a version → ↺ |
| Generate text inline with AI | Type `/ki`, configure the node, click Generate |
| Set the language for AI output | Project → Book Metadata → Language (e.g. `de`) |
| Use a different model for codex distillation | Settings → Default Codex Distillation Model |

---

## Project Structure

```
foliantica/
├── electron/             # Electron main process + splash screen
│   └── assets/           # App icons (ico, icns, png)
├── scripts/              # electron-builder hooks
├── api/                  # FastAPI backend
│   ├── routers/          # projects, scenes, codex, time, graph, ai, settings, export, imports, timeline
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── database.py       # Engine, session, migration helpers
│   └── services/         # Tag parsing, AI streaming, export templates
└── web/                  # Next.js 14 frontend
    └── src/
        ├── app/          # App Router pages (projects, codex, timeline, relations, settings…)
        ├── components/   # Editor, Codex, AI panel, Time panel, Version History, Scene Plan
        ├── store/        # Zustand UI store + TanStack Query hooks
        ├── hooks/        # useAutosave, useExport
        └── types/        # Shared TypeScript interfaces
```

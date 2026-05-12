# LoreWeaver Personal Studio

A local-first novel writing webapp with a Codex system, AI writing assistance via OpenRouter, and export to Markdown/LaTeX.

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

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | TipTap with custom Codex highlighting |
| State | Zustand + TanStack Query |
| Backend | FastAPI, SQLAlchemy 2.0, SQLite |
| AI | OpenRouter (proxied via backend) |
| Export | Markdown + LaTeX (Jinja2) |

## Features

- **Story structure** — Projects → Chapters → Scenes with drag-and-drop reordering
- **Codex** — World-building database (characters, locations, items, lore) with inline highlighting
- **AI assistant** — Continue, Rewrite, Brainstorm, Ask, or Custom prompts via any OpenRouter model
- **Autosave** — Debounced + interval saves with localStorage fallback when offline
- **Export** — Markdown and LaTeX with proper escaping

## Settings

Visit `/settings` to add your [OpenRouter API key](https://openrouter.ai/keys) and choose your default model. The key is encrypted at rest and never sent to the browser.

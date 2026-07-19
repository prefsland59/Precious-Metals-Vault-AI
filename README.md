# Precious Metals Vault AI

AI-first cross-platform app for managing precious metals portfolios. Track gold, silver, platinum, and more across multiple storage locations with AI-assisted data entry, grading, and counterfeit detection.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Vite 7 + React 19 + TypeScript | Fast dev, small bundles, PWA-ready |
| **Styling** | Tailwind CSS v4 | Utility-first, theme via CSS variables |
| **Backend** | Express 4 + TypeScript | Lightweight, proven, minimal memory |
| **Database** | SQLite (via better-sqlite3) | Zero-config, serverless, offline-capable |
| **Package Manager** | Bun | Fast installs, native TS support, monorepo workspaces |
| **Auth (future)** | JWT + bcrypt | Standard, self-contained |
| **AI (future)** | OpenAI / Anthropic APIs | Image recognition, grading, voice |

## Project Structure

```
pmvault/
  frontend/     Vite + React + Tailwind (port 3000)
  backend/      Express API server (port 3001)
  shared/       Shared TypeScript types and constants
```

## Getting Started

```bash
# Install all dependencies
bun install

# Start both frontend + backend (from root)
bun run dev          # frontend on :3000
bun run dev:backend  # backend on :3001

# Or from individual packages
cd frontend && bun run dev
cd backend && bun run dev
```

## Design System

Premium dark theme: black backgrounds (#0a0a0a), charcoal surfaces (#1a1a2e), silver text (#c0c0c0), gold accents (#d4a843), platinum highlights (#e5e4e2). Luxury banking/investment aesthetic.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check — returns 200 |
| `/api/holdings` | GET | List portfolio holdings |
| `/api/holdings` | POST | Add a new holding |
| `/api/spot` | GET | Current spot prices |

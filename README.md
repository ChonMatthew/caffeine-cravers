# Caffeine Cravers POS

A single-vendor point-of-sale web app for a pop-up coffee stall. Built to run in a
browser on an iPad (via the **Bluefy** browser, for Web Bluetooth printer support),
with sales reports viewable from any laptop.

- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS v4 (CSS-first, configured in `app/globals.css`)
- **Language:** TypeScript

## Prerequisites

- Node.js **20.9+** (developed on Node 24)
- npm

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Status

Early development. The build plan (phases, architecture decisions, and the
verified Next.js 16 constraints this project is built against) lives outside the
repo in the project plan document. Current phase: **Phase 0 — foundations.**

Later phases add the database (Postgres via Supabase, using Drizzle ORM), a PIN
gate, catalog management, the order/till screen, Bluetooth receipt printing, and
sales reports. Environment variables and DB scripts will be documented here as
they land.

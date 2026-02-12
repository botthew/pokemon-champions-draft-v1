# Quad Badge Draft League (Gen 1–3) — Project Status

## TL;DR
A live, mobile-friendly Pokémon draft room for 4 coaches with **shared state** (Postgres) deployed on **Fly.io**.

## Live links
- **Fly app (shared drafting + persistence):** https://quad-badge-draft-league.fly.dev/
- **Draft tab:** https://quad-badge-draft-league.fly.dev/#draft
- Static site (GitHub Pages; read-only for drafting): https://botthew.github.io/pokemon-champions-draft-v1/
- Repo: https://github.com/botthew/pokemon-champions-draft-v1

## League configuration (v1)
- Coaches: Billy, Sven, Coleman, Carter
- Gen 1–3 only; no legendaries/mythicals; pseudo-legends OK
- Team size: 10 Pokémon per coach
- Budget: 110 points
- Format: Singles 6v6
- No Terastalization / no Dynamax

### Coach/Admin PINs
- Billy: 2455 (also **admin**)
- Sven: 7836
- Coleman: 2653
- Carter: 2278

## What’s shipped
### Draft room (Fly backend + Postgres)
- Admin controls:
  - **Reshuffle draft order** (only before any picks)
  - **Start (lock) draft order** (required before picks)
- Turn enforcement (snake) + budget enforcement
- Draft state shared across all clients
- Pick feed (desktop: left sidebar) with **scrollable** combined “Up next + History”
- Private coach queue (device-local) + optional auto-draft
  - Current preference: **STOP mode** (if top queued mon is invalid/taken/over-budget, do nothing)

### Pokémon details dialog
- Stats (incl. BST) + official artwork
- **Abilities:** tap an ability → short description + expandable full description
- **Moves:** shows Type + category (physical/special/status) + Power + Accuracy + PP inline; tap a move → description panel

### Social preview
- Open Graph + Twitter card tags wired up
- Assets served from `/assets/*`:
  - `/assets/og.png` (1200×630)
  - favicons + apple-touch icon + webmanifest

## Architecture
- Frontend: `docs/` (static SPA served by Express)
- Backend: `server/index.js` (Express + Postgres)
- DB schema: `server/schema.sql`
  - `draft_picks`, `draft_state`, `match_results`

## API (backend)
- `GET /api/health` → `{ ok, storage }`
- `GET /api/state` → picks + rosters + budgets + turn + draftState
- `POST /api/pick` → `{ coach, pin, pokemonDex }`
- Admin (requires `adminPin`):
  - `POST /api/admin/shuffle`
  - `POST /api/admin/lock`
  - `POST /api/undo_last`
  - `POST /api/reset_draft`
  - `POST /api/result` → `{ matchKey, aWins, bWins, adminPin }`

## Fly.io deployment
- Fly app: `quad-badge-draft-league` (region: `iad`)
- Fly Postgres: `quad-badge-draft-db`
- Currently scaled to **1 machine** (cost control)

Secrets used:
- `DATABASE_URL` (auto-set by Fly Postgres attach)
- `COACH_PINS_JSON`
- `ADMIN_PIN`

## Known gaps / backlog
- Persist Results/Standings UI to Postgres (currently the “Results & Standings” page is localStorage-based)
- Optional: make coach queues shared (currently queues are private per device by design)
- Optional: add UI buttons for admin undo/reset (API exists)

## Development notes
- Run tests: `npm test`
- Branch used for current live iteration: `feature/draft-queue-autopick` (merge to main when stable)

# Quad Badge Draft League (Gen 1–3)

A live, mobile-friendly Pokémon draft league app for 4 coaches with shared state on Fly.io.

## Live
- App: https://quad-badge-draft-league.fly.dev/
- Draft: https://quad-badge-draft-league.fly.dev/#draft

## League rules (v1)
- Gen 1–3 only; no legendaries/mythicals; pseudo-legends OK
- 4 coaches, 10 Pokémon per coach
- 110 point budget
- Singles 6v6
- No Terastalization / no Dynamax

## Repo layout
- `docs/` — frontend SPA (also what the Express server serves)
- `server/` — Express + Postgres backend
- `scripts/` — pool/schedule/bracket generators + CLI helpers
- `config/` — config files (banned species list, etc.)

## Running locally
### 1) Install deps
```bash
npm install
```

### 2) Provide a Postgres DB (required for Draft)
The Draft room requires persistence.

Set:
```bash
export DATABASE_URL="postgres://..."
export COACH_PINS_JSON='{"Billy":"2455","Sven":"7836","Coleman":"2653","Carter":"2278"}'
export ADMIN_PIN="2455"
```

### 3) Start server
```bash
PORT=5177 node server/index.js
# open http://localhost:5177
```

## Fly.io deploy
This repo includes `fly.toml`.

Typical deploy:
```bash
flyctl deploy -a quad-badge-draft-league
```

Set secrets:
```bash
flyctl secrets set -a quad-badge-draft-league \
  COACH_PINS_JSON='{"Billy":"2455","Sven":"7836","Coleman":"2653","Carter":"2278"}' \
  ADMIN_PIN='2455'
```

## Draft API (backend)
- `GET /api/state`
- `POST /api/pick` → `{ coach, pin, pokemonDex }`

Admin endpoints (require `adminPin`):
- `POST /api/admin/shuffle`
- `POST /api/admin/lock`
- `POST /api/undo_last`
- `POST /api/reset_draft`

## Tests
Queue/auto-draft selection logic has unit tests:

```bash
npm test
```

## Social preview assets
These are served from `docs/assets/` and referenced by OG/Twitter meta tags in `docs/index.html`.

- `docs/assets/og.png` (1200×630)
- `docs/assets/favicon-32.png`, `docs/assets/favicon-48.png`
- `docs/assets/apple-touch-icon.png`
- `docs/site.webmanifest`

## Status doc
See: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)

# Quad Badge Draft League (Gen 1–3) — Project Status

## Live links
- Static site (GitHub Pages): https://botthew.github.io/pokemon-champions-draft-v1/
- Fly app (persistent storage + live drafting): https://quad-badge-draft-league.fly.dev/
- Repo: https://github.com/botthew/pokemon-champions-draft-v1

## Current state (done)
- League rules, schedule generator, pool generator (Gen1–3, no legends/mythicals).
- Static web UI: pool browser w/ type chips + sprites, click-for-details (stats/abilities/moves via PokeAPI), schedule, results+standings.
- Mobile-friendly styling and themed UI pass.

## Goal (next)
✅ Fly app deployed with **persistent storage** so:
- everyone sees the same draft state / rosters
- drafting happens in the interface (turn enforcement + budget)
- results/standings can persist across devices

## Deployment notes
- Fly app name: `quad-badge-draft-league`
- Fly Postgres app name: `quad-badge-draft-db`
- Region: `iad`
- Currently scaled to **1 machine** to keep costs low.

## Next steps (planned)
1) Implement backend API + Postgres schema (picks, results) + validation (turn order, budget).
2) Add a Draft page to the UI.
3) Install flyctl, create Fly app + Fly Postgres, set secrets, deploy.

## Required inputs from Billy (minimal)
- Provide Fly token again (so I can set `FLY_API_TOKEN` here).
- Coach PINs: T9 first-4 letters (BILL=2455, SVEN=7836, COLE=2653, CART=2278). Admin PIN: reuse Billy (2455).

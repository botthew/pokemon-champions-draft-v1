# Pokemon Champions Draft League (v1)

A tiny toolset to run a **4-coach Pokemon Champions draft league** using a **Gen 1–3, non-legendary** pool and **points pricing**.

## What this gives you (v1)
- A generated **draft pool CSV** (Gen 1–3 only, legendaries/mythicals removed)
- **Points + tier** for each Pokemon (simple BST-based pricing)
- A lightweight **CLI draft helper** (snake draft, budgets, roster validation)
- A **rules doc** + **schedule/bracket generators** for a 4-coach league

## Rules assumptions
- 4 coaches
- 10 Pokemon per coach
- Singles 6v6
- No Terastalization
- No Dynamax
- No legendaries / mythicals (see `config/banned_species.txt`)
- 3-week regular season (Bo2 each week) + week-4 playoffs

## Quick start
### 1) Generate the pool
```bash
# This repo only needs `requests`.
# If you don't already have it:
#   pip3 install requests

python3 scripts/generate_pool.py --out out/pool_gen1-3_no_legends.csv
```

### 2) League rules
See: `docs/LEAGUE_RULES.md`

### 3) Generate schedule (weeks 1–3)
```bash
python3 scripts/generate_schedule.py --coaches Billy,Coach2,Coach3,Coach4
# outputs: out/schedule_weeks1-3.csv
```

### 4) Generate playoffs bracket template (week 4)
```bash
python3 scripts/generate_playoff_bracket.py --seed1 Seed1 --seed2 Seed2 --seed3 Seed3 --seed4 Seed4 --pick 4
# outputs: out/playoffs_week4.json
```

### 5) Drafting
You can draft in Google Sheets from the pool CSV, or use the CLI draft helper:
```bash
python3 scripts/draft_cli.py \
  --pool out/pool_gen1-3_no_legends.csv \
  --coaches Billy,Coach2,Coach3,Coach4 \
  --budget 110 \
  --team-size 10
```

## Notes
This is intentionally simple for v1. If you want a web UI, persistence, invites, trades, weekly match tracking, etc., we can build that as v2.

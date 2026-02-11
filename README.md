# Pokemon Champions Draft League (v1)

A tiny toolset to run a **4-coach Pokemon Champions draft league** using a **Gen 1–3, non-legendary** pool and **points pricing**.

## What this gives you (v1)
- A generated **draft pool CSV** (Gen 1–3 only, legendaries/mythicals removed)
- **Points + tier** for each Pokemon (simple BST-based pricing)
- Optional: a lightweight **CLI draft helper** (snake draft, budgets, roster validation)

## Rules assumptions
- 4 coaches
- 10 Pokemon per coach
- No Terastalization
- No Dynamax
- No legendaries / mythicals (see `config/banned_species.txt`)

## Quick start
### 1) Generate the pool
```bash
# This repo only needs `requests`.
# If you don't already have it:
#   pip3 install requests

python3 scripts/generate_pool.py --out out/pool_gen1-3_no_legends.csv
```

### 2) Use it in Google Sheets
- Create a new Google Sheet
- File → Import → Upload → `out/pool_gen1-3_no_legends.csv`
- Use filters / sort by `points` / build your draft board

### 3) (Optional) Run the CLI draft helper
```bash
python scripts/draft_cli.py \
  --pool out/pool_gen1-3_no_legends.csv \
  --coaches Billy,Coach2,Coach3,Coach4 \
  --budget 110 \
  --team-size 10
```

## Notes
This is intentionally simple for v1. If you want a web UI, persistence, invites, trades, weekly match tracking, etc., we can build that as v2.

# Pokemon Champions Draft League — Rules (v1)

## Overview
- **Coaches:** 4
- **Draft size:** 10 Pokemon per coach
- **Battle format:** Singles 6v6
- **Mechanics:** **No Terastalization**, **No Dynamax**
- **Dex/pool:** **Gen 1–3 only (National Dex #1–386)**
- **Restrictions:** **No legendaries or mythicals** (pseudo-legendaries are allowed)
- **Pricing:** points-based (see `out/pool_gen1-3_no_legends.csv`)

## Draft
- **Draft type:** Snake
- **Budget:** **110 points** per coach (recommended default)
- **Duplicate clause:** Each Pokemon may only be drafted once.

### Suggested “bring” rule (recommended)
Each weekly match, each coach brings **6** Pokemon chosen from their **10** drafted Pokemon.

## Regular season (Weeks 1–3)
- **Round robin:** 3 weeks, each week you face a different opponent.
- **Each week is a Bo2:** you play **two games** vs your opponent.
- **Scoring:** **1 point per game win**.
  - 2–0 week = 2 points
  - 1–1 week = 1 point
  - 0–2 week = 0 points

### Standings / seeding
Rank by:
1) **Total points** (game wins)
2) **Head-to-head points** among tied coaches
3) **Game differential** (wins − losses)
4) If still tied: **1 tiebreak game** (or coin flip if you’re feeling evil)

## Playoffs (Week 4)
- **4-person tournament**
- **Seeding:** based on regular season standings
- **Bracket selection:** **#1 seed chooses** their semifinal opponent (either #3 or #4). The remaining two play the other semifinal.
- **Series length:** **Single Elim (Bo1)** or **Bo3** (TBD when you get there)

## Pokémon list / pool
- Generated pool + points live here:
  - `out/pool_gen1-3_no_legends.csv`
- Bans are controlled here:
  - `config/banned_species.txt`

If you want to do manual price overrides (ex: bump Blissey +1), we can add `config/price_overrides.csv` and merge it into the generated pool.

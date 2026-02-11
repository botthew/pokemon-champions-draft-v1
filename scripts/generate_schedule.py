#!/usr/bin/env python3

import argparse
import csv
import os
from typing import List, Tuple


def round_robin_4(coaches: List[str]) -> List[List[Tuple[str, str]]]:
    """Deterministic 4-team round robin pairings (3 rounds)."""
    if len(coaches) != 4:
        raise ValueError("This scheduler currently supports exactly 4 coaches")

    a, b, c, d = coaches
    return [
        [(a, b), (c, d)],
        [(a, c), (b, d)],
        [(a, d), (b, c)],
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--coaches", required=True, help="Comma-separated coach names in seed order")
    ap.add_argument("--out", default="out/schedule_weeks1-3.csv")
    args = ap.parse_args()

    coaches = [c.strip() for c in args.coaches.split(",") if c.strip()]
    rounds = round_robin_4(coaches)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["week", "match", "coach1", "coach2", "format", "scoring"],
        )
        w.writeheader()
        for i, pairings in enumerate(rounds, start=1):
            for j, (c1, c2) in enumerate(pairings, start=1):
                w.writerow(
                    {
                        "week": i,
                        "match": j,
                        "coach1": c1,
                        "coach2": c2,
                        "format": "Bo2 (two games)",
                        "scoring": "1 point per game win",
                    }
                )

    print(f"Wrote schedule (weeks 1–3) → {args.out}")


if __name__ == "__main__":
    main()

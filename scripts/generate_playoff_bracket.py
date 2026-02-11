#!/usr/bin/env python3

import argparse
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/playoffs_week4.json")
    ap.add_argument("--seed1", default="Seed1")
    ap.add_argument("--seed2", default="Seed2")
    ap.add_argument("--seed3", default="Seed3")
    ap.add_argument("--seed4", default="Seed4")
    ap.add_argument("--pick", choices=["3", "4"], default="4", help="#1 seed chooses to play seed 3 or 4")
    args = ap.parse_args()

    s1, s2, s3, s4 = args.seed1, args.seed2, args.seed3, args.seed4

    if args.pick == "3":
        semi1 = (s1, s3)
        semi2 = (s2, s4)
    else:
        semi1 = (s1, s4)
        semi2 = (s2, s3)

    bracket = {
        "week": 4,
        "type": "single_elim",
        "series": "Bo1_or_Bo3_TBD",
        "seeds": {"1": s1, "2": s2, "3": s3, "4": s4},
        "semifinals": {"match1": {"a": semi1[0], "b": semi1[1]}, "match2": {"a": semi2[0], "b": semi2[1]}},
        "final": {"a": "winner_match1", "b": "winner_match2"},
        "notes": "#1 seed picks semifinal opponent (seed 3 or 4)",
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(bracket, f, indent=2)

    print(f"Wrote playoff bracket template → {args.out}")


if __name__ == "__main__":
    main()

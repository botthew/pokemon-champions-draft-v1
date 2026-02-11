#!/usr/bin/env python3

import argparse
import csv
import os
import time
from typing import Dict, List, Tuple

import requests

POKEAPI = "https://pokeapi.co/api/v2"


def load_banned(path: str) -> set:
    banned = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip().lower()
            if not line or line.startswith("#"):
                continue
            banned.add(line)
    return banned


def bst_from_stats(stats: List[dict]) -> int:
    return sum(s["base_stat"] for s in stats)


def points_from_bst(bst: int) -> Tuple[int, str]:
    """Simple BST-based pricing tuned for Gen 1–3.

    Output: (points, tier)
    """
    # Pseudos / top-end (Dragonite / Tyranitar / Salamence / Metagross) are ~600
    if bst >= 600:
        return 20, "S"
    if bst >= 570:
        return 19, "S"
    if bst >= 540:
        return 17, "A"
    if bst >= 515:
        return 15, "B"
    if bst >= 490:
        return 13, "B"
    if bst >= 470:
        return 11, "C"
    if bst >= 450:
        return 10, "C"
    if bst >= 430:
        return 8, "D"
    if bst >= 410:
        return 7, "D"
    if bst >= 390:
        return 6, "E"
    if bst >= 330:
        return 5, "E"
    return 4, "F"


def fetch_pokemon(pid: int, session: requests.Session) -> dict:
    r = session.get(f"{POKEAPI}/pokemon/{pid}/", timeout=30)
    r.raise_for_status()
    return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output CSV path")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=386, help="386 = end of Gen 3")
    ap.add_argument("--banned", default="config/banned_species.txt")
    ap.add_argument("--sleep", type=float, default=0.15, help="Sleep between requests")
    args = ap.parse_args()

    banned = load_banned(args.banned)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    rows: List[Dict] = []
    with requests.Session() as session:
        session.headers.update({"User-Agent": "pokemon-champions-draft-v1 (github.com)"})
        for pid in range(args.start, args.end + 1):
            data = fetch_pokemon(pid, session)
            name = data["name"].lower()
            if name in banned:
                time.sleep(args.sleep)
                continue

            types = "/".join([t["type"]["name"] for t in sorted(data["types"], key=lambda x: x["slot"])])
            bst = bst_from_stats(data["stats"])
            points, tier = points_from_bst(bst)

            rows.append(
                {
                    "dex": pid,
                    "name": name,
                    "types": types,
                    "bst": bst,
                    "points": points,
                    "tier": tier,
                }
            )

            time.sleep(args.sleep)

    # Sort best-to-worst for convenience
    rows.sort(key=lambda r: (r["points"], r["bst"], r["name"]), reverse=True)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["dex", "name", "types", "bst", "points", "tier"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"Wrote {len(rows)} Pokemon → {args.out}")


if __name__ == "__main__":
    main()

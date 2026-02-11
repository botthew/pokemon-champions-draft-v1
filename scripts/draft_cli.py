#!/usr/bin/env python3

import argparse
import csv
from dataclasses import dataclass, field
from typing import Dict, List, Set


@dataclass
class Coach:
    name: str
    budget: int
    picks: List[dict] = field(default_factory=list)

    @property
    def spent(self) -> int:
        return sum(int(p["points"]) for p in self.picks)

    @property
    def remaining(self) -> int:
        return self.budget - self.spent


def load_pool(path: str) -> List[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def index_pool(pool: List[dict]) -> Dict[str, dict]:
    return {p["name"].lower(): p for p in pool}


def snake_order(coaches: List[str], rounds: int) -> List[str]:
    order = []
    for r in range(rounds):
        if r % 2 == 0:
            order.extend(coaches)
        else:
            order.extend(list(reversed(coaches)))
    return order


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", required=True)
    ap.add_argument("--coaches", required=True, help="Comma-separated coach names")
    ap.add_argument("--budget", type=int, default=110)
    ap.add_argument("--team-size", type=int, default=10)
    args = ap.parse_args()

    coach_names = [c.strip() for c in args.coaches.split(",") if c.strip()]
    if len(coach_names) < 2:
        raise SystemExit("Need at least 2 coaches")

    pool = load_pool(args.pool)
    by_name = index_pool(pool)
    drafted: Set[str] = set()

    coaches = {name: Coach(name=name, budget=args.budget) for name in coach_names}
    order = snake_order(coach_names, args.team_size)

    print("Snake draft order:")
    print(" → ".join(order))
    print("\nType a Pokemon name on your turn (or 'list <tier>' / 'top <n>' / 'team <coach>' / 'undo').")

    history: List[tuple] = []  # (coach, pokemon_name)

    i = 0
    while i < len(order):
        coach = coaches[order[i]]
        prompt = f"[{i+1}/{len(order)}] {coach.name} (remaining {coach.remaining}) > "
        cmd = input(prompt).strip()

        if not cmd:
            continue

        if cmd.lower().startswith("list "):
            tier = cmd.split(" ", 1)[1].strip().upper()
            matches = [p for p in pool if p["tier"].upper() == tier and p["name"] not in drafted]
            matches.sort(key=lambda p: (int(p["points"]), int(p["bst"])), reverse=True)
            for p in matches[:50]:
                print(f"{p['name']:<15} {p['types']:<20} bst={p['bst']:<3} pts={p['points']} tier={p['tier']}")
            continue

        if cmd.lower().startswith("top "):
            n = int(cmd.split(" ", 1)[1].strip())
            avail = [p for p in pool if p["name"] not in drafted]
            avail.sort(key=lambda p: (int(p["points"]), int(p["bst"])), reverse=True)
            for p in avail[:n]:
                print(f"{p['name']:<15} {p['types']:<20} bst={p['bst']:<3} pts={p['points']} tier={p['tier']}")
            continue

        if cmd.lower().startswith("team "):
            who = cmd.split(" ", 1)[1].strip()
            if who not in coaches:
                print("Unknown coach")
                continue
            c = coaches[who]
            print(f"{c.name}: spent {c.spent} / {c.budget} (remaining {c.remaining})")
            for p in c.picks:
                print(f"- {p['name']} ({p['types']}) pts={p['points']} bst={p['bst']} tier={p['tier']}")
            continue

        if cmd.lower() == "undo":
            if not history:
                print("Nothing to undo")
                continue
            last_coach, last_pick = history.pop()
            drafted.remove(last_pick)
            coaches[last_coach].picks = [p for p in coaches[last_coach].picks if p["name"] != last_pick]
            i -= 1
            print(f"Undid: {last_coach} → {last_pick}")
            continue

        pick = cmd.lower()
        if pick not in by_name:
            print("Not found in pool. Tip: use lowercase names from the CSV.")
            continue
        if pick in drafted:
            print("Already drafted")
            continue

        p = by_name[pick]
        cost = int(p["points"])
        if cost > coach.remaining:
            print(f"Not enough budget (cost {cost}, remaining {coach.remaining})")
            continue

        coach.picks.append(p)
        drafted.add(pick)
        history.append((coach.name, pick))
        print(f"Picked: {coach.name} → {pick} (pts {cost}, remaining {coach.remaining})")
        i += 1

    print("\nDraft complete!\n")
    for c in coaches.values():
        print(f"{c.name}: spent {c.spent} / {c.budget}")
        for p in c.picks:
            print(f"- {p['name']} ({p['types']}) pts={p['points']} bst={p['bst']} tier={p['tier']}")
        print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3

"""Copy generated CSVs into docs/ so GitHub Pages can serve them."""

import argparse
import os
import shutil


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", default="out/pool_gen1-3_no_legends.csv")
    ap.add_argument("--schedule", default="out/schedule_weeks1-3.csv")
    ap.add_argument("--dest", default="docs/data")
    args = ap.parse_args()

    os.makedirs(args.dest, exist_ok=True)

    shutil.copyfile(args.pool, os.path.join(args.dest, "pool.csv"))
    shutil.copyfile(args.schedule, os.path.join(args.dest, "schedule.csv"))

    print(f"Copied pool+schedule → {args.dest}/")


if __name__ == "__main__":
    main()

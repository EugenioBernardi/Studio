#!/usr/bin/env python3
"""Step 2 -- assemble curation evidence, and validate the hand-written result.

Two modes, because this step has a human in the middle by design.

    # fetch metadata for every discovered entry and write the worklist
    python scripts/02_curate.py screen

    # once you have hand-written data/folds.csv, check it
    python scripts/02_curate.py validate

`screen` writes data/folds_candidates.csv. That file is a worklist of entries
with their evidence and a *suggested* verdict. It is not an answer. Read each
candidate's primary citation and write data/folds.csv yourself; `validate`
then refuses anything malformed, unsourced, recombinant, or duplicated at the
fold level.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from taufold.curate import FOLDS_COLUMNS, screen_entries, validate_folds  # noqa: E402
from taufold.discover import fetch_entry_metadata  # noqa: E402


def cmd_screen(args: argparse.Namespace) -> int:
    entries_file = args.datadir / "mapt_entries.json"
    if not entries_file.exists():
        print(f"missing {entries_file}; run scripts/01_discover.py first", file=sys.stderr)
        return 1
    record = json.loads(entries_file.read_text())
    ids = record["entry_ids"]
    print(f"{len(ids)} entries from {record.get('retrieved_utc', 'unknown date')}")

    meta = fetch_entry_metadata(ids, cache=args.datadir / "cache")
    missing = sorted(set(ids) - set(meta))
    if missing:
        print(f"warning: no metadata for {len(missing)} entries: {missing[:8]}")

    candidates = screen_entries(meta)
    out = args.datadir / "folds_candidates.csv"
    rows = [c.as_row() for c in candidates]
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    tally = Counter(c.verdict for c in candidates)
    print(f"\nwrote {out} ({len(rows)} rows)")
    for verdict, n in tally.most_common():
        print(f"  {verdict:24s} {n:4d}")
    print(
        "\nThese verdicts are suggestions. Every retained entry needs its primary\n"
        "citation read before it enters data/folds.csv. Columns expected there:\n"
        f"  {', '.join(FOLDS_COLUMNS)}"
    )
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    folds = args.datadir / "folds.csv"
    if not folds.exists():
        print(f"missing {folds}; write it by hand after screening", file=sys.stderr)
        return 1
    with folds.open(newline="") as fh:
        rows = list(csv.DictReader(fh))

    problems = validate_folds(rows)
    if problems:
        print(f"{len(problems)} problem(s) in {folds}:\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    diseases = Counter(r["disease"].strip() for r in rows)
    isoforms = Counter(r["isoform"].strip() for r in rows)
    print(f"{folds}: {len(rows)} folds, no problems found")
    print("  diseases:", ", ".join(f"{d}={n}" for d, n in sorted(diseases.items())))
    print("  isoforms:", ", ".join(f"{i}={n}" for i, n in sorted(isoforms.items())))
    if len(rows) < 10:
        print(
            f"\n  note: n={len(rows)} folds. The brief budgets for ~20 and says to\n"
            "  state the small n in the methods rather than dress it up."
        )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datadir", type=Path, default=Path("data"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("screen", help="fetch metadata and write the worklist")
    sub.add_parser("validate", help="check a hand-written folds.csv")
    args = ap.parse_args()
    return {"screen": cmd_screen, "validate": cmd_validate}[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())

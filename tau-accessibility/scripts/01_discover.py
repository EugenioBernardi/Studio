#!/usr/bin/env python3
"""Step 1 -- query the PDB for MAPT cryo-EM entries.

Already verified on the author's machine (234 entries). Re-run only to refresh.

    python scripts/01_discover.py --outdir data
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from taufold.discover import MAPT_UNIPROT, discover  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--outdir", type=Path, default=Path("data"))
    ap.add_argument("--uniprot", default=MAPT_UNIPROT)
    args = ap.parse_args()

    record = discover(args.outdir, args.uniprot)
    print(f"{record['n_entries']} entries -> {args.outdir / 'mapt_entries.json'}")
    print("Next: python scripts/02_curate.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

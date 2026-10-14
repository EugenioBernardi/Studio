#!/usr/bin/env python3
"""Step 3 -- core/coat matrix and per-residue SASA for every curated fold.

    python scripts/03_accessibility.py --datadir data --n-trim 2

Reads data/folds.csv (validated by step 2), downloads each structure once into
data/structures/, and writes four tidy files for the R analysis layer:

    data/core_matrix_long.csv   one row per fold x residue, 1/0/NA
    data/residue_sasa.csv       one row per fold x protofilament x residue
    data/motif_exposure.csv     one row per fold x motif
    data/provenance.json        versions, parameters, and every warning raised

Nothing here averages a 1 against an NA. See taufold/motifs.py for why that
distinction is load-bearing rather than pedantic.
"""

from __future__ import annotations

import argparse
import csv
import json
import platform
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from taufold import pdbparse, sasa  # noqa: E402
from taufold.curate import validate_folds  # noqa: E402
from taufold.motifs import MOTIFS, TAU_LENGTH, repeat_isoform  # noqa: E402

STRUCTURE_URL = "https://files.rcsb.org/download/{pdb_id}.cif"


def fetch_structure(pdb_id: str, outdir: Path) -> Path:
    """Local copy of a structure, downloaded only if not already present.

    A pre-placed .cif or .pdb is used as-is. That is what makes the pipeline
    runnable, and therefore testable, without network access.
    """
    outdir.mkdir(parents=True, exist_ok=True)
    for suffix in (".cif", ".pdb"):
        candidate = outdir / f"{pdb_id.upper()}{suffix}"
        if candidate.exists() and candidate.stat().st_size > 0:
            return candidate
    path = outdir / f"{pdb_id.upper()}.cif"
    url = STRUCTURE_URL.format(pdb_id=pdb_id.lower())
    with urllib.request.urlopen(url, timeout=120) as resp:
        path.write_bytes(resp.read())
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datadir", type=Path, default=Path("data"))
    ap.add_argument(
        "--n-trim", type=int, default=sasa.DEFAULT_N_TRIM,
        help="layers discarded from EACH end of the stack (default 2)",
    )
    ap.add_argument("--probe-radius", type=float, default=1.40)
    ap.add_argument("--n-points", type=int, default=100)
    args = ap.parse_args()

    folds_path = args.datadir / "folds.csv"
    if not folds_path.exists():
        print(f"missing {folds_path}; see scripts/02_curate.py", file=sys.stderr)
        return 1
    with folds_path.open(newline="") as fh:
        folds = list(csv.DictReader(fh))

    problems = validate_folds(folds)
    if problems:
        print("folds.csv does not validate; fix it before computing:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    core_rows: list[dict] = []
    sasa_rows: list[dict] = []
    motif_rows: list[dict] = []
    all_warnings: dict[str, list[str]] = {}

    for row in folds:
        pdb_id = row["pdb_id"].strip().upper()
        isoform = repeat_isoform(row["isoform"])
        meta = {
            "pdb_id": pdb_id,
            "disease": row["disease"].strip(),
            "fold_label": row["fold_label"].strip(),
            "isoform": isoform,
        }
        print(f"{pdb_id} ({meta['disease']}/{meta['fold_label']}, {isoform}) ...",
              end="", flush=True)

        path = fetch_structure(pdb_id, args.datadir / "structures")
        model = pdbparse.load_model(path, pdb_id)

        try:
            folds_sasa = sasa.fold_sasa(
                model, pdb_id, n_trim=args.n_trim,
                probe_radius=args.probe_radius, n_points=args.n_points,
            )
        except pdbparse.FibrilGeometryError as exc:
            print(f" SKIPPED: {exc}")
            all_warnings[pdb_id] = [f"skipped: {exc}"]
            continue

        notes: list[str] = []
        for f in folds_sasa:
            notes += f.warnings
            for r in f.residues:
                sasa_rows.append({
                    **meta,
                    "protofilament": f.protofilament,
                    "n_layers_total": f.n_layers_total,
                    "n_layers_used": f.n_layers_used,
                    "n_trim": f.n_trim,
                    "collinearity": round(f.collinearity, 4)
                    if f.collinearity == f.collinearity else "",
                    "resno": r.resno,
                    "resname": r.resname,
                    "sasa_mean": round(r.sasa_mean, 3),
                    "sasa_sd": round(r.sasa_sd, 3),
                    "n_layers": r.n_layers,
                    "rel_sasa": "" if r.rel_sasa is None else round(r.rel_sasa, 5),
                })

        # Core/coat is defined per fold, over the union of the protofilaments:
        # a residue ordered in either protofilament is ordered in this fold.
        resolved = frozenset(
            r.resno for f in folds_sasa for r in f.residues
        )
        states = sasa.core_vector(resolved, isoform)
        reasons = sasa.core_vector_reasons(resolved, isoform)
        for i in range(TAU_LENGTH):
            core_rows.append({
                **meta,
                "resno": i + 1,
                "core_state": "" if states[i] is None else int(states[i]),
                "reason": reasons[i],
            })

        for m in MOTIFS:
            frac, n_def, n_tot = sasa.motif_buried_fraction(
                resolved, isoform, m.start, m.end
            )
            motif_rows.append({
                **meta,
                "motif": m.name,
                "start": m.start,
                "end": m.end,
                "frac_buried": "" if frac is None else round(frac, 5),
                "n_defined": n_def,
                "n_total": n_tot,
                "source": m.source,
            })

        if notes:
            all_warnings[pdb_id] = notes
        print(f" {len(folds_sasa)} protofilament(s), "
              f"{len(resolved)} ordered residues"
              + (f", {len(notes)} warning(s)" if notes else ""))

    def write_csv(name: str, rows: list[dict]) -> None:
        path = args.datadir / name
        if not rows:
            print(f"  (no rows for {name})")
            return
        with path.open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"  {path} ({len(rows)} rows)")

    print("\nwritten:")
    write_csv("core_matrix_long.csv", core_rows)
    write_csv("residue_sasa.csv", sasa_rows)
    write_csv("motif_exposure.csv", motif_rows)

    import Bio

    provenance = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        "biopython": Bio.__version__,
        "parameters": {
            "n_trim_per_end": args.n_trim,
            "probe_radius": args.probe_radius,
            "n_points": args.n_points,
            "max_asa_table": "Tien et al. 2013, theoretical",
        },
        "n_folds_requested": len(folds),
        "n_folds_scored": len({r["pdb_id"] for r in sasa_rows}),
        "warnings": all_warnings,
    }
    (args.datadir / "provenance.json").write_text(json.dumps(provenance, indent=2))
    print(f"  {args.datadir / 'provenance.json'}")

    if all_warnings:
        print(f"\n{len(all_warnings)} entry/entries raised warnings -- read them "
              "before using these numbers:")
        for pid, notes in all_warnings.items():
            for n in notes:
                print(f"  {pid}: {n}")

    print("\nNext: analysis/04_validate.Rmd")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

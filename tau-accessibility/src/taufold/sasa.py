"""Per-residue solvent accessibility on a fibril stack.

The calculation follows the brief: run Shrake-Rupley over the *whole*
deposited assembly, then read values off only the central layers. Both halves
matter. Computing on an isolated chain would report a monomer's accessibility
and miss all inter-layer burial, which is most of the point of a fibril;
reading values off the terminal layers would report the artificial faces where
the deposited model was truncated, which no real fibril has.

Note on `n_trim`: the brief says "discard the two terminal layers at each
end". That is read here as two layers *per end* (four dropped in total), which
is the conservative reading. With the commonest deposited chain count of 6,
that leaves 2 central layers; with 10 it leaves 6. The parameter is explicit
in the output so the choice is auditable, and `n_trim=1` is a one-flag change
if you read the brief the other way.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
from Bio.PDB.Model import Model
from Bio.PDB.SASA import ShrakeRupley

from . import pdbparse, tien
from .motifs import TAU_LENGTH, core_state, core_state_reason

DEFAULT_N_TRIM = 2
MIN_COLLINEARITY = 0.95


@dataclass
class ResidueSASA:
    resno: int
    resname: str
    sasa_mean: float
    sasa_sd: float
    n_layers: int
    rel_sasa: float | None


@dataclass
class FoldSASA:
    pdb_id: str
    protofilament: str
    n_trim: int
    n_layers_total: int
    n_layers_used: int
    collinearity: float
    residues: list[ResidueSASA]
    warnings: list[str]


def compute_assembly_sasa(model: Model, probe_radius: float = 1.40,
                          n_points: int = 100) -> None:
    """Annotate every residue in `model` with `.sasa`, in place.

    Computed over the entire model, non-tau chains included: a bound ubiquitin
    or nanobody genuinely occludes tau surface, and excluding it would report
    accessibility for a fibril that was not the one imaged.
    """
    sr = ShrakeRupley(probe_radius=probe_radius, n_points=n_points)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        sr.compute(model, level="R")


def fold_sasa(
    model: Model,
    pdb_id: str,
    n_trim: int = DEFAULT_N_TRIM,
    probe_radius: float = 1.40,
    n_points: int = 100,
) -> list[FoldSASA]:
    """Per-residue SASA for each protofilament of one deposited model."""
    readings = pdbparse.read_chains(model)
    tau_ids = pdbparse.tau_chains(readings)
    if not tau_ids:
        raise pdbparse.FibrilGeometryError(
            f"{pdb_id}: no chain passes the PHF6/2N4R-numbering test; "
            "inspect this entry by hand before including it"
        )

    compute_assembly_sasa(model, probe_radius=probe_radius, n_points=n_points)

    results: list[FoldSASA] = []
    for proto in pdbparse.group_protofilaments(readings, tau_ids):
        notes: list[str] = []
        if len(proto.chain_ids) < 2:
            notes.append(
                f"protofilament {proto.label} has a single chain; no stack, "
                "terminal-layer trim not applied"
            )
            used = list(proto.chain_ids)
            ordering_collinearity = float("nan")
            n_total = len(proto.chain_ids)
            applied_trim = 0
        else:
            ordering = pdbparse.order_layers(readings, proto)
            ordering_collinearity = ordering.collinearity
            n_total = len(ordering.chain_ids)
            if ordering.collinearity < MIN_COLLINEARITY:
                notes.append(
                    f"layer centroids only {ordering.collinearity:.3f} collinear "
                    f"(<{MIN_COLLINEARITY}); these chains may not be a simple stack"
                )
            used = ordering.central(n_trim)
            applied_trim = n_trim
            if not used:
                # Too few layers to trim as asked. Reduce rather than fail, and
                # say so loudly in the output so it cannot pass unnoticed.
                fallback = max(0, (n_total - 1) // 2)
                used = ordering.central(fallback)
                applied_trim = fallback
                notes.append(
                    f"only {n_total} layers: requested n_trim={n_trim} would "
                    f"leave none, reduced to {applied_trim}"
                )

        per_residue: dict[int, list[float]] = {}
        resnames: dict[int, str] = {}
        for cid in used:
            for res in readings[cid].residues:
                resno = res.id[1]
                per_residue.setdefault(resno, []).append(float(res.sasa))
                resnames[resno] = res.get_resname()

        residues = []
        for resno in sorted(per_residue):
            vals = np.array(per_residue[resno], dtype=float)
            resname = resnames[resno]
            denom = tien.max_asa(resname)
            if denom is None:
                notes.append(
                    f"residue {resname}{resno}: no Tien maximum, rel_sasa left empty"
                )
            residues.append(
                ResidueSASA(
                    resno=resno,
                    resname=resname,
                    sasa_mean=float(vals.mean()),
                    sasa_sd=float(vals.std(ddof=0)),
                    n_layers=int(vals.size),
                    rel_sasa=None if denom is None else float(vals.mean() / denom),
                )
            )

        for cid in proto.chain_ids:
            r = readings[cid]
            if r.insertion_coded:
                notes.append(
                    f"chain {cid}: {len(r.insertion_coded)} insertion-coded "
                    f"residues excluded {r.insertion_coded[:5]}"
                )
            if r.altloc_residues:
                notes.append(
                    f"chain {cid}: altlocs at {r.altloc_residues[:5]} "
                    "(selected conformer used)"
                )
            if not r.is_contiguous():
                notes.append(f"chain {cid}: resolved residues are not contiguous")

        results.append(
            FoldSASA(
                pdb_id=pdb_id,
                protofilament=proto.label,
                n_trim=applied_trim,
                n_layers_total=n_total,
                n_layers_used=len(used),
                collinearity=ordering_collinearity,
                residues=residues,
                warnings=notes,
            )
        )
    return results


def core_vector(
    resolved: frozenset[int], isoform: str
) -> list[float | None]:
    """441-long three-valued core/coat vector: 1 buried, 0 exposed, None undefined.

    See `motifs` for why the third value is not optional.
    """
    return [core_state(r, resolved, isoform) for r in range(1, TAU_LENGTH + 1)]


def core_vector_reasons(resolved: frozenset[int], isoform: str) -> list[str]:
    return [core_state_reason(r, resolved, isoform) for r in range(1, TAU_LENGTH + 1)]


def motif_buried_fraction(
    resolved: frozenset[int], isoform: str, start: int, end: int
) -> tuple[float | None, int, int]:
    """Fraction of a motif's *defined* residues that are in the ordered core.

    Returns (fraction, n_defined, n_total). The fraction is None when no
    residue in the span is defined for this isoform -- the Pick's/PHF6* case.
    Dividing by the number of defined residues rather than the span length is
    the whole correction: it keeps a 3R fold from scoring a 4R-only motif.
    """
    states = [core_state(r, resolved, isoform) for r in range(start, end + 1)]
    defined = [s for s in states if s is not None]
    n_total = len(states)
    if not defined:
        return None, 0, n_total
    return float(sum(defined) / len(defined)), len(defined), n_total

"""Robust extraction of fibril geometry from a deposited cryo-EM model.

Everything in the brief's "Things that will go wrong" list lives here:
insertion codes, altlocs, non-tau chains, and asymmetric protofilaments. The
design rule throughout is that an ambiguous entry is *flagged*, never guessed:
a wrong silent answer costs more than a stopped pipeline.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from Bio.PDB import MMCIFParser, PDBParser
from Bio.PDB.Chain import Chain
from Bio.PDB.Model import Model
from Bio.PDB.Residue import DisorderedResidue, Residue

# PHF6, the R3 hexapeptide. Present in every tau isoform, so it is a reliable
# positive marker for "this chain is tau" without needing a network lookup.
PHF6 = "VQIVYK"
PHF6_START = 306

THREE_TO_ONE = {
    "ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C",
    "GLU": "E", "GLN": "Q", "GLY": "G", "HIS": "H", "ILE": "I",
    "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P",
    "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V",
    "MSE": "M", "SEP": "S", "TPO": "T", "PTR": "Y", "HYP": "P",
}


class FibrilGeometryError(RuntimeError):
    """The model does not match an assumption the pipeline depends on."""


@dataclass
class ChainReading:
    """What one chain of one deposited model contains."""

    chain_id: str
    residues: list[Residue]
    insertion_coded: list[tuple[int, str]] = field(default_factory=list)
    altloc_residues: list[int] = field(default_factory=list)

    @property
    def resnos(self) -> list[int]:
        return [r.id[1] for r in self.residues]

    @property
    def signature(self) -> tuple[tuple[int, str], ...]:
        """Identity of this chain: its (resno, resname) content.

        Two chains with the same signature are the same molecule in the same
        register -- i.e. stacked layers of one protofilament. Two chains with
        different signatures are NOT interchangeable, which is the asymmetric
        protofilament case.
        """
        return tuple((r.id[1], r.get_resname()) for r in self.residues)

    @property
    def sequence(self) -> str:
        return "".join(THREE_TO_ONE.get(r.get_resname(), "X") for r in self.residues)

    def is_contiguous(self) -> bool:
        nos = self.resnos
        return bool(nos) and nos == list(range(min(nos), max(nos) + 1))

    def looks_like_tau(self) -> bool:
        """Positive identification by the PHF6 motif, with a numbering check.

        Returns True only if residues 306-311 are present, standard, and spell
        VQIVYK. That simultaneously confirms the chain is tau and that the
        model uses 2N4R numbering -- the brief's step-2 sanity check, done
        from the coordinates rather than from the deposition text.
        """
        by_no = {r.id[1]: r.get_resname() for r in self.residues}
        got = "".join(
            THREE_TO_ONE.get(by_no.get(n, ""), "?")
            for n in range(PHF6_START, PHF6_START + len(PHF6))
        )
        return got == PHF6


def _read_chain(chain: Chain) -> ChainReading:
    residues: list[Residue] = []
    insertion_coded: list[tuple[int, str]] = []
    altloc_residues: list[int] = []

    for res in chain:
        hetflag, resseq, icode = res.id
        if hetflag.strip():
            # Waters, ligands, ions, and any other non-polymer heteroatom.
            continue
        if isinstance(res, DisorderedResidue):
            # Same position modelled as two different residue types. Take the
            # selected (highest-occupancy) child, and record it.
            res = res.disordered_get()
            altloc_residues.append(resseq)
        elif res.is_disordered():
            # Standard residue carrying altloc atoms. Bio.PDB yields the
            # selected altloc from get_atoms(), which is what we want, but the
            # entry is worth recording.
            altloc_residues.append(resseq)
        if icode.strip():
            insertion_coded.append((resseq, icode))
            continue  # cannot be keyed by resno alone; excluded deliberately
        residues.append(res)

    residues.sort(key=lambda r: r.id[1])
    return ChainReading(
        chain_id=chain.id,
        residues=residues,
        insertion_coded=insertion_coded,
        altloc_residues=sorted(set(altloc_residues)),
    )


def load_model(path: str | Path, structure_id: str = "x") -> Model:
    """Parse a .cif or .pdb file and return its first model."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix in {".cif", ".mmcif"}:
        parser: MMCIFParser | PDBParser = MMCIFParser(QUIET=True)
    elif suffix in {".pdb", ".ent"}:
        parser = PDBParser(QUIET=True)
    else:
        raise ValueError(f"unsupported structure format: {path.name}")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        structure = parser.get_structure(structure_id, str(path))
    models = list(structure)
    if not models:
        raise FibrilGeometryError(f"{path.name}: no model in file")
    return models[0]


def read_chains(model: Model) -> dict[str, ChainReading]:
    readings = {}
    for chain in model:
        reading = _read_chain(chain)
        if reading.residues:
            readings[chain.id] = reading
    return readings


def tau_chains(readings: dict[str, ChainReading]) -> list[str]:
    """Chain ids positively identified as tau in 2N4R numbering.

    Non-tau polymer chains -- ubiquitin, nanobodies, bound peptides -- fail
    the PHF6 test and are dropped. They still take part in the SASA
    calculation, because they really do occlude surface; they just are not
    scored.
    """
    return sorted(cid for cid, r in readings.items() if r.looks_like_tau())


@dataclass
class Protofilament:
    """One set of chains that are genuinely interchangeable stacked layers."""

    signature: tuple[tuple[int, str], ...]
    chain_ids: list[str]

    @property
    def resnos(self) -> list[int]:
        return [resno for resno, _ in self.signature]

    @property
    def label(self) -> str:
        return "/".join(self.chain_ids)


def group_protofilaments(
    readings: dict[str, ChainReading], chain_ids: list[str]
) -> list[Protofilament]:
    """Group chains by exact (resno, resname) content.

    This is the asymmetric-protofilament guard. AD PHF is the canonical case:
    two C-shaped protofilaments related by a 2-1 screw axis. Collapsing them
    by taking chain[0] silently analyses one protofilament and discards the
    other -- and PHF versus SF is precisely a protofilament-packing
    difference, so that error erases a distinction the study is built on.
    """
    groups: dict[tuple[tuple[int, str], ...], list[str]] = {}
    for cid in chain_ids:
        groups.setdefault(readings[cid].signature, []).append(cid)
    out = [
        Protofilament(signature=sig, chain_ids=sorted(cids))
        for sig, cids in groups.items()
    ]
    # Deterministic order: most populated first, then by first chain id.
    out.sort(key=lambda p: (-len(p.chain_ids), p.chain_ids[0]))
    return out


def chain_centroid(reading: ChainReading) -> np.ndarray:
    coords = np.array(
        [a.coord for r in reading.residues for a in r.get_atoms()], dtype=float
    )
    if coords.size == 0:
        raise FibrilGeometryError(f"chain {reading.chain_id}: no atoms")
    return coords.mean(axis=0)


def fibril_axis(centroids: np.ndarray) -> np.ndarray:
    """Unit vector along the stacking direction, from PCA of layer centroids.

    Layers of a fibril are translated along the helical axis, so their
    centroids are near-collinear and the first principal component recovers
    that axis without needing symmetry metadata from the deposition.
    """
    if centroids.shape[0] < 2:
        raise FibrilGeometryError("need at least 2 layers to define an axis")
    centred = centroids - centroids.mean(axis=0)
    _, _, vt = np.linalg.svd(centred, full_matrices=False)
    axis = vt[0]
    return axis / np.linalg.norm(axis)


@dataclass
class LayerOrdering:
    chain_ids: list[str]
    projections: list[float]
    axis: np.ndarray
    collinearity: float

    def central(self, n_trim: int) -> list[str]:
        """Chains remaining after dropping `n_trim` layers from *each* end."""
        if n_trim < 0:
            raise ValueError("n_trim must be >= 0")
        if 2 * n_trim >= len(self.chain_ids):
            return []
        return self.chain_ids[n_trim : len(self.chain_ids) - n_trim]


def order_layers(
    readings: dict[str, ChainReading], proto: Protofilament
) -> LayerOrdering:
    """Order one protofilament's chains along the fibril axis, end to end."""
    cids = proto.chain_ids
    centroids = np.array([chain_centroid(readings[c]) for c in cids])
    axis = fibril_axis(centroids)
    centred = centroids - centroids.mean(axis=0)
    proj = centred @ axis

    # How well do the centroids actually lie on a line? Fraction of variance
    # on the first principal component. A stack of fibril layers should be
    # >0.95; much less means these chains are not a simple stack and the
    # terminal-layer trim is not meaningful.
    sq = (centred**2).sum()
    collinearity = float((proj**2).sum() / sq) if sq > 0 else 1.0

    order = np.argsort(proj)
    return LayerOrdering(
        chain_ids=[cids[i] for i in order],
        projections=[float(proj[i]) for i in order],
        axis=axis,
        collinearity=collinearity,
    )

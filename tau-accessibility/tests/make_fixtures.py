"""Generate synthetic fibril PDB files that exercise each known failure mode.

These are deliberately crude geometrically -- extended backbones on a line,
layers translated along z -- because what is being tested is the bookkeeping:
chain grouping, layer ordering, terminal-layer trimming, residue filtering and
isoform logic. They are not a physical model of a fibril and no number derived
from them means anything biologically.

The one physical property they do reproduce, and which the tests assert, is
that layers at the ends of a finite stack expose more surface than layers in
the middle. That is the entire justification for discarding terminal layers,
so it is worth having a test that would fail if the trimming were wrong.
"""

from __future__ import annotations

from pathlib import Path

from Bio.PDB import PDBIO, StructureBuilder

# Tau R3, residues 306-325 in 2N4R numbering. Starts with PHF6 (VQIVYK).
TAU_306_325 = "VQIVYKPVDLSKVTSKCGSL"
ONE_TO_THREE = {
    "A": "ALA", "R": "ARG", "N": "ASN", "D": "ASP", "C": "CYS",
    "E": "GLU", "Q": "GLN", "G": "GLY", "H": "HIS", "I": "ILE",
    "L": "LEU", "K": "LYS", "M": "MET", "F": "PHE", "P": "PRO",
    "S": "SER", "T": "THR", "W": "TRP", "Y": "TYR", "V": "VAL",
}

LAYER_RISE = 4.8  # A, roughly the beta-strand stacking distance in a fibril
RESIDUE_STEP = 3.4  # A along the chain


def _add_residue(builder, resname: str, resseq: int, x: float, z: float,
                 icode: str = " ") -> None:
    builder.init_residue(resname, " ", resseq, icode)
    # Minimal backbone plus one side-chain pseudo-atom. Elements must be set:
    # Shrake-Rupley looks up van der Waals radii by element.
    atoms = [
        ("N", (x - 1.2, 0.0, z), "N"),
        ("CA", (x, 0.0, z), "C"),
        ("C", (x + 1.2, 0.0, z), "C"),
        ("O", (x + 1.4, 1.1, z), "O"),
    ]
    if resname != "GLY":
        atoms.append(("CB", (x, 1.5, z), "C"))
    for name, coord, element in atoms:
        builder.init_atom(name, coord, 20.0, 1.0, " ", name, element=element)


def _build(chains: dict[str, tuple[str, int, float]], path: Path,
           insertion_in: str | None = None) -> None:
    """chains maps chain_id -> (sequence, first_resno, z_offset)."""
    builder = StructureBuilder.StructureBuilder()
    builder.init_structure("fix")
    builder.init_model(0)
    for chain_id, (seq, first, z) in chains.items():
        builder.init_chain(chain_id)
        builder.init_seg(" ")
        for i, aa in enumerate(seq):
            _add_residue(builder, ONE_TO_THREE[aa], first + i, RESIDUE_STEP * i, z)
        if insertion_in == chain_id:
            # A residue sharing resseq with its predecessor via an insertion
            # code -- cannot be keyed by resno alone.
            _add_residue(
                builder, "GLY", first + len(seq) - 1,
                RESIDUE_STEP * len(seq), z, icode="A",
            )
    io = PDBIO()
    io.set_structure(builder.get_structure())
    io.save(str(path))


def write_all(outdir: Path) -> dict[str, Path]:
    outdir.mkdir(parents=True, exist_ok=True)
    made: dict[str, Path] = {}

    # 1. Six identical stacked layers: the common case.
    p = outdir / "symmetric_6layer.pdb"
    _build(
        {cid: (TAU_306_325, 306, LAYER_RISE * i)
         for i, cid in enumerate("ABCDEF")},
        p,
    )
    made["symmetric_6layer"] = p

    # 2. Asymmetric: two protofilaments with genuinely different content.
    #    A/C/E span 306-325; B/D/F span 306-321 only.
    p = outdir / "asymmetric_2proto.pdb"
    _build(
        {
            "A": (TAU_306_325, 306, 0.0),
            "C": (TAU_306_325, 306, LAYER_RISE),
            "E": (TAU_306_325, 306, LAYER_RISE * 2),
            "B": (TAU_306_325[:16], 306, 0.0),
            "D": (TAU_306_325[:16], 306, LAYER_RISE),
            "F": (TAU_306_325[:16], 306, LAYER_RISE * 2),
        },
        p,
    )
    made["asymmetric_2proto"] = p

    # 3. A non-tau chain in the assembly (stand-in for ubiquitin/nanobody).
    p = outdir / "with_nontau.pdb"
    chains = {cid: (TAU_306_325, 306, LAYER_RISE * i)
              for i, cid in enumerate("ABCD")}
    chains["U"] = ("GGGAAAGGGAAA", 1, LAYER_RISE * 1.5)
    _build(chains, p)
    made["with_nontau"] = p

    # 4. Insertion codes present in an otherwise normal stack.
    p = outdir / "insertion_codes.pdb"
    _build(
        {cid: (TAU_306_325, 306, LAYER_RISE * i)
         for i, cid in enumerate("ABCD")},
        p,
        insertion_in="A",
    )
    made["insertion_codes"] = p

    # 5. Wrong numbering: right length, but 306-311 does not spell VQIVYK.
    #    Must fail the tau test rather than be analysed in the wrong register.
    p = outdir / "bad_numbering.pdb"
    _build(
        {cid: (TAU_306_325, 272, LAYER_RISE * i)
         for i, cid in enumerate("ABCD")},
        p,
    )
    made["bad_numbering"] = p

    return made


if __name__ == "__main__":
    here = Path(__file__).parent / "fixtures"
    for name, path in write_all(here).items():
        print(f"{name}: {path}")

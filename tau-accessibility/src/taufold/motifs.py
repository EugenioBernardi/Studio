"""Tau domain and motif boundaries in 2N4R numbering, with isoform logic.

All coordinates are 1-based inclusive, against the 441-residue 2N4R isoform
of human MAPT (UniProt P10636-8).

VERIFY BEFORE PUBLICATION. Every boundary below is transcribed from the
literature and carries a `source` string. The brief is explicit: extend as you
read, do not invent boundaries. Treat an un-cited row as a bug.

----------------------------------------------------------------------------
Why this module exists at all: the isoform trap
----------------------------------------------------------------------------
The obvious way to build the core/coat vector is

    in_core = [1 if r in resolved else 0 for r in range(1, 442)]

which is what a first pass naturally writes. It is wrong, and quietly so.

A 0 in that vector means two different things that must not be averaged
together:

  (a) the residue is present in this tau molecule but not ordered in the
      fibril core -- i.e. it is in the fuzzy coat, exposed, available to bind
      a partner; and
  (b) the residue does not exist in this molecule at all, because the isoform
      lacks the exon encoding it.

Case (b) is not accessibility. It is absence. Scoring it as 0 alongside (a)
inflates "exposed" for exactly the regions that distinguish the isoforms --
and the 3R/4R split is one of the primary axes separating tauopathy folds
(Pick's is 3R; CBD, PSP, GGT, AGD are 4R; AD and CTE are 3R+4R). So the error
is not random noise: it is correlated with the disease grouping the analysis
is trying to explain, which is the worst possible place for it.

The concrete case: PHF6* (VQIINK, 275-280) lies inside R2, encoded by exon 10.
In a 3R fold such as Pick's, residues 275-305 are simply not in the protein.
"PHF6* is 100% exposed in Pick's disease" would be a claim about a peptide
that is not there. Here it is NA.

Mixed 3R+4R filaments (AD, CTE) are a third case: R2 is present in the 4R
protomers and absent in the 3R ones. If an R2 residue is resolved in the
deposited model, it is ordered (1). If it is not resolved, you cannot tell
exposure from absence -- so that is NA with a recorded reason, not 0.
"""

from __future__ import annotations

from dataclasses import dataclass

TAU_LENGTH = 441  # 2N4R, UniProt P10636-8

# --------------------------------------------------------------------------
# Exon-encoded segments that are spliced out in shorter isoforms.
# Boundaries follow the standard 2N4R annotation of MAPT alternative splicing
# (Goedert et al. 1989, Neuron 3:519-526; Andreadis et al. 1992,
# Biochemistry 31:10626-10633). VERIFY.
# --------------------------------------------------------------------------
N1_EXON2 = (45, 102)  # exon 2 -- absent in 0N
N2_EXON3 = (103, 119)  # exon 3 -- absent in 0N and 1N
R2_EXON10 = (275, 305)  # exon 10 -- absent in 3R


@dataclass(frozen=True)
class Motif:
    """A named sequence region in 2N4R numbering."""

    name: str
    start: int
    end: int
    source: str

    def residues(self) -> range:
        return range(self.start, self.end + 1)


# Recognition motifs and domains named in the brief, each cited.
MOTIFS: tuple[Motif, ...] = (
    Motif(
        "PHF6*_VQIINK",
        275,
        280,
        "von Bergen et al. 2001 PNAS 98:5129 -- hexapeptide amyloid motif, R2",
    ),
    Motif(
        "PHF6_VQIVYK",
        306,
        311,
        "von Bergen et al. 2000 PNAS 97:5129 -- hexapeptide amyloid motif, R3",
    ),
    Motif(
        "Nterm_acidic",
        2,
        50,
        "Nachman et al. 2020 JBC 295:9676 -- DnaJB1 recognition; fuzzy coat",
    ),
    Motif(
        "PRD",
        151,
        243,
        "Goedert et al. 1989 Neuron 3:519 -- proline-rich domain",
    ),
    Motif("R1", 244, 274, "standard MAPT repeat annotation -- VERIFY"),
    Motif("R2", 275, 305, "standard MAPT repeat annotation, exon 10 -- VERIFY"),
    Motif("R3", 306, 336, "standard MAPT repeat annotation -- VERIFY"),
    Motif("R4", 337, 368, "standard MAPT repeat annotation -- VERIFY"),
    Motif("R_prime", 369, 399, "pseudo-repeat C-terminal to R4 -- VERIFY"),
)

MOTIFS_BY_NAME: dict[str, Motif] = {m.name: m for m in MOTIFS}

# Isoform labels accepted in data/folds.csv. "3R+4R" means the filament
# contains both populations (AD, CTE); it is not the same as "unknown".
VALID_ISOFORMS = frozenset({"3R", "4R", "3R+4R", "unknown"})


def _in_range(resno: int, span: tuple[int, int]) -> bool:
    return span[0] <= resno <= span[1]


def repeat_isoform(isoform: str) -> str:
    """Normalise an isoform label, raising on anything unrecognised."""
    key = isoform.strip().replace("/", "+").replace(" ", "").upper()
    key = {"3R+4R": "3R+4R", "4R+3R": "3R+4R"}.get(key, key)
    if key not in VALID_ISOFORMS:
        raise ValueError(
            f"unrecognised isoform {isoform!r}; expected one of {sorted(VALID_ISOFORMS)}"
        )
    return key


def encoded_in_isoform(resno: int, isoform: str) -> bool | None:
    """Is this residue encoded by the given isoform?

    Returns True (present), False (spliced out), or None (present in some
    protomers only, i.e. a mixed 3R+4R filament in the R2 region).

    Only the repeat-domain splice (exon 10 / R2) is resolved here. The
    N-terminal inserts are not encoded in the 3R/4R label at all, so a label
    of "4R" says nothing about N1/N2; use `encoded_in_nterm_isoform` with an
    explicit 0N/1N/2N label when the N-terminus matters. For brain-derived
    tauopathy filaments every deposited core lies C-terminal to ~250, so the
    N-terminal inserts never affect the ordered core -- but they do affect any
    claim about fuzzy-coat composition.
    """
    iso = repeat_isoform(isoform)
    if not _in_range(resno, R2_EXON10):
        return True
    if iso == "4R":
        return True
    if iso == "3R":
        return False
    if iso == "3R+4R":
        return None  # present in the 4R population only
    return None  # unknown


def encoded_in_nterm_isoform(resno: int, nterm: str) -> bool:
    """Is this residue encoded, given an explicit 0N/1N/2N label?"""
    key = nterm.strip().upper()
    if key not in {"0N", "1N", "2N"}:
        raise ValueError(f"expected 0N, 1N or 2N, got {nterm!r}")
    if key == "2N":
        return True
    if _in_range(resno, N2_EXON3):
        return False
    if key == "0N" and _in_range(resno, N1_EXON2):
        return False
    return True


def core_state(resno: int, resolved: frozenset[int], isoform: str) -> float | None:
    """Three-valued core/coat state for one residue of one fold.

    1.0  -- resolved in the deposited model: ordered core, buried
    0.0  -- encoded by this isoform but unresolved: fuzzy coat, exposed
    None -- not encoded, or encoded in only part of the protomer population
            and unresolved; accessibility is undefined, not zero

    Note the asymmetry for mixed filaments: *resolved* always wins. If an R2
    residue is modelled in an AD filament then it is ordered, whatever the
    protomer mixture, because the density is there.
    """
    if resno in resolved:
        return 1.0
    enc = encoded_in_isoform(resno, isoform)
    if enc is True:
        return 0.0
    return None


def core_state_reason(resno: int, resolved: frozenset[int], isoform: str) -> str:
    """Audit string explaining the value `core_state` returned."""
    if resno in resolved:
        return "resolved_in_model"
    enc = encoded_in_isoform(resno, isoform)
    if enc is True:
        return "encoded_unresolved"
    if enc is False:
        return "not_encoded_3R_lacks_exon10"
    return "ambiguous_mixed_isoform_R2"

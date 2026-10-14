"""Theoretical maximum solvent accessibility per residue type.

Source: Tien MZ, Meyer AG, Sydykova DK, Spielman SJ, Wilke CO (2013)
"Maximum allowed solvent accessibilites of residues in proteins."
PLoS ONE 8(11): e80635. doi:10.1371/journal.pone.0080635

Values below are the *theoretical* column of that paper's Table 1 (Gly-X-Gly
tripeptide, extended conformation), in square angstroms. The paper also reports
an *empirical* column derived from observed structures; the brief specifies
theoretical, so that is the default here.

VERIFY BEFORE PUBLICATION. These are transcribed from the literature, not
computed. Spot-check at least Ala (129), Trp (285) and Gly (104) against
Table 1 of the paper itself before any number derived from them goes into a
figure. A transcription error here rescales every relative-SASA value.
"""

from __future__ import annotations

# Three-letter code -> theoretical maximum ASA in A^2 (Tien et al. 2013, Table 1)
MAX_ASA_THEORETICAL: dict[str, float] = {
    "ALA": 129.0,
    "ARG": 274.0,
    "ASN": 195.0,
    "ASP": 193.0,
    "CYS": 167.0,
    "GLU": 223.0,
    "GLN": 225.0,
    "GLY": 104.0,
    "HIS": 224.0,
    "ILE": 197.0,
    "LEU": 201.0,
    "LYS": 236.0,
    "MET": 224.0,
    "PHE": 240.0,
    "PRO": 159.0,
    "SER": 155.0,
    "THR": 172.0,
    "TRP": 285.0,
    "TYR": 263.0,
    "VAL": 174.0,
}

# Common modified/alternate residue names seen in deposited models, mapped to
# their parent type so relative SASA stays defined. Extend deliberately, and
# record any addition in the curation notes for the affected entry.
PARENT_RESIDUE: dict[str, str] = {
    "MSE": "MET",  # selenomethionine
    "SEP": "SER",  # phosphoserine
    "TPO": "THR",  # phosphothreonine
    "PTR": "TYR",  # phosphotyrosine
    "HIC": "HIS",
    "CSO": "CYS",
    "HYP": "PRO",
}


def max_asa(resname: str) -> float | None:
    """Theoretical maximum ASA for a residue name, or None if unknown.

    Returns None rather than raising or guessing: an unknown residue must
    propagate as a missing value, not as a silently wrong denominator.
    """
    key = resname.strip().upper()
    if key in MAX_ASA_THEORETICAL:
        return MAX_ASA_THEORETICAL[key]
    parent = PARENT_RESIDUE.get(key)
    if parent is not None:
        return MAX_ASA_THEORETICAL[parent]
    return None

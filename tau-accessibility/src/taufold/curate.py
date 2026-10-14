"""Step 2 -- curation support, and the folds.csv contract.

The brief is explicit that this step must not be automated blindly, and that
is respected here: nothing in this module decides what enters the analysis.

The division of labour is

  * `screen_entries` assembles *evidence* -- title, keywords, source method,
    organism, resolution, citation DOI, chain counts -- and raises flags. It
    writes `data/folds_candidates.csv`, which is a worklist, not a result.
  * a human reads each candidate's primary citation and writes `data/folds.csv`
    by hand. That file is the audit trail.
  * `validate_folds` then refuses to let a malformed or unsourced folds.csv
    into the pipeline.

The keyword screen is a starting point and is deliberately noisy in the safe
direction: it over-flags. A heparin-induced filament that reaches the analysis
is a wrong result; a brain-derived filament wrongly flagged costs one citation
check. So the patterns below are tuned to catch, not to be right.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from .motifs import VALID_ISOFORMS, repeat_isoform

# Markers of a synthetic or in-vitro filament. These do not adopt disease
# folds and must not enter the analysis.
RECOMBINANT_PATTERNS: tuple[tuple[str, str], ...] = (
    ("recombinant", r"\brecombinant\b"),
    ("heparin", r"\bheparin\b"),
    ("in_vitro", r"\bin[-\s]?vitro\b"),
    ("synthetic", r"\bsynthetic\b"),
    ("peptide_fragment", r"\bpeptide\b|\bfragment\b|\bhexapeptide\b"),
    ("rna_induced", r"\bRNA[-\s]?induced\b|\bpolyU\b"),
    ("phosphomimetic", r"\bphosphomimetic\b|\bpseudo[-\s]?phospho"),
    ("seeded_invitro", r"\bseeded\b.*\bin[-\s]?vitro\b"),
    ("construct", r"\bK18\b|\bK19\b|\bdGAE\b|\bjR2R3\b|\btruncat"),
    ("cofactor", r"\bpolyanion\b|\bpolyphosphate\b|\barachidonic\b"),
)

# Markers that the filament came out of brain. Supportive, never sufficient.
BRAIN_PATTERNS: tuple[tuple[str, str], ...] = (
    ("ex_vivo", r"\bex[-\s]?vivo\b"),
    ("brain_derived", r"\bbrain[-\s]?derived\b|\bfrom\s+(human\s+)?brain\b"),
    ("post_mortem", r"\bpost[-\s]?mortem\b|\bautops"),
    ("patient", r"\bpatient\b|\bcase\b.*\bbrain\b"),
    ("sarkosyl", r"\bsarkosyl\b"),  # the standard brain extraction protocol
)

DISEASES = (
    "AD", "CTE", "PiD", "CBD", "PSP", "AGD", "GGT", "GPT", "LNT", "PART",
)
FAMILIAL_VARIANTS = ("P301L", "P301T", "V337M", "R406W", "S305I", "S305N", "K317M")

FOLDS_COLUMNS = (
    "pdb_id", "disease", "fold_label", "isoform", "source",
    "doi", "n_chains", "resolution", "notes",
)


def _joined_text(entry: dict[str, Any]) -> str:
    """All free text in an entry, lowercased, for keyword screening."""
    bits: list[str] = []
    struct = entry.get("struct") or {}
    bits += [struct.get("title") or "", struct.get("pdbx_descriptor") or ""]
    kw = entry.get("struct_keywords") or {}
    bits += [kw.get("pdbx_keywords") or "", kw.get("text") or ""]
    for cit in entry.get("citation") or []:
        bits.append(cit.get("title") or "")
    for pe in entry.get("polymer_entities") or []:
        desc = (pe.get("rcsb_polymer_entity") or {}).get("pdbx_description") or ""
        bits.append(desc)
    return " ".join(bits).lower()


def match_patterns(text: str, patterns: Iterable[tuple[str, str]]) -> list[str]:
    return [name for name, pat in patterns if re.search(pat, text, re.IGNORECASE)]


def src_methods(entry: dict[str, Any]) -> list[str]:
    """Deposited source method per polymer entity ('man' = recombinant, 'nat' = native).

    More reliable than title text when present, because it is a controlled
    vocabulary field. Still not decisive: depositors are inconsistent.
    """
    out = []
    for pe in entry.get("polymer_entities") or []:
        m = (pe.get("rcsb_polymer_entity") or {}).get("src_method")
        if m:
            out.append(m)
    return out


def primary_doi(entry: dict[str, Any]) -> str | None:
    for cit in entry.get("citation") or []:
        if cit.get("id") == "primary" and cit.get("pdbx_database_id_DOI"):
            return cit["pdbx_database_id_DOI"]
    for cit in entry.get("citation") or []:
        if cit.get("pdbx_database_id_DOI"):
            return cit["pdbx_database_id_DOI"]
    return None


def mapt_chain_ids(entry: dict[str, Any]) -> list[str]:
    """auth chain ids of the polymer entities cross-referenced to P10636."""
    out: list[str] = []
    for pe in entry.get("polymer_entities") or []:
        ids = pe.get("rcsb_polymer_entity_container_identifiers") or {}
        refs = ids.get("reference_sequence_identifiers") or []
        if any(r.get("database_accession") == "P10636" for r in refs):
            out += ids.get("auth_asym_ids") or []
    return sorted(set(out))


@dataclass
class Candidate:
    """One entry's evidence, for a human to accept or reject."""

    pdb_id: str
    title: str
    release_date: str | None
    resolution: float | None
    n_chains: int | None
    n_mapt_chains: int
    doi: str | None
    src_methods: str
    organisms: str
    recombinant_flags: list[str] = field(default_factory=list)
    brain_flags: list[str] = field(default_factory=list)

    @property
    def verdict(self) -> str:
        """A *suggestion*, never a decision. Three outcomes, all needing eyes."""
        if self.recombinant_flags and not self.brain_flags:
            return "likely_exclude"
        if self.brain_flags and not self.recombinant_flags:
            return "likely_include"
        return "needs_citation_check"

    def as_row(self) -> dict[str, Any]:
        return {
            "pdb_id": self.pdb_id,
            "verdict": self.verdict,
            "recombinant_flags": ";".join(self.recombinant_flags),
            "brain_flags": ";".join(self.brain_flags),
            "src_methods": self.src_methods,
            "resolution": self.resolution,
            "n_chains": self.n_chains,
            "n_mapt_chains": self.n_mapt_chains,
            "organisms": self.organisms,
            "release_date": self.release_date,
            "doi": self.doi,
            "title": self.title,
        }


def screen_entry(entry: dict[str, Any]) -> Candidate:
    text = _joined_text(entry)
    info = entry.get("rcsb_entry_info") or {}
    res = info.get("resolution_combined") or []
    organisms = sorted(
        {
            (o or {}).get("scientific_name") or ""
            for pe in entry.get("polymer_entities") or []
            for o in pe.get("rcsb_entity_source_organism") or []
        }
        - {""}
    )
    return Candidate(
        pdb_id=entry.get("rcsb_id", "?"),
        title=((entry.get("struct") or {}).get("title") or "").strip(),
        release_date=(entry.get("rcsb_accession_info") or {}).get(
            "initial_release_date"
        ),
        resolution=float(res[0]) if res else None,
        n_chains=info.get("deposited_polymer_entity_instance_count"),
        n_mapt_chains=len(mapt_chain_ids(entry)),
        doi=primary_doi(entry),
        src_methods=";".join(sorted(set(src_methods(entry)))),
        organisms=";".join(organisms),
        recombinant_flags=match_patterns(text, RECOMBINANT_PATTERNS),
        brain_flags=match_patterns(text, BRAIN_PATTERNS),
    )


def screen_entries(entries: dict[str, Any]) -> list[Candidate]:
    return sorted(
        (screen_entry(e) for e in entries.values()), key=lambda c: c.pdb_id
    )


def validate_folds(rows: list[dict[str, Any]]) -> list[str]:
    """Check a hand-written folds.csv. Returns a list of problems, empty if clean.

    This is the gate between curation and analysis. Every rule here exists
    because violating it would produce a plausible-looking wrong number.
    """
    problems: list[str] = []
    if not rows:
        return ["folds.csv is empty"]

    missing_cols = sorted(set(FOLDS_COLUMNS) - set(rows[0]))
    if missing_cols:
        problems.append(f"missing columns: {', '.join(missing_cols)}")
        return problems

    seen: dict[tuple[str, str], str] = {}
    for i, row in enumerate(rows, start=2):  # header is line 1
        pid = (row.get("pdb_id") or "").strip().upper()
        where = f"line {i} ({pid or 'no pdb_id'})"

        if not re.fullmatch(r"[0-9][A-Z0-9]{3}", pid):
            problems.append(f"{where}: not a PDB id")

        if not (row.get("doi") or "").strip():
            problems.append(f"{where}: no DOI -- every row carries its citation")

        source = (row.get("source") or "").strip().lower()
        if source != "brain":
            problems.append(
                f"{where}: source={source!r}; only brain-derived filaments may "
                "enter the analysis (hard exclusion in the brief)"
            )

        iso = (row.get("isoform") or "").strip()
        try:
            repeat_isoform(iso)
        except ValueError:
            problems.append(
                f"{where}: isoform={iso!r} not in {sorted(VALID_ISOFORMS)}"
            )

        disease = (row.get("disease") or "").strip()
        if not disease:
            problems.append(f"{where}: no disease label")

        fold = (row.get("fold_label") or "").strip()
        if not fold:
            problems.append(f"{where}: no fold_label -- rows are folds, not entries")

        key = (disease, fold)
        if key in seen:
            problems.append(
                f"{where}: duplicate fold {disease}/{fold}, already at {seen[key]}; "
                "keep one representative entry per distinct fold"
            )
        else:
            seen[key] = pid

        try:
            n = int(row.get("n_chains") or 0)
            if n < 2:
                problems.append(
                    f"{where}: n_chains={n}; a single chain is not a stack and "
                    "cannot support terminal-layer trimming"
                )
        except (TypeError, ValueError):
            problems.append(f"{where}: n_chains not an integer")

        try:
            r = float(row.get("resolution") or "nan")
            if not (0.5 <= r <= 8.0):
                problems.append(f"{where}: resolution {r} outside plausible range")
        except (TypeError, ValueError):
            problems.append(f"{where}: resolution not a number")

    return problems

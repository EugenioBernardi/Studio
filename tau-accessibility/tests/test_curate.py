"""Curation screening and the folds.csv gate."""

from __future__ import annotations

from taufold import curate
from taufold.curate import screen_entry, validate_folds


def make_entry(
    pdb_id="XXXX",
    title="Tau filament",
    description="Microtubule-associated protein tau",
    keywords="PROTEIN FIBRIL",
    citation_title="A paper",
    src_method="nat",
    organism="Homo sapiens",
    resolution=3.0,
    n_chains=6,
    doi="10.1000/x",
    mapt=True,
):
    return {
        "rcsb_id": pdb_id,
        "struct": {"title": title, "pdbx_descriptor": description},
        "rcsb_accession_info": {"initial_release_date": "2023-01-01"},
        "rcsb_entry_info": {
            "resolution_combined": [resolution],
            "deposited_polymer_entity_instance_count": n_chains,
        },
        "struct_keywords": {"pdbx_keywords": keywords, "text": ""},
        "citation": [
            {"id": "primary", "title": citation_title, "pdbx_database_id_DOI": doi}
        ],
        "polymer_entities": [
            {
                "rcsb_polymer_entity": {
                    "pdbx_description": description,
                    "src_method": src_method,
                },
                "rcsb_entity_source_organism": [{"scientific_name": organism}],
                "rcsb_polymer_entity_container_identifiers": {
                    "auth_asym_ids": list("ABCDEF")[:n_chains],
                    "reference_sequence_identifiers": (
                        [{"database_accession": "P10636", "database_name": "UniProt"}]
                        if mapt
                        else []
                    ),
                },
            }
        ],
    }


class TestScreening:
    def test_heparin_flagged_for_exclusion(self):
        c = screen_entry(
            make_entry(title="Heparin-induced tau filament, recombinant 2N4R")
        )
        assert "heparin" in c.recombinant_flags
        assert "recombinant" in c.recombinant_flags
        assert c.verdict == "likely_exclude"

    def test_brain_derived_suggested_for_inclusion(self):
        c = screen_entry(
            make_entry(
                title="Tau filament from Alzheimer's disease brain",
                citation_title="Sarkosyl-insoluble tau from post-mortem cortex",
            )
        )
        assert c.brain_flags
        assert c.verdict == "likely_include"

    def test_mixed_evidence_goes_to_a_human(self):
        # Wording that hits both screens must never be auto-decided.
        c = screen_entry(
            make_entry(
                title="Recombinant tau seeded with brain-derived AD filaments"
            )
        )
        assert c.recombinant_flags and c.brain_flags
        assert c.verdict == "needs_citation_check"

    def test_bare_title_goes_to_a_human(self):
        c = screen_entry(make_entry(title="Tau filament"))
        assert c.verdict == "needs_citation_check"

    def test_construct_names_flagged(self):
        for name in ("K18 tau fibril", "dGAE filament", "truncated tau 297-391"):
            c = screen_entry(make_entry(title=name))
            assert "construct" in c.recombinant_flags, name

    def test_metadata_extracted(self):
        c = screen_entry(make_entry(resolution=2.7, n_chains=10))
        assert c.resolution == 2.7
        assert c.n_chains == 10
        assert c.n_mapt_chains == 6  # auth_asym_ids caps at the letters supplied
        assert c.doi == "10.1000/x"
        assert c.organisms == "Homo sapiens"
        assert c.src_methods == "nat"

    def test_non_mapt_entity_not_counted(self):
        c = screen_entry(make_entry(mapt=False))
        assert c.n_mapt_chains == 0


def good_row(**over):
    row = {
        "pdb_id": "5O3L",
        "disease": "AD",
        "fold_label": "PHF",
        "isoform": "3R+4R",
        "source": "brain",
        "doi": "10.1038/nature23002",
        "n_chains": "6",
        "resolution": "3.4",
        "notes": "Fitzpatrick 2017",
    }
    row.update(over)
    return row


class TestValidateFolds:
    def test_clean_table_passes(self):
        assert validate_folds([good_row()]) == []

    def test_empty_rejected(self):
        assert validate_folds([]) == ["folds.csv is empty"]

    def test_missing_column_reported_once(self):
        row = good_row()
        del row["doi"]
        problems = validate_folds([row])
        assert len(problems) == 1
        assert "missing columns: doi" in problems[0]

    def test_missing_doi_rejected(self):
        problems = validate_folds([good_row(doi="")])
        assert any("no DOI" in p for p in problems)

    def test_recombinant_source_rejected(self):
        problems = validate_folds([good_row(source="recombinant")])
        assert any("brain-derived" in p for p in problems)

    def test_bad_isoform_rejected(self):
        problems = validate_folds([good_row(isoform="2R")])
        assert any("isoform" in p for p in problems)

    def test_isoform_slash_form_accepted(self):
        assert validate_folds([good_row(isoform="3R/4R")]) == []

    def test_duplicate_fold_rejected(self):
        rows = [good_row(), good_row(pdb_id="5O3T")]
        problems = validate_folds(rows)
        assert any("duplicate fold" in p for p in problems)

    def test_distinct_folds_of_one_disease_allowed(self):
        # AD PHF and AD SF are genuinely different folds -- both must be kept.
        rows = [good_row(), good_row(pdb_id="5O3T", fold_label="SF")]
        assert validate_folds(rows) == []

    def test_single_chain_rejected(self):
        problems = validate_folds([good_row(n_chains="1")])
        assert any("not a stack" in p for p in problems)

    def test_implausible_resolution_rejected(self):
        problems = validate_folds([good_row(resolution="42")])
        assert any("resolution" in p for p in problems)

    def test_malformed_pdb_id_rejected(self):
        problems = validate_folds([good_row(pdb_id="NOTANID")])
        assert any("not a PDB id" in p for p in problems)

    def test_missing_fold_label_rejected(self):
        problems = validate_folds([good_row(fold_label="")])
        assert any("rows are folds, not entries" in p for p in problems)


class TestPatternHygiene:
    def test_all_patterns_compile(self):
        import re

        for name, pat in curate.RECOMBINANT_PATTERNS + curate.BRAIN_PATTERNS:
            re.compile(pat)  # raises if malformed

    def test_patterns_do_not_fire_on_empty_text(self):
        assert curate.match_patterns("", curate.RECOMBINANT_PATTERNS) == []
        assert curate.match_patterns("", curate.BRAIN_PATTERNS) == []

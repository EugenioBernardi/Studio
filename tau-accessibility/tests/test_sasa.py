"""Accessibility: the terminal-layer artefact, normalisation, and failure modes."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from taufold import pdbparse, sasa, tien

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module", autouse=True)
def _fixtures_exist():
    if not (FIXTURES / "symmetric_6layer.pdb").exists():
        from make_fixtures import write_all

        write_all(FIXTURES)


class TestTerminalLayerArtefact:
    """The reason the pipeline discards terminal layers at all.

    A deposited fibril is a finite slab. Its end layers have an exposed face
    where the model was truncated; a real fibril continues there. If this test
    ever fails, the justification for trimming is gone and the trim should be
    revisited -- not silently kept.
    """

    def test_end_layers_more_exposed_than_central(self):
        model = pdbparse.load_model(FIXTURES / "symmetric_6layer.pdb", "sym")
        readings = pdbparse.read_chains(model)
        sasa.compute_assembly_sasa(model)

        def chain_mean(cid: str) -> float:
            return float(
                np.mean([r.sasa for r in readings[cid].residues])
            )

        ends = np.mean([chain_mean("A"), chain_mean("F")])
        central = np.mean([chain_mean("C"), chain_mean("D")])
        assert ends > central, (
            f"terminal layers ({ends:.1f} A^2) should expose more surface "
            f"than central ones ({central:.1f} A^2)"
        )


class TestFoldSASA:
    def test_symmetric_yields_one_protofilament(self):
        model = pdbparse.load_model(FIXTURES / "symmetric_6layer.pdb", "sym")
        out = sasa.fold_sasa(model, "sym", n_trim=2)
        assert len(out) == 1
        f = out[0]
        assert f.n_layers_total == 6
        assert f.n_layers_used == 2
        assert f.n_trim == 2

    def test_residues_cover_the_resolved_span(self):
        model = pdbparse.load_model(FIXTURES / "symmetric_6layer.pdb", "sym")
        f = sasa.fold_sasa(model, "sym")[0]
        assert [r.resno for r in f.residues] == list(range(306, 326))

    def test_relative_sasa_normalised(self):
        model = pdbparse.load_model(FIXTURES / "symmetric_6layer.pdb", "sym")
        f = sasa.fold_sasa(model, "sym")[0]
        first = f.residues[0]
        assert first.resname == "VAL"
        expected = first.sasa_mean / tien.max_asa("VAL")
        assert first.rel_sasa == pytest.approx(expected)

    def test_asymmetric_scored_separately(self):
        model = pdbparse.load_model(FIXTURES / "asymmetric_2proto.pdb", "asym")
        out = sasa.fold_sasa(model, "asym", n_trim=1)
        assert len(out) == 2
        assert {f.protofilament for f in out} == {"A/C/E", "B/D/F"}
        # Each had 3 layers; trimming 1 per end leaves the middle one.
        assert all(f.n_layers_used == 1 for f in out)

    def test_overtrim_reduces_and_warns(self):
        model = pdbparse.load_model(FIXTURES / "asymmetric_2proto.pdb", "asym")
        out = sasa.fold_sasa(model, "asym", n_trim=2)
        f = out[0]
        assert f.n_layers_used >= 1, "must not silently produce zero layers"
        assert f.n_trim < 2
        assert any("reduced to" in w for w in f.warnings)

    def test_insertion_codes_warned(self):
        model = pdbparse.load_model(FIXTURES / "insertion_codes.pdb", "ins")
        out = sasa.fold_sasa(model, "ins", n_trim=1)
        notes = " ".join(w for f in out for w in f.warnings)
        assert "insertion-coded" in notes

    def test_nontau_chain_occludes_but_is_not_scored(self):
        model = pdbparse.load_model(FIXTURES / "with_nontau.pdb", "nt")
        out = sasa.fold_sasa(model, "nt", n_trim=1)
        scored = {cid for f in out for cid in f.protofilament.split("/")}
        assert "U" not in scored

    def test_no_tau_chain_raises(self):
        model = pdbparse.load_model(FIXTURES / "bad_numbering.pdb", "bad")
        with pytest.raises(pdbparse.FibrilGeometryError, match="PHF6"):
            sasa.fold_sasa(model, "bad")


class TestTienTable:
    def test_known_values(self):
        assert tien.max_asa("ALA") == 129.0
        assert tien.max_asa("TRP") == 285.0
        assert tien.max_asa("GLY") == 104.0

    def test_modified_residue_maps_to_parent(self):
        assert tien.max_asa("MSE") == tien.max_asa("MET")
        assert tien.max_asa("SEP") == tien.max_asa("SER")

    def test_unknown_returns_none_not_a_guess(self):
        assert tien.max_asa("UNK") is None
        assert tien.max_asa("XYZ") is None

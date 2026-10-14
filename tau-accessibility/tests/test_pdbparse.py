"""Parsing guards: tau identification, protofilament grouping, layer ordering."""

from __future__ import annotations

from pathlib import Path

import pytest

from taufold import pdbparse

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module", autouse=True)
def _fixtures_exist():
    if not (FIXTURES / "symmetric_6layer.pdb").exists():
        from make_fixtures import write_all

        write_all(FIXTURES)


def _read(name: str):
    model = pdbparse.load_model(FIXTURES / f"{name}.pdb", name)
    return model, pdbparse.read_chains(model)


class TestTauIdentification:
    def test_symmetric_all_tau(self):
        _, readings = _read("symmetric_6layer")
        assert pdbparse.tau_chains(readings) == list("ABCDEF")

    def test_nontau_chain_excluded(self):
        _, readings = _read("with_nontau")
        assert "U" in readings  # parsed
        assert pdbparse.tau_chains(readings) == list("ABCD")  # not scored

    def test_wrong_numbering_rejected(self):
        # Same sequence, offset numbering: 306-311 does not spell VQIVYK, so
        # the chain must not be analysed in the wrong register.
        _, readings = _read("bad_numbering")
        assert pdbparse.tau_chains(readings) == []


class TestProtofilaments:
    def test_symmetric_is_one_group(self):
        _, readings = _read("symmetric_6layer")
        protos = pdbparse.group_protofilaments(readings, list("ABCDEF"))
        assert len(protos) == 1
        assert protos[0].chain_ids == list("ABCDEF")

    def test_asymmetric_splits_into_two(self):
        # The AD PHF case: two non-identical protofilaments. Taking chain[0]
        # would silently analyse one and discard the other.
        _, readings = _read("asymmetric_2proto")
        protos = pdbparse.group_protofilaments(readings, list("ABCDEF"))
        assert len(protos) == 2
        assert {p.label for p in protos} == {"A/C/E", "B/D/F"}

    def test_groups_differ_in_content(self):
        _, readings = _read("asymmetric_2proto")
        protos = pdbparse.group_protofilaments(readings, list("ABCDEF"))
        spans = sorted(len(p.signature) for p in protos)
        assert spans == [16, 20]


class TestResidueFiltering:
    def test_insertion_codes_recorded_and_excluded(self):
        _, readings = _read("insertion_codes")
        a = readings["A"]
        assert a.insertion_coded, "insertion code should be recorded"
        assert all(r.id[2] == " " for r in a.residues), "and excluded from residues"

    def test_insertion_code_does_not_collide_on_resno(self):
        _, readings = _read("insertion_codes")
        resnos = readings["A"].resnos
        assert len(resnos) == len(set(resnos)), "resno keys must stay unique"

    def test_contiguity_check(self):
        _, readings = _read("symmetric_6layer")
        assert readings["A"].is_contiguous()

    def test_sequence_reconstruction(self):
        _, readings = _read("symmetric_6layer")
        assert readings["A"].sequence.startswith("VQIVYK")


class TestLayerOrdering:
    def test_ordered_along_axis(self):
        _, readings = _read("symmetric_6layer")
        proto = pdbparse.group_protofilaments(readings, list("ABCDEF"))[0]
        ordering = pdbparse.order_layers(readings, proto)
        # Fixtures stack A..F monotonically in z, so the recovered order must
        # be A..F or its reverse -- the axis sign is arbitrary.
        assert ordering.chain_ids in (list("ABCDEF"), list("FEDCBA"))

    def test_collinearity_high_for_a_stack(self):
        _, readings = _read("symmetric_6layer")
        proto = pdbparse.group_protofilaments(readings, list("ABCDEF"))[0]
        assert pdbparse.order_layers(readings, proto).collinearity > 0.99

    def test_central_trims_both_ends(self):
        _, readings = _read("symmetric_6layer")
        proto = pdbparse.group_protofilaments(readings, list("ABCDEF"))[0]
        ordering = pdbparse.order_layers(readings, proto)
        central = ordering.central(2)
        assert len(central) == 2
        assert set(central) == {"C", "D"}

    def test_central_empty_when_overtrimmed(self):
        _, readings = _read("symmetric_6layer")
        proto = pdbparse.group_protofilaments(readings, list("ABCDEF"))[0]
        ordering = pdbparse.order_layers(readings, proto)
        assert ordering.central(3) == []

    def test_single_chain_has_no_axis(self):
        _, readings = _read("symmetric_6layer")
        proto = pdbparse.Protofilament(
            signature=readings["A"].signature, chain_ids=["A"]
        )
        with pytest.raises(pdbparse.FibrilGeometryError):
            pdbparse.order_layers(readings, proto)

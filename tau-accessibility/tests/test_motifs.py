"""Isoform logic: the three-valued core state, and why 0 is not NA."""

from __future__ import annotations

import pytest

from taufold import motifs
from taufold.motifs import TAU_LENGTH, core_state, encoded_in_isoform
from taufold.sasa import core_vector, motif_buried_fraction

# A plausible 4R core: R2 onward, as seen in CBD/PSP-type folds.
CORE_4R = frozenset(range(274, 380))
# A plausible 3R-containing core: R3 onward, as in the AD PHF (306-378).
CORE_AD = frozenset(range(306, 379))


class TestEncoding:
    def test_r2_absent_in_3r(self):
        assert encoded_in_isoform(280, "3R") is False
        assert encoded_in_isoform(305, "3R") is False

    def test_r2_present_in_4r(self):
        assert encoded_in_isoform(280, "4R") is True

    def test_r2_ambiguous_in_mixed(self):
        assert encoded_in_isoform(280, "3R+4R") is None

    def test_outside_r2_always_encoded(self):
        for iso in ("3R", "4R", "3R+4R"):
            assert encoded_in_isoform(306, iso) is True
            assert encoded_in_isoform(274, iso) is True

    def test_slash_and_case_normalised(self):
        assert motifs.repeat_isoform("3r/4r") == "3R+4R"
        assert motifs.repeat_isoform(" 4R ") == "4R"

    def test_unknown_isoform_rejected(self):
        with pytest.raises(ValueError):
            motifs.repeat_isoform("2R")


class TestCoreState:
    def test_resolved_is_buried(self):
        assert core_state(310, CORE_AD, "3R+4R") == 1.0

    def test_encoded_but_unresolved_is_exposed(self):
        # Residue 100 is in the fuzzy coat of every tauopathy fold.
        assert core_state(100, CORE_AD, "3R+4R") == 0.0

    def test_not_encoded_is_undefined_not_zero(self):
        # The central correction. In a 3R fold, R2 does not exist, so its
        # accessibility is undefined -- scoring it 0 ("exposed") would be a
        # claim about absent protein.
        assert core_state(280, frozenset(range(306, 379)), "3R") is None

    def test_mixed_isoform_unresolved_r2_is_undefined(self):
        assert core_state(280, CORE_AD, "3R+4R") is None

    def test_resolved_beats_ambiguity(self):
        # If the density is there, the residue is ordered, whatever the
        # protomer mixture.
        resolved = frozenset(range(274, 380))
        assert core_state(280, resolved, "3R+4R") == 1.0

    def test_vector_length_and_values(self):
        v = core_vector(CORE_4R, "4R")
        assert len(v) == TAU_LENGTH
        assert v[309] == 1.0  # residue 310, 0-indexed
        assert v[0] == 0.0  # residue 1, fuzzy coat
        assert set(v) <= {0.0, 1.0}  # 4R: nothing undefined

    def test_vector_has_nones_for_3r(self):
        v = core_vector(frozenset(range(306, 379)), "3R")
        r2_slice = v[274:305]  # residues 275-305
        assert all(x is None for x in r2_slice)


class TestMotifFraction:
    def test_phf6_buried_in_ad_core(self):
        frac, n_def, n_tot = motif_buried_fraction(CORE_AD, "3R+4R", 306, 311)
        assert frac == 1.0
        assert (n_def, n_tot) == (6, 6)

    def test_phf6star_undefined_in_3r_fold(self):
        # Pick's disease is 3R. PHF6* lies in R2. It is not absent-and-exposed,
        # it is not there.
        frac, n_def, n_tot = motif_buried_fraction(
            frozenset(range(306, 379)), "3R", 275, 280
        )
        assert frac is None
        assert (n_def, n_tot) == (0, 6)

    def test_nterm_fully_exposed(self):
        frac, n_def, _ = motif_buried_fraction(CORE_AD, "3R+4R", 2, 50)
        assert frac == 0.0
        assert n_def == 49

    def test_denominator_excludes_undefined(self):
        # R1+R2 span 244-305. In a 3R fold with core 274-305 resolved... but
        # 275-305 is not encoded, so only 274 is both encoded and resolved.
        frac, n_def, n_tot = motif_buried_fraction(
            frozenset({274}), "3R", 270, 280
        )
        # residues 270-274 encoded (274 resolved), 275-280 not encoded
        assert n_tot == 11
        assert n_def == 5
        assert frac == pytest.approx(1 / 5)

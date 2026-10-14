"""Run scripts/03_accessibility.py end to end, offline, against the fixtures.

The structures are synthetic, so none of the numbers mean anything
biologically. What is being checked is that the script runs, that the four
output files have the promised shape, and that the isoform NA semantics
survive the trip from the library into the CSVs -- i.e. that a 3R fold does
not emit 0 for residues it does not encode.
"""

from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).parent / "fixtures"

FOLDS = [
    # Fake 4-character ids matching the validator's pattern, mapped to fixtures.
    {
        "pdb_id": "9SYM", "disease": "SynthA", "fold_label": "sym6",
        "isoform": "4R", "source": "brain", "doi": "10.0000/fixture.1",
        "n_chains": "6", "resolution": "3.0", "notes": "symmetric_6layer fixture",
    },
    {
        "pdb_id": "9ASY", "disease": "SynthB", "fold_label": "asym",
        "isoform": "3R", "source": "brain", "doi": "10.0000/fixture.2",
        "n_chains": "6", "resolution": "3.2", "notes": "asymmetric_2proto fixture",
    },
]

FIXTURE_FOR = {"9SYM": "symmetric_6layer.pdb", "9ASY": "asymmetric_2proto.pdb"}


@pytest.fixture(scope="module")
def run_dir(tmp_path_factory):
    if not (FIXTURES / "symmetric_6layer.pdb").exists():
        from make_fixtures import write_all

        write_all(FIXTURES)

    datadir = tmp_path_factory.mktemp("data")
    (datadir / "structures").mkdir()
    for pid, fixture in FIXTURE_FOR.items():
        shutil.copy(FIXTURES / fixture, datadir / "structures" / f"{pid}.pdb")

    with (datadir / "folds.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(FOLDS[0]))
        w.writeheader()
        w.writerows(FOLDS)

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "03_accessibility.py"),
         "--datadir", str(datadir), "--n-trim", "1", "--n-points", "60"],
        capture_output=True, text=True, timeout=600,
    )
    assert proc.returncode == 0, f"script failed:\n{proc.stdout}\n{proc.stderr}"
    return datadir, proc.stdout


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="") as fh:
        return list(csv.DictReader(fh))


class TestOutputsExist:
    def test_all_four_files_written(self, run_dir):
        datadir, _ = run_dir
        for name in ("core_matrix_long.csv", "residue_sasa.csv",
                     "motif_exposure.csv", "provenance.json"):
            assert (datadir / name).exists(), name

    def test_provenance_records_parameters(self, run_dir):
        datadir, _ = run_dir
        prov = json.loads((datadir / "provenance.json").read_text())
        assert prov["parameters"]["n_trim_per_end"] == 1
        assert prov["n_folds_requested"] == 2
        assert prov["n_folds_scored"] == 2
        assert prov["biopython"]


class TestCoreMatrix:
    def test_one_row_per_residue_per_fold(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "core_matrix_long.csv")
        assert len(rows) == 2 * 441

    def test_resolved_residues_are_ones(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "core_matrix_long.csv")
        sym = {int(r["resno"]): r for r in rows if r["pdb_id"] == "9SYM"}
        # The symmetric fixture spans 306-325.
        assert sym[310]["core_state"] == "1"
        assert sym[310]["reason"] == "resolved_in_model"
        assert sym[400]["core_state"] == "0"
        assert sym[400]["reason"] == "encoded_unresolved"

    def test_3r_fold_emits_blank_not_zero_for_r2(self, run_dir):
        """The isoform trap, checked at the CSV boundary.

        9ASY is labelled 3R, so residues 275-305 are not encoded. They must
        come out empty with a reason, never as 0 -- a 0 here would be read by
        the R layer as 'exposed' and averaged into motif fractions.
        """
        datadir, _ = run_dir
        rows = read_csv(datadir / "core_matrix_long.csv")
        asy = {int(r["resno"]): r for r in rows if r["pdb_id"] == "9ASY"}
        for resno in (275, 280, 299, 305):
            assert asy[resno]["core_state"] == "", resno
            assert asy[resno]["reason"] == "not_encoded_3R_lacks_exon10"
        # Immediately outside R2 the residues are encoded and merely unresolved.
        assert asy[274]["core_state"] == "0"
        assert asy[306]["core_state"] == "1"


class TestResidueSASA:
    def test_asymmetric_entry_yields_two_protofilaments(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "residue_sasa.csv")
        protos = {r["protofilament"] for r in rows if r["pdb_id"] == "9ASY"}
        assert protos == {"A/C/E", "B/D/F"}

    def test_symmetric_entry_is_one_protofilament(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "residue_sasa.csv")
        protos = {r["protofilament"] for r in rows if r["pdb_id"] == "9SYM"}
        assert protos == {"A/B/C/D/E/F"}

    def test_relative_sasa_present_and_bounded(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "residue_sasa.csv")
        vals = [float(r["rel_sasa"]) for r in rows if r["rel_sasa"]]
        assert vals, "rel_sasa should be populated"
        assert all(v >= 0 for v in vals)

    def test_trim_recorded(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "residue_sasa.csv")
        sym = [r for r in rows if r["pdb_id"] == "9SYM"]
        assert sym[0]["n_layers_total"] == "6"
        assert sym[0]["n_layers_used"] == "4"  # 6 layers, 1 trimmed per end


class TestMotifExposure:
    def test_one_row_per_motif_per_fold(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "motif_exposure.csv")
        from taufold.motifs import MOTIFS

        assert len(rows) == 2 * len(MOTIFS)

    def test_phf6_buried_in_both_fixtures(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "motif_exposure.csv")
        for pid in ("9SYM", "9ASY"):
            r = next(x for x in rows
                     if x["pdb_id"] == pid and x["motif"] == "PHF6_VQIVYK")
            assert float(r["frac_buried"]) == 1.0
            assert r["n_defined"] == "6"

    def test_phf6star_blank_for_3r_fold(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "motif_exposure.csv")
        r = next(x for x in rows
                 if x["pdb_id"] == "9ASY" and x["motif"] == "PHF6*_VQIINK")
        assert r["frac_buried"] == "", "a 3R fold has no PHF6* to expose"
        assert r["n_defined"] == "0"
        assert r["n_total"] == "6"

    def test_every_motif_carries_a_citation(self, run_dir):
        datadir, _ = run_dir
        rows = read_csv(datadir / "motif_exposure.csv")
        assert all(r["source"].strip() for r in rows)


class TestValidationGate:
    def test_bad_folds_csv_stops_the_pipeline(self, tmp_path):
        datadir = tmp_path / "data"
        datadir.mkdir()
        bad = [dict(FOLDS[0], source="recombinant", doi="")]
        with (datadir / "folds.csv").open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(bad[0]))
            w.writeheader()
            w.writerows(bad)
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "03_accessibility.py"),
             "--datadir", str(datadir)],
            capture_output=True, text=True, timeout=120,
        )
        assert proc.returncode == 1
        assert "does not validate" in proc.stderr
        assert "brain-derived" in proc.stderr
        # And nothing downstream was written.
        assert not (datadir / "residue_sasa.csv").exists()

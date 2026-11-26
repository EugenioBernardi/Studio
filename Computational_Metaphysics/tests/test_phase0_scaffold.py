import re

import pytest

from harness import benchmarks

EXPECTED = [
    "CLAUDE.md", "PLAN.md", "pyproject.toml",
    "mcp_server", "theories/HOML_Base.thy", "benchmarks/leibniz_two_notations.json",
    "benchmarks/spinoza_ethics_p1_p15.json", "harness/prompts", "export/templates", "outputs",
]


@pytest.mark.parametrize("rel", EXPECTED)
def test_layout(root, rel):
    assert (root / rel).exists(), rel


def test_claude_md_lists_all_hard_constraints(root):
    text = (root / "CLAUDE.md").read_text()
    for phrase in ["Ground-truth isolation", "Mandatory consistency gate",
                   "Deterministic parsing only", "Immutable formal artifacts",
                   "Deterministic countermodel diagrams", "Incremental execution"]:
        assert phrase in text


def test_homl_base_declares_embedding(root):
    thy = (root / "theories/HOML_Base.thy").read_text()
    assert re.search(r"^theory HOML_Base\s*$", thy, re.M)
    assert re.search(r"^\s*imports Main\s*$", thy, re.M)
    for decl in ["typedecl i", "typedecl e", "consts r ::", "abbreviation mbox",
                 "abbreviation mdia", "abbreviation mvalid", "definition refl_frame"]:
        assert decl in thy, decl
    assert thy.rstrip().endswith("end")
    # Frame conditions must not be built in as axioms.
    assert not re.search(r"^axiomatization", thy, re.M)


def test_spinoza_benchmark_loads(root):
    b = benchmarks.load(root / "benchmarks/spinoza_ethics_p1_p15.json")
    assert b.targets == tuple(f"P{k}" for k in range(1, 16))
    assert len(b.premises) == 15
    assert b.segment("D3").text.startswith("By substance, I mean")
    assert b.segment("A7").kind == "axiom"


def test_leibniz_placeholder_refuses_to_run(root):
    with pytest.raises(benchmarks.BenchmarkError, match="TEXT_REQUIRED"):
        benchmarks.load(root / "benchmarks/leibniz_two_notations.json")
    b = benchmarks.load(root / "benchmarks/leibniz_two_notations.json", require_ready=False)
    assert not b.ready


def test_render_is_blinded(root):
    b = benchmarks.load(root / "benchmarks/spinoza_ethics_p1_p15.json")
    text = benchmarks.render_text(b)
    assert "Elwes" not in text and "wikisource" not in text.lower()
    assert "[P15] (proposition)" in text
    assert "Elwes" in benchmarks.render_text(b, reveal_attribution=True)


def test_validate_catches_problems():
    doc = {"benchmark_id": "x", "schema_version": 1, "targets": ["P9"], "premises": [],
           "segments": [{"id": "D1", "kind": "poem", "label": "D1", "text": ""}]}
    problems = benchmarks.validate(doc)
    assert any("bad kind" in p for p in problems)
    assert any("empty text" in p for p in problems)
    assert any("unknown segment P9" in p for p in problems)

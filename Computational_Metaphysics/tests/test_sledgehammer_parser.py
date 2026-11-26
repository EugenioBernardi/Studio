from mcp_server.sledgehammer_parser import parse_sledgehammer
from tests.conftest import fixture_text


def test_live_s5_output():
    r = parse_sledgehammer(fixture_text("sledgehammer/s5_axiom5.txt"))
    assert r.status == "proof_found"
    assert [s.proof for s in r.suggestions] == ["using S5_sym S5_trans by blast"]
    assert r.suggestions[0].prover == "zipperposition"
    assert r.suggestions[0].time_ms == 5.0


def test_duplicates_and_best_is_fastest():
    r = parse_sledgehammer(fixture_text("sledgehammer/false_from_inconsistent.txt"))
    assert [s.proof for s in r.suggestions] == ["using bad1 bad2 by auto", "using bad1 bad2 by blast"]
    assert r.best.proof == "using bad1 bad2 by blast"     # 0.2 ms < 1 ms


def test_no_proof_and_timeout():
    assert parse_sledgehammer(fixture_text("sledgehammer/synthetic_no_proof.txt")).status == "none"
    assert parse_sledgehammer("Sledgehammering...\nvampire: Timed out\nDone").status == "timeout"
    assert parse_sledgehammer("").status == "unknown"


def test_seconds_and_no_prover_prefix():
    r = parse_sledgehammer("Try this: by (metis A1 A2) (1.5 s)")
    assert r.suggestions[0].prover is None and r.suggestions[0].time_ms == 1500.0


def test_wrapped_suggestion_live():
    # Captured live: the pretty-printer moves a long proof onto an indented line.
    r = parse_sledgehammer(fixture_text("sledgehammer/wrapped_try_this.txt"))
    assert r.status == "proof_found"
    assert [(s.prover, s.proof, s.time_ms) for s in r.suggestions] == [
        ("zipperposition", "using hidden_premise_1 hidden_premise_2 by auto", 0.5)]


def test_multi_line_wrapped_proof():
    r = parse_sledgehammer("vampire: Try this:\n  using a b c\n  by (metis d e) (12 ms)\nDone")
    assert r.suggestions[0].proof == "using a b c by (metis d e)"

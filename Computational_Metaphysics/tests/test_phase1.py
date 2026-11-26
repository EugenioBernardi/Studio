"""Phase 1 acceptance tests against a live Isabelle2025 + HOML_Base heap.

Skipped when Isabelle is unavailable (set ISABELLE_EXE or put `isabelle` on PATH).
Build the heap first: scripts/build_heap.sh
"""
import time

import jsonschema
import pytest

from mcp_server.nitpick_parser import STRICT_SCHEMA
from mcp_server.server import Config, IsabelleTools

pytestmark = pytest.mark.isabelle

S5 = r'''theory S5_Accept
  imports HOML_Base
begin
consts p :: \<sigma>
axiomatization where
  S5_refl:  "\<forall>x. x r x" and
  S5_trans: "\<forall>x y z. x r y \<and> y r z \<longrightarrow> x r z" and
  S5_sym:   "\<forall>x y. x r y \<longrightarrow> y r x"

lemma s5_axiom5: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>\<^bold>\<diamond>p\<rfloor>"
  oops
end
'''

K = r'''theory K_Accept
  imports HOML_Base
begin
consts p :: \<sigma>
lemma k_invalid: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>p\<rfloor>"
  oops
end
'''

CONTRA = r'''theory Contra_Accept
  imports HOML_Base
begin
consts p :: \<sigma>
axiomatization where
  hidden_premise_1: "\<lfloor>p\<rfloor>" and
  hidden_premise_2: "\<lfloor>\<^bold>\<not>p\<rfloor>"
end
'''


@pytest.fixture(scope="module")
def live(tmp_path_factory):
    t = IsabelleTools(_cfg(tmp_path_factory.mktemp("isa")))
    yield t
    t.close()


def _cfg(work):
    c = Config.from_env()
    c.work_dir = work
    return c


def test_valid_s5_theorem_solved_by_sledgehammer(live):
    r = live.prove_with_sledgehammer(S5, "s5_axiom5")
    assert r["status"] == "PROVED", r
    assert r["replayed"] is True and r["proof"]
    # The replayed proof really closes the lemma.
    assert live.verify_theory(S5.replace("  oops", "  " + r["proof"]))["status"] == "OK"


def test_invalid_k_theorem_gives_two_world_countermodel(live):
    r = live.find_countermodel(K, "k_invalid")
    km = r["kripke"]
    jsonschema.validate(km, STRICT_SCHEMA)
    assert km["status"] == "genuine"
    assert len(km["worlds"]) == 2
    # Semantic check of the countermodel itself: at the actual world, ◇p holds and □p fails.
    w = "w" + r["detail"]["actual_world"][1:]
    succ = {b for a, b in km["accessibility"] if a == w}
    p = set(km["valuations"]["p"])
    assert succ & p and succ - p


def test_contradictory_axiom_pair_rejected(live):
    r = live.check_consistency(CONTRA)
    assert r["consistent"] is False and r["status"] == "INCONSISTENT"
    # Rejection rests on a replayed derivation of False, not on Nitpick alone.
    assert r["contradiction_search"]["status"] == "PROVED"


INFINITE_CHAIN = r'''theory Chain_Accept
  imports HOML_Base
begin
consts causes :: "e \<Rightarrow> e \<Rightarrow> bool"
axiomatization where
  irrefl: "\<forall>x. \<not> causes x x" and
  trans:  "\<forall>x y z. causes x y \<and> causes y z \<longrightarrow> causes x z" and
  every_thing_has_a_cause: "\<forall>x. \<exists>y. causes y x"
end
'''


def test_infinite_only_axioms_are_not_called_inconsistent(live):
    # Satisfiable (the naturals with >), but no finite model exists.
    r = live.check_consistency(INFINITE_CHAIN)
    assert r["status"] == "NO_FINITE_MODEL_FOUND" and r["consistent"] is None


def test_satisfiable_axioms_accepted(live):
    assert live.check_consistency(S5)["status"] == "CONSISTENT"


def test_verify_theory_ok_error_and_warm_latency(live):
    proved = K.replace("lemma k_invalid", "lemma k_ok: \"\\<lfloor>\\<^bold>\\<box>(p \\<^bold>\\<rightarrow> p)\\<rfloor>\"\n  by simp\nlemma k_invalid")
    proved = proved[:proved.index("lemma k_invalid")] + "end\n"
    live.verify_theory(proved)  # warm-up
    t0 = time.monotonic()
    assert live.verify_theory(proved)["status"] == "OK"
    assert time.monotonic() - t0 < 2.0
    bad = live.verify_theory(K.replace(r"\<^bold>\<box>p", r"\<box>p"))
    assert bad["status"] == "ERROR" and bad["errors"]


def test_oops_is_unproved_and_sorry_is_rejected(live):
    r = live.verify_theory(K)
    assert r["status"] == "UNPROVED" and r["unproved"] == ["k_invalid"]
    assert live.verify_theory(K.replace("  oops", "  sorry"))["status"] == "REJECTED"

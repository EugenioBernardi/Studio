"""IsabelleTools logic against a scripted fake client (no Isabelle needed)."""
import asyncio
from pathlib import Path

import pytest

from mcp_server.server import Config, IsabelleTools, build_server
from tests.conftest import fixture_text

K = r'''theory K_Test
  imports HOML_Base
begin
consts p :: \<sigma>
lemma k_invalid: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>p\<rfloor>"
  oops
end
'''


class FakeClient:
    """Answers use_theories by locating the diagnostic command in the written file."""

    def __init__(self, outputs: dict[str, str], replay_ok: bool = True, hang: bool = False):
        self.outputs, self.replay_ok, self.hang = outputs, replay_ok, hang
        self.session_id = "S"
        self.calls: list[str] = []

    def use_theories(self, theories, master_dir, **kw):
        text = (Path(master_dir) / f"{theories[0]}.thy").read_text()
        self.calls.append(text)
        msgs = []
        for ln, line in enumerate(text.splitlines(), 1):
            for key, out in self.outputs.items():
                if line.strip().startswith(key):
                    msgs.append({"kind": "writeln", "message": out, "pos": {"line": ln}})
        if "\\<box>p" in text and "\\<^bold>\\<box>p" not in text:
            msgs.append({"kind": "error", "message": "Inner lexical error⌂", "pos": {"line": 5}})
        if not self.replay_ok and "by blast" in text:
            msgs.append({"kind": "error", "message": "Failed to apply proof method", "pos": {"line": 6}})
        failed = sum(m["kind"] == "error" for m in msgs)
        status = {"consolidated": not self.hang, "running": int(self.hang), "unprocessed": 0,
                  "failed": failed, "canceled": False}
        return {"ok": not failed, "errors": [], "nodes": [{"messages": msgs, "status": status}]}

    def purge_theories(self, *a):
        return {}

    def close(self):
        pass


def tools(tmp_path, outputs, **kw):
    return IsabelleTools(Config(work_dir=tmp_path), client=FakeClient(outputs, **kw))


PROVED = K.replace("  oops", "  by simp")


def test_verify_ok_unproved_and_error(tmp_path):
    t = tools(tmp_path, {})
    assert t.verify_theory(PROVED)["status"] == "OK"
    r = t.verify_theory(K)
    assert r["status"] == "UNPROVED" and r["typecheck"] == "OK" and r["unproved"] == ["k_invalid"]
    bad = t.verify_theory(K.replace(r"\<^bold>\<box>p", r"\<box>p"))
    assert bad["status"] == "ERROR" and bad["errors"][0]["line"] == 5
    assert "⌂" not in bad["errors"][0]["message"]


def test_verify_rejects_ground_truth_import_before_isabelle(tmp_path):
    t = tools(tmp_path, {})
    r = t.verify_theory(K.replace("imports HOML_Base", 'imports "ground_truth/spinoza_ref"'))
    assert r["status"] == "REJECTED" and t._client.calls == []


def test_find_countermodel(tmp_path):
    t = tools(tmp_path, {"nitpick": fixture_text("nitpick/k_dia_box_card2_batch1.txt")})
    r = t.find_countermodel(K, "k_invalid")
    assert r["kripke"]["worlds"] == ["w1", "w2"] and r["kripke"]["status"] == "genuine"
    assert r["detail"]["actual_world"] == "i1"
    assert "nitpick [user_axioms, show_all, card = 1-4, batch_size = 1" in t._client.calls[0]


def test_check_consistency_verdicts(tmp_path):
    ok = tools(tmp_path, {"nitpick": fixture_text("nitpick/s5_satisfy_model_card2.txt")})
    r = ok.check_consistency(K)
    assert r["consistent"] and r["status"] == "CONSISTENT"
    assert "nitpick [satisfy, user_axioms" in ok._client.calls[0]
    bad = tools(tmp_path, {"nitpick": fixture_text("nitpick/no_model_inconsistent.txt"),
                           "sledgehammer": fixture_text("sledgehammer/false_from_inconsistent.txt")})
    r = bad.check_consistency(K)
    assert (r["status"], r["consistent"]) == ("INCONSISTENT", False)
    assert r["contradiction_search"]["proof"] == "using bad1 bad2 by blast"
    assert "lemma False\n  using bad1 bad2 by blast" in bad._client.calls[-1]     # replayed
    inf = tools(tmp_path, {"nitpick": fixture_text("nitpick/no_model_inconsistent.txt"),
                           "sledgehammer": fixture_text("sledgehammer/synthetic_no_proof.txt")})
    r = inf.check_consistency(K)
    assert (r["status"], r["consistent"]) == ("NO_FINITE_MODEL_FOUND", None)
    assert "infinite" in r["note"]
    spur = tools(tmp_path, {"nitpick": fixture_text("nitpick/synthetic_potentially_spurious.txt")
                            .replace("counterexample", "model")})
    assert spur.check_consistency(K)["status"] == "POTENTIAL_MODEL_ONLY"


def test_sledgehammer_replays_suggestion(tmp_path):
    t = tools(tmp_path, {"sledgehammer": fixture_text("sledgehammer/s5_axiom5.txt")})
    r = t.prove_with_sledgehammer(K, "k_invalid")
    assert r["status"] == "PROVED" and r["replayed"]
    assert "using S5_sym S5_trans by blast" in t._client.calls[-1]


def test_sledgehammer_replay_failure_and_none(tmp_path):
    t = tools(tmp_path, {"sledgehammer": fixture_text("sledgehammer/s5_axiom5.txt")}, replay_ok=False)
    assert t.prove_with_sledgehammer(K, "k_invalid")["status"] == "REPLAY_FAILED"
    t = tools(tmp_path, {"sledgehammer": fixture_text("sledgehammer/synthetic_no_proof.txt")})
    assert t.prove_with_sledgehammer(K, "k_invalid")["status"] == "NO_PROOF"


def test_unknown_lemma(tmp_path):
    assert tools(tmp_path, {}).find_countermodel(K, "nope")["status"] == "REJECTED"


def test_mcp_registers_exactly_four_tools(tmp_path):
    srv = build_server(tools(tmp_path, {}))
    listed = asyncio.run(srv.list_tools())
    names = sorted(t.name for t in listed)
    assert names == ["check_consistency", "find_countermodel", "prove_with_sledgehammer", "verify_theory"]


SORRY_BEFORE = K.replace("lemma k_invalid", "lemma helper: \"\\<lfloor>p\\<rfloor>\"\n  sorry\nlemma k_invalid")


@pytest.mark.parametrize("call", ["verify", "sledge", "countermodel", "consistency"])
def test_sorry_rejected_by_every_tool_before_isabelle(tmp_path, call):
    t = tools(tmp_path, {})
    r = {"verify": lambda: t.verify_theory(SORRY_BEFORE),
         "sledge": lambda: t.prove_with_sledgehammer(SORRY_BEFORE, "k_invalid"),
         "countermodel": lambda: t.find_countermodel(SORRY_BEFORE, "k_invalid"),
         "consistency": lambda: t.check_consistency(SORRY_BEFORE)}[call]()
    assert r["status"] == "REJECTED" and "sorry" in r["errors"][0]["message"]
    assert t._client.calls == []


def test_sorry_in_target_lemma_itself_is_harmless_for_diagnostics(tmp_path):
    # The target's own proof is replaced by the diagnostic command.
    t = tools(tmp_path, {"nitpick": fixture_text("nitpick/k_dia_box_card2_batch1.txt")})
    assert t.find_countermodel(K.replace("  oops", "  sorry"), "k_invalid")["status"] == "OK"


def test_conclusion_as_axiom_rejected(tmp_path):
    smuggled = K.replace("lemma k_invalid", 'axiomatization where k_ax: "\\<lfloor>\\<^bold>\\<diamond>p \\<^bold>\\<rightarrow> \\<^bold>\\<box>p\\<rfloor>"\nlemma k_invalid')
    smuggled = smuggled.replace("  oops", "  by (rule k_ax)")
    t = tools(tmp_path, {"sledgehammer": fixture_text("sledgehammer/s5_axiom5.txt")})
    for r in (t.verify_theory(smuggled), t.prove_with_sledgehammer(smuggled, "k_invalid")):
        assert r["status"] == "REJECTED" and "conclusion as axiom" in r["errors"][0]["message"]


def test_sledgehammer_never_reports_unreplayed_proof(tmp_path):
    t = tools(tmp_path, {"sledgehammer": fixture_text("sledgehammer/s5_axiom5.txt")}, replay_ok=False)
    r = t.prove_with_sledgehammer(K, "k_invalid")
    assert r["status"] == "REPLAY_FAILED" and r["proof"] is None and r["replayed"] is False
    assert r["tried"] == [{"proof": "using S5_sym S5_trans by blast", "prover": "zipperposition", "ok": False}]


def test_watchdog_abort_is_never_success(tmp_path):
    # Mirrors the live observation: ok=true, no errors, but running=1 / not consolidated.
    t = tools(tmp_path, {"nitpick": fixture_text("nitpick/no_model_inconsistent.txt"),
                         "sledgehammer": fixture_text("sledgehammer/synthetic_no_proof.txt")}, hang=True)
    assert t.verify_theory(PROVED)["status"] == "ERROR"
    assert t.verify_theory(PROVED)["errors"][-1]["kind"] == "incomplete"
    assert t.check_consistency(K)["status"] == "ERROR"


def test_fast_path_catches_trivial_contradiction_without_sledgehammer(tmp_path):
    contra = K.replace("lemma k_invalid", 'axiomatization where a1: "\\<lfloor>p\\<rfloor>" and a2: "\\<lfloor>\\<^bold>\\<not>p\\<rfloor>"\nlemma k_invalid')
    t = tools(tmp_path, {"nitpick": fixture_text("nitpick/no_model_inconsistent.txt")})
    r = t.check_consistency(contra)
    assert r["status"] == "INCONSISTENT" and r["fast_path"]["method"] == "blast"
    assert r["fast_path"]["proof"] == "using a1 a2 by blast"
    assert not any("sledgehammer" in c for c in t._client.calls)

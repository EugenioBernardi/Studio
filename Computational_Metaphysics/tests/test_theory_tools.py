import pytest

from mcp_server import theory_tools as tt

THY = r'''theory Foo
  imports HOML_Base
begin
(* lemma decoy: "False" by simp *)
consts p :: \<sigma>
lemma first: "\<lfloor>p \<^bold>\<rightarrow> p\<rfloor>"
  by simp
lemma second [simp]: "\<lfloor>\<^bold>\<box>(p \<^bold>\<rightarrow> p)\<rfloor>"
  using first
  by blast
text \<open>lemma inside_text: x\<close>
end
'''


def test_header_and_policy_ok():
    h = tt.parse_header(THY)
    assert h.name == "Foo" and h.imports == ("HOML_Base",)
    assert tt.check_policy(THY) == []


@pytest.mark.parametrize("bad,needle", [
    (THY.replace("imports HOML_Base", 'imports "../theories/ground_truth/spinoza_ref"'), "ground_truth"),
    (THY.replace("imports HOML_Base", "imports HOML_Base Leibniz_Ref"), "import not allowed"),
    (THY.replace("consts p", "ML \\<open>val x = 1\\<close>\nconsts p"), "forbidden command: ML"),
    (THY.replace("by simp", "by (skip_proof)"), "skip_proof"),
    (THY.replace("begin", "begin\ndeclare [[quick_and_dirty]]"), "quick_and_dirty"),
])
def test_policy_rejections(bad, needle):
    assert any(needle in p for p in tt.check_policy(bad))
    with pytest.raises(tt.PolicyError):
        tt.prepare(bad)


def test_prepare_renames_and_preserves_line_numbers():
    name, text = tt.prepare(THY)
    assert name.startswith("Foo_") and len(name) == 4 + 10
    assert '"HOML_Base.HOML_Base"' in text
    assert text.count("\n") == THY.count("\n")
    assert text.splitlines()[5] == THY.splitlines()[5]
    assert tt.prepare(THY)[0] == name and tt.prepare(THY, tag="x")[0] != name


def test_mask_hides_comments_and_cartouches():
    m = tt.mask(THY)
    assert "decoy" not in m and "inside_text" not in m and len(m) == len(THY)


def test_find_lemma_and_names():
    assert tt.lemma_names(THY) == ["first", "second"]
    span = tt.find_lemma(THY, "second")
    assert THY[span.proof_start:].startswith("using first")
    assert THY[span.end:].startswith("text")
    with pytest.raises(tt.PolicyError):
        tt.find_lemma(THY, "decoy")


def test_with_proof_truncates_and_reports_line():
    text, line = tt.with_proof(THY, "first", "nitpick\n  oops")
    lines = text.splitlines()
    assert lines[line - 1].strip() == "nitpick"
    assert "second" not in text and text.rstrip().endswith("end")


def test_with_command_before_end():
    text, line = tt.with_command_before_end(THY, "lemma True\n  nitpick [satisfy]\n  oops")
    assert text.splitlines()[line - 1] == "lemma True"
    assert "inside_text" in text and text.rstrip().endswith("end")


OPEN_AX = r'''theory Open
  imports HOML_Base
begin
consts p :: \<sigma>
lemma goal: "\<lfloor>p\<rfloor>"
axiomatization where cheat_ax: "\<lfloor>p\<rfloor>"
end
'''


def test_open_proof_axiomatization_detected():
    probs = tt.proof_escape_problems(OPEN_AX)
    assert any("still open" in p for p in probs)
    assert any("conclusion as axiom" in p for p in probs)


def test_axioms_and_statements_extracted():
    assert tt.axioms(OPEN_AX) == [("cheat_ax", r'"\<lfloor>p\<rfloor>"')]
    assert tt.lemma_statements(OPEN_AX) == [("goal", r'"\<lfloor>p\<rfloor>"')]
    assert tt.oops_lemmas(THY) == [] and tt.unfinished_lemmas(THY) == []


def test_sorry_in_comment_is_not_flagged():
    assert tt.proof_escape_problems(THY.replace("(* lemma decoy", "(* sorry lemma decoy")) == []

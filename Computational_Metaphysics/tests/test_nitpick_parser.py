import json

import jsonschema
import pytest

from mcp_server.nitpick_parser import (STRICT_SCHEMA, normalize, parse_nitpick,
                                       parse_to_strict_json, parse_value, to_kripke)
from tests.conftest import FIXTURES, fixture_text

ALL = sorted(p.name for p in (FIXTURES / "nitpick").glob("*.txt"))


@pytest.mark.parametrize("name", ALL)
def test_every_fixture_yields_schema_valid_json(name):
    out = parse_to_strict_json(fixture_text(f"nitpick/{name}"))
    jsonschema.validate(out, STRICT_SCHEMA)
    assert json.loads(json.dumps(out)) == out


def test_minimal_k_countermodel_dia_to_box():
    # Live output: lemma "⌊◇p → □p⌋", nitpick [card = 1-4, batch_size = 1]
    out = parse_to_strict_json(fixture_text("nitpick/k_dia_box_card2_batch1.txt"))
    assert out == {
        "status": "genuine",
        "worlds": ["w1", "w2"],
        "accessibility": [["w1", "w1"], ["w1", "w2"]],
        "valuations": {"p": ["w1"]},
    }


def test_actual_world_is_skolem_w_not_first_skolem():
    res = parse_nitpick(fixture_text("nitpick/k_dia_box_card3_parallel.txt"))
    names = [b["name"] for b in res.sections["skolem_constants"]]
    assert names == ["v", "v", "w"]          # duplicates preserved, in order
    assert to_kripke(res)["actual_world"] == "i2"


def test_curried_relation_multiline_parenthesized_name():
    res = parse_nitpick(fixture_text("nitpick/k_dia_box_card3_parallel.txt"))
    k = to_kripke(res)
    assert res.cards == {"i": 3}
    assert k["accessibility"]["r"] == [
        ["i1", "i1"], ["i1", "i2"], ["i1", "i3"],
        ["i2", "i1"], ["i2", "i2"], ["i2", "i3"], ["i3", "i2"]]


def test_world_relative_predicate_and_two_cards():
    res = parse_nitpick(fixture_text("nitpick/k_exists_pred_card_i2_e2.txt"))
    assert res.cards == {"i": 2, "e": 2}
    out = parse_to_strict_json(fixture_text("nitpick/k_exists_pred_card_i2_e2.txt"))
    assert out["valuations"] == {"G(e1)": ["w2"], "G(e2)": []}
    assert to_kripke(res)["individuals"] == ["e1", "e2"]


def test_satisfy_model():
    res = parse_nitpick(fixture_text("nitpick/s5_satisfy_model_card2.txt"))
    assert (res.outcome, res.mode, res.genuine) == ("model", "model", True)
    assert parse_to_strict_json(res.raw)["accessibility"] == [["w1", "w1"], ["w2", "w2"]]


@pytest.mark.parametrize("name,mode", [
    ("no_counterexample.txt", "counterexample"),
    ("no_counterexample_with_warning.txt", "counterexample"),
    ("no_model_inconsistent.txt", "model"),
])
def test_none_outcomes(name, mode):
    res = parse_nitpick(fixture_text(f"nitpick/{name}"))
    assert (res.outcome, res.mode) == ("none", mode)
    assert parse_to_strict_json(res.raw) == {"status": "none", "worlds": [],
                                             "accessibility": [], "valuations": {}}


def test_potentially_spurious_maps_to_potential():
    out = parse_to_strict_json(fixture_text("nitpick/synthetic_potentially_spurious.txt"))
    assert out["status"] == "potential"


def test_unrecognized_output_is_none_not_crash():
    res = parse_nitpick("Nitpick ran out of time after checking 3 of 4 scopes")
    assert res.outcome == "unknown" and res.scopes_checked == (3, 4)
    assert parse_to_strict_json(res.raw)["status"] == "none"


def test_ascii_symbol_encoding_parses_like_unicode():
    uni = fixture_text("nitpick/k_dia_box_card2_batch1.txt")
    ascii_ = uni.replace("λ", r"\<lambda>").replace("⇩", r"\<^sub>")
    assert parse_to_strict_json(ascii_) == parse_to_strict_json(uni)
    assert normalize("i₁") == "i⇩1"


@pytest.mark.parametrize("text,expected", [
    ("True", {"kind": "bool", "value": True}),
    ("i⇩3", {"kind": "atom", "type": "i", "index": 3, "name": "i3"}),
    ("{}", {"kind": "set", "items": []}),
    ("_", {"kind": "unspecified"}),
])
def test_value_atoms(text, expected):
    assert parse_value(text) == expected


def test_value_update_tuple_keys_and_sets():
    v = parse_value("(λx. _)((i⇩1, i⇩2) := True, (i⇩2, i⇩1) := False)")
    assert v["kind"] == "fun" and len(v["map"]) == 2
    assert v["map"][0][0] == {"kind": "tuple", "items": [parse_value("i⇩1"), parse_value("i⇩2")]}
    s = parse_value("{(i⇩1, i⇩1), (i⇩1, i⇩2)}")
    assert s["kind"] == "set" and len(s["items"]) == 2


def test_relation_as_set_of_pairs():
    text = ("Nitpick found a counterexample for card i = 2:\n"
            "  Skolem constant:\n    w = i⇩1\n"
            "  Constant:\n    r = {(i⇩1, i⇩2)}\n")
    assert parse_to_strict_json(text)["accessibility"] == [["w1", "w2"]]


def test_garbage_value_is_raw():
    assert parse_value("λx. x + 1")["kind"] == "raw"

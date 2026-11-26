"""Deterministic parser: Nitpick output text -> structured result + Kripke JSON.

No LLM is involved anywhere in this module (CLAUDE.md, rule 3).

Pipeline
--------
1. ``normalize`` maps Isabelle's ASCII symbol encoding (``\\<lambda>``,
   ``\\<^sub>``, ...) and its Unicode rendering (``λ``, ``⇩``) to one canonical
   form so that both server modes (``unicode_symbols`` on/off) parse alike.
2. ``parse_nitpick`` runs a line-oriented state machine over the output:
   header line -> outcome; section headers (``Free variables:``,
   ``Skolem constants:``, ``Constants:``, ``Types:``) -> bindings.
3. ``parse_value`` is a small recursive-descent parser for Nitpick's value
   syntax: function updates ``(λx. _)(a := b, ...)``, atoms ``i⇩1``, booleans,
   tuples, sets and the unspecified value ``_``.
4. ``to_kripke`` interprets the bindings over the HOML_Base conventions
   (worlds of type ``i``, accessibility ``r``, propositions ``i ⇒ bool``).
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

# --------------------------------------------------------------------------
# 1. Symbol normalization
# --------------------------------------------------------------------------

_SYMBOLS = {
    r"\<lambda>": "λ", r"\<Rightarrow>": "⇒", r"\<rightarrow>": "→",
    r"\<and>": "∧", r"\<or>": "∨", r"\<not>": "¬", r"\<forall>": "∀",
    r"\<exists>": "∃", r"\<equiv>": "≡", r"\<sigma>": "σ", r"\<longrightarrow>": "⟶",
    r"\<open>": "‹", r"\<close>": "›", r"\<bottom>": "⊥", r"\<top>": "⊤",
}
_SUBSCRIPT_DIGITS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def normalize(text: str) -> str:
    """Canonicalize Isabelle symbols; atoms become e.g. ``i⇩1``."""
    text = text.replace("\r\n", "\n")
    text = text.replace(r"\<^sub>", "⇩").replace(r"\<^bsub>", "⇩").replace(r"\<^esub>", "")
    for k, v in _SYMBOLS.items():
        text = text.replace(k, v)
    # Unicode subscript digits (some front-ends) -> ⇩ + ASCII digit.
    text = re.sub(r"([A-Za-z'])([₀-₉]+)",
                  lambda m: m.group(1) + "⇩" + m.group(2).translate(_SUBSCRIPT_DIGITS), text)
    return text


# --------------------------------------------------------------------------
# 2. Value parser
# --------------------------------------------------------------------------

class ValueParseError(ValueError):
    pass


_TOKEN_RE = re.compile(
    r"""
    (?P<unspec_fun>\(\s*λ\s*\w+\s*\.\s*_\s*\))   # (λx. _)
  | (?P<assign>:=)
  | (?P<punct>[(){},])
  | (?P<atom>'?[A-Za-z][\w']*⇩\d+)              # i⇩1, e⇩2, 'a⇩1
  | (?P<bool>\bTrue\b|\bFalse\b)
  | (?P<unspec>_)
  | (?P<num>-?\d+)
  | (?P<ident>[A-Za-z][\w'.]*)
  | (?P<ws>\s+)
  | (?P<other>.)
    """,
    re.X,
)


def _tokenize(s: str) -> list[tuple[str, str]]:
    toks = []
    for m in _TOKEN_RE.finditer(s):
        kind = m.lastgroup
        if kind == "ws":
            continue
        toks.append((kind, m.group()))
    return toks


def _atom(tok: str) -> dict:
    name, idx = tok.split("⇩")
    return {"kind": "atom", "type": name, "index": int(idx), "name": f"{name}{idx}"}


class _Parser:
    def __init__(self, text: str):
        self.text = text
        self.toks = _tokenize(text)
        self.pos = 0

    def peek(self, off: int = 0):
        p = self.pos + off
        return self.toks[p] if p < len(self.toks) else (None, None)

    def take(self, value: str | None = None):
        kind, val = self.peek()
        if kind is None or (value is not None and val != value):
            raise ValueParseError(f"expected {value!r} at token {self.pos} in {self.text!r}")
        self.pos += 1
        return kind, val

    def parse(self) -> dict:
        v = self.value()
        if self.pos != len(self.toks):
            raise ValueParseError(f"trailing tokens in {self.text!r}")
        return v

    def value(self) -> dict:
        base = self.primary()
        # Function update(s): base(a := b, ...)(c := d) ...
        while self.peek()[1] == "(" and self._is_update_ahead():
            base = self.update(base)
        return base

    def _is_update_ahead(self) -> bool:
        depth = 0
        for kind, val in self.toks[self.pos:]:
            if val in "({":
                depth += 1
            elif val in ")}":
                depth -= 1
                if depth == 0:
                    return False
            elif kind == "assign" and depth == 1:
                return True
        return False

    def update(self, base: dict) -> dict:
        self.take("(")
        mapping = list(base.get("map", [])) if base["kind"] == "fun" else []
        default = base.get("default") if base["kind"] == "fun" else base
        while True:
            k = self.value()
            self.take(":=")
            v = self.value()
            mapping = [kv for kv in mapping if kv[0] != k] + [[k, v]]
            if self.peek()[1] == ",":
                self.take(",")
                continue
            self.take(")")
            break
        return {"kind": "fun", "default": default, "map": mapping}

    def primary(self) -> dict:
        kind, val = self.peek()
        if kind == "unspec_fun":
            self.take()
            return {"kind": "fun", "default": {"kind": "unspecified"}, "map": []}
        if kind == "atom":
            self.take()
            return _atom(val)
        if kind == "bool":
            self.take()
            return {"kind": "bool", "value": val == "True"}
        if kind == "unspec":
            self.take()
            return {"kind": "unspecified"}
        if kind == "num":
            self.take()
            return {"kind": "int", "value": int(val)}
        if kind == "ident":
            self.take()
            return {"kind": "const", "name": val}
        if val == "{":
            self.take("{")
            items = []
            if self.peek()[1] != "}":
                items.append(self.value())
                while self.peek()[1] == ",":
                    self.take(",")
                    items.append(self.value())
            self.take("}")
            return {"kind": "set", "items": items}
        if val == "(":
            self.take("(")
            first = self.value()
            if self.peek()[1] == ",":
                items = [first]
                while self.peek()[1] == ",":
                    self.take(",")
                    items.append(self.value())
                self.take(")")
                return {"kind": "tuple", "items": items}
            self.take(")")
            return first
        raise ValueParseError(f"unexpected token {val!r} in {self.text!r}")


def parse_value(text: str) -> dict:
    """Parse one Nitpick value. Unparseable input yields ``{"kind": "raw"}``."""
    text = normalize(text).strip()
    try:
        return _Parser(text).parse()
    except ValueParseError:
        return {"kind": "raw", "text": text}


# --------------------------------------------------------------------------
# 3. Output state machine
# --------------------------------------------------------------------------

_HEADER_RE = re.compile(
    r"^Nitpick found (?:an? )?(?P<qual>potentially spurious |quasi genuine |genuine )?"
    r"(?P<what>counterexample|model)(?P<rest>.*?):?\s*$"
)
_NONE_RE = re.compile(r"^Nitpick found no (?P<what>counterexample|model)\b")
_SECTION_RE = re.compile(
    r"^\s*(?P<sec>Free variables?|Skolem constants?|Constants?|Types?|Bound variables?)\s*:\s*$"
)
_BINDING_RE = re.compile(r"^\s{2,}(?P<name>[^=\s][^=]*?)\s*=\s*(?P<value>.*)$")
_CARD_RE = re.compile(r"card\s+(?P<type>'?[\w.]+)\s*=\s*(?P<n>\d+)")
_SCOPE_RE = re.compile(r"check(?:ed|ing) (?P<k>\d+) of (?P<n>\d+) scopes?")

_SECTION_KEYS = {
    "free variable": "free_variables", "skolem constant": "skolem_constants",
    "constant": "constants", "type": "types", "bound variable": "bound_variables",
}


@dataclass
class NitpickResult:
    outcome: str                 # counterexample | model | none | unknown
    mode: str | None             # "counterexample" (refutation) or "model" (satisfy)
    genuine: bool                # False for potentially spurious / quasi genuine
    quality: str | None          # genuine | potentially_spurious | quasi_genuine | None
    cards: dict[str, int] = field(default_factory=dict)
    # section -> ordered list of {"name", "text", "value"}; names may repeat
    # (Nitpick prints several Skolem constants called "v").
    sections: dict[str, list[dict]] = field(default_factory=dict)
    scopes_checked: tuple[int, int] | None = None
    messages: list[str] = field(default_factory=list)
    raw: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["scopes_checked"] = list(self.scopes_checked) if self.scopes_checked else None
        return d


def _join_continuations(lines: list[str]) -> list[str]:
    """Nitpick wraps long values; continuation lines are indented deeper than
    the binding line and contain no top-level `` = ``."""
    out: list[str] = []
    for line in lines:
        if out and line.startswith("      ") and not _SECTION_RE.match(line) \
                and _BINDING_RE.match(out[-1]):
            out[-1] = out[-1].rstrip() + " " + line.strip()
        else:
            out.append(line)
    return out


def _clean_name(name: str) -> str:
    """``(r)`` (infix constants are printed parenthesized) -> ``r``."""
    name = name.strip()
    while name.startswith("(") and name.endswith(")"):
        name = name[1:-1].strip()
    return name


def parse_nitpick(text: str) -> NitpickResult:
    text = normalize(text)
    lines = _join_continuations(text.split("\n"))
    res = NitpickResult(outcome="unknown", mode=None, genuine=False, quality=None, raw=text)
    section: str | None = None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if (m := _HEADER_RE.match(stripped)) and res.outcome == "unknown":
            res.outcome = res.mode = m.group("what")
            qual = (m.group("qual") or "genuine ").strip().replace(" ", "_")
            res.quality = qual
            res.genuine = qual == "genuine"
            res.cards = {c.group("type"): int(c.group("n")) for c in _CARD_RE.finditer(m.group("rest"))}
            continue
        if m := _NONE_RE.match(stripped):
            res.outcome, res.mode = "none", m.group("what")
            continue
        if m := _SCOPE_RE.search(stripped):
            res.scopes_checked = (int(m.group("k")), int(m.group("n")))
        if m := _SECTION_RE.match(line):
            sec = m.group("sec").lower().rstrip("s")
            section = _SECTION_KEYS.get(sec, sec)
            res.sections.setdefault(section, [])
            continue
        if section and (m := _BINDING_RE.match(line)):
            name, value = _clean_name(m.group("name")), m.group("value").strip()
            res.sections[section].append({"name": name, "text": value, "value": parse_value(value)})
            continue
        section = None
        res.messages.append(stripped)
    return res


# --------------------------------------------------------------------------
# 4. Kripke interpretation
# --------------------------------------------------------------------------

def _is_world(v: Any, wt: str) -> bool:
    return isinstance(v, dict) and v.get("kind") == "atom" and v.get("type") == wt


def _bool(v: dict) -> bool | None:
    return v.get("value") if v.get("kind") == "bool" else None


def _fun_items(v: dict) -> list[tuple[dict, dict]]:
    return [(k, val) for k, val in v.get("map", [])] if v.get("kind") == "fun" else []


def _prop_extension(v: dict, wt: str) -> list[str] | None:
    """σ-typed value (i ⇒ bool) -> sorted list of worlds where it is True."""
    if v.get("kind") == "set" and all(_is_world(x, wt) for x in v["items"]):
        return sorted({x["name"] for x in v["items"]}, key=_world_key)
    items = _fun_items(v)
    if not items or not all(_is_world(k, wt) and _bool(val) is not None for k, val in items):
        return None
    return sorted((k["name"] for k, val in items if _bool(val)), key=_world_key)


def _relation_edges(v: dict, wt: str) -> list[list[str]] | None:
    """i ⇒ i ⇒ bool (curried), (i × i) ⇒ bool, or a set of pairs -> edge list."""
    edges: set[tuple[str, str]] = set()
    if v.get("kind") == "set":
        for x in v["items"]:
            if not (x.get("kind") == "tuple" and len(x["items"]) == 2
                    and all(_is_world(y, wt) for y in x["items"])):
                return None
            edges.add((x["items"][0]["name"], x["items"][1]["name"]))
        return _sorted_edges(edges)
    items = _fun_items(v)
    if not items:
        return None
    for k, val in items:
        if _is_world(k, wt) and val.get("kind") in ("fun", "set"):
            succ = _prop_extension(val, wt)
            if succ is None:
                return None
            edges.update((k["name"], s) for s in succ)
        elif (k.get("kind") == "tuple" and len(k["items"]) == 2
              and all(_is_world(y, wt) for y in k["items"]) and _bool(val) is not None):
            if _bool(val):
                edges.add((k["items"][0]["name"], k["items"][1]["name"]))
        else:
            return None
    return _sorted_edges(edges)


def _predicate_extension(v: dict, wt: str) -> dict[str, list[str]] | None:
    """e ⇒ σ -> {individual: [worlds]}."""
    items = _fun_items(v)
    if not items:
        return None
    out = {}
    for k, val in items:
        if k.get("kind") != "atom" or k.get("type") == wt:
            return None
        ext = _prop_extension(val, wt)
        if ext is None:
            return None
        out[k["name"]] = ext
    return dict(sorted(out.items(), key=lambda kv: _world_key(kv[0])))


def _world_key(name: str) -> tuple[str, int]:
    m = re.match(r"(.*?)(\d+)$", name)
    return (m.group(1), int(m.group(2))) if m else (name, 0)


def _sorted_edges(edges: set[tuple[str, str]]) -> list[list[str]]:
    return [list(e) for e in sorted(edges, key=lambda e: (_world_key(e[0]), _world_key(e[1])))]


def _collect_atoms(v: Any, acc: set[tuple[str, int]]) -> None:
    if isinstance(v, dict):
        if v.get("kind") == "atom":
            acc.add((v["type"], v["index"]))
        for x in v.values():
            _collect_atoms(x, acc)
    elif isinstance(v, list):
        for x in v:
            _collect_atoms(x, acc)


def to_kripke(res: NitpickResult, *, world_type: str = "i",
              accessibility: tuple[str, ...] = ("r", "R"),
              actual_world_names: tuple[str, ...] = ("w",)) -> dict:
    """Interpret a Nitpick result as a Kripke structure (JSON-serializable)."""
    out: dict[str, Any] = {
        "schema": "kripke/v1",
        "outcome": res.outcome, "mode": res.mode, "genuine": res.genuine,
        "quality": res.quality, "cards": dict(sorted(res.cards.items())),
        "worlds": [], "actual_world": None, "accessibility": {},
        "valuations": {}, "predicates": {}, "individuals": [], "world_constants": [],
        "other": {},
    }
    if res.outcome not in ("counterexample", "model"):
        return out

    atoms: set[tuple[str, int]] = set()
    for b in res.sections.get("types", []):
        _collect_atoms(b["value"], atoms)
    bindings: list[tuple[str, str, dict]] = []
    for sec in ("free_variables", "skolem_constants", "constants", "bound_variables"):
        for b in res.sections.get(sec, []):
            bindings.append((sec, b["name"], b))
            _collect_atoms(b["value"], atoms)

    out["worlds"] = [f"{t}{k}" for t, k in sorted(a for a in atoms if a[0] == world_type)]
    out["individuals"] = [f"{t}{k}" for t, k in sorted(a for a in atoms if a[0] != world_type)]

    for sec, name, b in bindings:
        v = b["value"]
        if _is_world(v, world_type):
            # HOML_Base's validity binder is "w": its Skolem witness is the
            # world at which the refuted formula fails.
            if name in actual_world_names and sec in ("skolem_constants", "free_variables"):
                out["actual_world"] = v["name"]
            out["world_constants"].append({"name": name, "section": sec, "world": v["name"]})
            continue
        if name in accessibility or name.split(".")[-1] in accessibility:
            edges = _relation_edges(v, world_type)
            if edges is not None:
                out["accessibility"][name] = edges
                continue
        ext = _prop_extension(v, world_type)
        if ext is not None:
            out["valuations"][name] = ext
            continue
        pred = _predicate_extension(v, world_type)
        if pred is not None:
            out["predicates"][name] = pred
            continue
        edges = _relation_edges(v, world_type)
        if edges is not None:
            out["accessibility"][name] = edges
            continue
        out["other"][name] = {"section": sec, "text": b["text"]}

    out["valuations"] = dict(sorted(out["valuations"].items()))
    out["predicates"] = dict(sorted(out["predicates"].items()))
    out["accessibility"] = dict(sorted(out["accessibility"].items()))
    out["other"] = dict(sorted(out["other"].items()))
    return out


def parse_to_kripke(text: str, **kw) -> dict:
    return to_kripke(parse_nitpick(text), **kw)


# --------------------------------------------------------------------------
# 5. Strict output schema (Phase 1 contract)
# --------------------------------------------------------------------------

STRICT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["status", "worlds", "accessibility", "valuations"],
    "properties": {
        "status": {"enum": ["genuine", "potential", "none"]},
        "worlds": {"type": "array", "items": {"type": "string", "pattern": "^w[0-9]+$"}},
        "accessibility": {
            "type": "array",
            "items": {"type": "array", "minItems": 2, "maxItems": 2,
                      "items": {"type": "string", "pattern": "^w[0-9]+$"}},
        },
        "valuations": {
            "type": "object",
            "additionalProperties": {"type": "array",
                                     "items": {"type": "string", "pattern": "^w[0-9]+$"}},
        },
    },
}


def _status(res: NitpickResult) -> str:
    if res.outcome not in ("counterexample", "model"):
        return "none"          # no model/countermodel, or Nitpick gave up (see outcome)
    return "genuine" if res.genuine else "potential"


def to_strict_json(res: NitpickResult, *, world_type: str = "i",
                   accessibility: tuple[str, ...] = ("r", "R")) -> dict:
    """Project a Nitpick result onto the strict Phase 1 schema.

    Worlds ``i⇩k`` are renamed ``wk``. ``valuations`` maps each proposition
    (``i ⇒ bool``) to the worlds where it holds; a world-relative predicate
    ``P :: e ⇒ σ`` contributes one key per individual, ``"P(e1)"``.
    """
    k = to_kripke(res, world_type=world_type, accessibility=accessibility)
    ren = lambda w: "w" + w[len(world_type):]  # noqa: E731
    rel_name = next((n for n in accessibility if n in k["accessibility"]),
                    next(iter(k["accessibility"]), None))
    vals: dict[str, list[str]] = {n: [ren(w) for w in ws] for n, ws in k["valuations"].items()}
    for pname, ext in k["predicates"].items():
        for ind, ws in ext.items():
            vals[f"{pname}({ind})"] = [ren(w) for w in ws]
    return {
        "status": _status(res),
        "worlds": [ren(w) for w in k["worlds"]],
        "accessibility": [[ren(a), ren(b)] for a, b in k["accessibility"].get(rel_name, [])]
        if rel_name else [],
        "valuations": dict(sorted(vals.items())),
    }


def parse_to_strict_json(text: str, **kw) -> dict:
    return to_strict_json(parse_nitpick(text), **kw)

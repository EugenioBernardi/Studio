"""Deterministic parser for Sledgehammer output (CLAUDE.md, rule 3)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from .nitpick_parser import normalize

_TRY_RE = re.compile(
    r"^(?:(?P<prover>[\w.+-]+)\s*:\s*)?Try this:\s*(?P<proof>.+?)"
    r"(?:\s*\((?P<time>[\d.]+)\s*(?P<unit>ms|s)\))?\s*\.?\s*$"
)
_FOUND_RE = re.compile(r"^(?P<prover>[\w.+-]+) found a proof")
_NONE_RE = re.compile(r"\bno proof found\b|\bNo proof found\b|\bGave up\b", re.I)
_TIMEOUT_RE = re.compile(r"\btimed out\b|\btime ?out\b", re.I)
_PROOF_START = re.compile(r"^(by|using|apply|proof|unfolding|including)\b")


@dataclass
class ProofSuggestion:
    prover: str | None
    proof: str
    time_ms: float | None


@dataclass
class SledgehammerResult:
    status: str                      # proof_found | none | timeout | unknown
    suggestions: list[ProofSuggestion] = field(default_factory=list)
    raw: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def best(self) -> ProofSuggestion | None:
        """Fastest suggestion; ties broken by text so the choice is deterministic."""
        if not self.suggestions:
            return None
        return min(self.suggestions,
                   key=lambda s: (s.time_ms if s.time_ms is not None else float("inf"), s.proof))


def _logical_lines(text: str) -> list[str]:
    """Undo Isabelle's pretty-printer wrapping: an indented line continues the
    previous one. Long suggestions arrive as ``prover: Try this:`` followed by
    ``  using ... by auto (0.5 ms)`` on the next line (observed live)."""
    out: list[str] = []
    for ln in text.split("\n"):
        if out and ln[:1] in (" ", "\t") and ln.strip():
            out[-1] = out[-1].rstrip() + " " + ln.strip()
        else:
            out.append(ln)
    return out


def parse_sledgehammer(text: str) -> SledgehammerResult:
    text = normalize(text)
    res = SledgehammerResult(status="unknown", raw=text)
    seen: set[str] = set()
    saw_none = saw_timeout = False
    for line in (ln.strip() for ln in _logical_lines(text)):
        if not line:
            continue
        if m := _TRY_RE.match(line):
            proof = m.group("proof").strip()
            if not _PROOF_START.match(proof) or proof in seen:
                continue
            seen.add(proof)
            t = m.group("time")
            ms = None if t is None else float(t) * (1000.0 if m.group("unit") == "s" else 1.0)
            res.suggestions.append(ProofSuggestion(m.group("prover"), proof, ms))
        elif _NONE_RE.search(line):
            saw_none = True
        elif _TIMEOUT_RE.search(line):
            saw_timeout = True
    if res.suggestions:
        res.status = "proof_found"
    elif saw_timeout:
        res.status = "timeout"
    elif saw_none:
        res.status = "none"
    return res

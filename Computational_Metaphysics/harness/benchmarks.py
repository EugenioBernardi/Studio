"""Benchmark loading and blinded prompt rendering.

Only primary text reaches the agent. Metadata keys starting with ``_`` and the
``source`` block are never rendered unless ``reveal_attribution`` is set.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

ALLOWED_KINDS = {
    "definition", "axiom", "proposition", "demonstration",
    "explanation", "corollary", "note",
}
REQUIRED_KEYS = {"benchmark_id", "schema_version", "segments", "targets", "premises"}


class BenchmarkError(ValueError):
    pass


@dataclass(frozen=True)
class Segment:
    id: str
    kind: str
    label: str
    text: str


@dataclass(frozen=True)
class Benchmark:
    benchmark_id: str
    role: str
    segments: tuple[Segment, ...]
    targets: tuple[str, ...]
    premises: tuple[str, ...]
    source: dict
    ready: bool

    def segment(self, seg_id: str) -> Segment:
        for s in self.segments:
            if s.id == seg_id:
                return s
        raise KeyError(seg_id)


def validate(doc: dict) -> list[str]:
    """Return a list of schema problems (empty list = valid)."""
    problems: list[str] = []
    missing = REQUIRED_KEYS - doc.keys()
    if missing:
        problems.append(f"missing keys: {sorted(missing)}")
        return problems
    ids = [s.get("id") for s in doc["segments"]]
    if len(ids) != len(set(ids)):
        problems.append("duplicate segment ids")
    for s in doc["segments"]:
        if set(s) != {"id", "kind", "label", "text"}:
            problems.append(f"segment {s.get('id')}: keys must be id, kind, label, text")
        if s.get("kind") not in ALLOWED_KINDS:
            problems.append(f"segment {s.get('id')}: bad kind {s.get('kind')!r}")
        if not str(s.get("text", "")).strip():
            problems.append(f"segment {s.get('id')}: empty text")
    idset = set(ids)
    for ref in list(doc["targets"]) + list(doc["premises"]):
        if ref not in idset:
            problems.append(f"reference to unknown segment {ref}")
    return problems


def load(path: str | Path, *, require_ready: bool = True) -> Benchmark:
    path = Path(path)
    doc = json.loads(path.read_text(encoding="utf-8"))
    ready = doc.get("status", "ready") == "ready"
    if require_ready and not ready:
        raise BenchmarkError(
            f"{path.name}: status is {doc.get('status')!r}; fill in the primary text first"
        )
    problems = validate(doc)
    if problems and (ready or doc["segments"]):
        raise BenchmarkError(f"{path.name}: " + "; ".join(problems))
    return Benchmark(
        benchmark_id=doc["benchmark_id"],
        role=doc.get("role", ""),
        segments=tuple(Segment(**s) for s in doc["segments"]),
        targets=tuple(doc["targets"]),
        premises=tuple(doc["premises"]),
        source=doc.get("source", {}),
        ready=ready,
    )


def render_text(bench: Benchmark, *, reveal_attribution: bool = False) -> str:
    """Render the blinded primary text as the agent will see it."""
    lines: list[str] = []
    if reveal_attribution:
        lines.append(f"Source: {bench.source.get('work', '')} ({bench.source.get('translation', '')})")
        lines.append("")
    for s in bench.segments:
        lines.append(f"[{s.id}] ({s.kind}) {s.text}")
    lines.append("")
    lines.append("Premise segments: " + ", ".join(bench.premises))
    lines.append("Target segments: " + ", ".join(bench.targets))
    return "\n".join(lines)

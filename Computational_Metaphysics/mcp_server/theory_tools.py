"""Deterministic text operations on Isabelle theory sources.

* comment/string/cartouche masking (offset-preserving)
* theory header parsing and import policy (ground-truth guard at tool level)
* locating a named lemma and replacing its proof with a diagnostic command
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

BASE_SESSION = "HOML_Base"
BASE_IMPORT = '"HOML_Base.HOML_Base"'
_BASE_ALIASES = {"HOML_Base", "HOML_Base.HOML_Base", "../HOML_Base", "theories/HOML_Base"}
_ALLOWED_IMPORTS = {"Main", "Complex_Main"}
_ALLOWED_IMPORT_PREFIXES = ("HOL-Library.",)

FORBIDDEN_COMMANDS = (
    "ML", "ML_file", "ML_val", "ML_command", "ML_prf", "setup", "local_setup",
    "oracle", "method_setup", "attribute_setup", "simproc_setup", "SML_file",
    "generate_file", "export_generated_files", "compile_generated_files",
)
_FORBIDDEN_TEXT = (
    (re.compile(r"quick_and_dirty"), "quick_and_dirty"),
    (re.compile(r"\bskip_proof\b"), "skip_proof"),
    (re.compile(r"\bcheat\b"), "cheat"),
    (re.compile(r"ground_truth"), "reference to ground_truth"),
)

TOP_LEVEL = (
    "lemma", "theorem", "corollary", "proposition", "schematic_goal", "lemmas",
    "definition", "abbreviation", "axiomatization", "consts", "typedecl", "type_synonym",
    "fun", "function", "primrec", "datatype", "record", "locale", "interpretation",
    "context", "notation", "no_notation", "declare", "section", "subsection",
    "subsubsection", "chapter", "paragraph", "text", "txt", "end", "named_theorems",
    "inductive", "inductive_set", "instantiation", "class", "instance", "hide_const",
)
_PROOF_START = re.compile(
    r"\b(by|proof|apply|sorry|oops|using|unfolding|including|nitpick|sledgehammer|"
    r"quickcheck|try0|try|done|\.\.|\.)(?=\s|$|\()"
)


class PolicyError(ValueError):
    pass


def mask(text: str) -> str:
    """Blank out comments, "strings" and cartouches, preserving offsets and newlines."""
    out = list(text)
    i, n = 0, len(text)

    def blank(a: int, b: int) -> None:
        for k in range(a, b):
            if out[k] != "\n":
                out[k] = " "

    while i < n:
        if text.startswith("(*", i):
            depth, j = 1, i + 2
            while j < n and depth:
                if text.startswith("(*", j):
                    depth, j = depth + 1, j + 2
                elif text.startswith("*)", j):
                    depth, j = depth - 1, j + 2
                else:
                    j += 1
            blank(i, j)
            i = j
        elif text[i] == '"':
            j = i + 1
            while j < n and text[j] != '"':
                j += 2 if text[j] == "\\" else 1
            blank(i, min(j + 1, n))
            i = j + 1
        elif text[i] == "‹" or text.startswith(r"\<open>", i):
            depth, j = 0, i
            while j < n:
                if text[j] == "‹":
                    depth, j = depth + 1, j + 1
                elif text.startswith(r"\<open>", j):
                    depth, j = depth + 1, j + 7
                elif text[j] == "›":
                    depth, j = depth - 1, j + 1
                elif text.startswith(r"\<close>", j):
                    depth, j = depth - 1, j + 8
                else:
                    j += 1
                if depth == 0:
                    break
            blank(i, j)
            i = j
        else:
            i += 1
    return "".join(out)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


@dataclass(frozen=True)
class Header:
    name: str
    imports: tuple[str, ...]
    span: tuple[int, int]            # offsets of "theory ... begin"


_HEADER_RE = re.compile(r"\btheory\s+(?P<name>[\w.']+)\s+imports\s+(?P<imports>.*?)\bbegin\b", re.S)


def parse_header(text: str) -> Header:
    m = _HEADER_RE.search(mask(text))
    if not m:
        raise PolicyError("no 'theory <Name> imports ... begin' header found")
    raw_imports = text[m.start("imports"):m.end("imports")]
    imports = tuple(tok.strip('"') for tok in re.findall(r'"[^"]*"|\S+', raw_imports))
    return Header(m["name"], imports, (m.start(), m.end()))


def check_policy(text: str) -> list[str]:
    """Return policy violations (empty = acceptable)."""
    problems: list[str] = []
    try:
        hdr = parse_header(text)
    except PolicyError as e:
        return [str(e)]
    for imp in hdr.imports:
        if imp in _BASE_ALIASES or imp in _ALLOWED_IMPORTS or imp.startswith(_ALLOWED_IMPORT_PREFIXES):
            continue
        problems.append(f"import not allowed: {imp!r} (allowed: HOML_Base, Main, HOL-Library.*)")
    masked = mask(text)
    for cmd in FORBIDDEN_COMMANDS:
        if re.search(rf"(?m)^\s*{re.escape(cmd)}\b", masked):
            problems.append(f"forbidden command: {cmd}")
    for rx, label in _FORBIDDEN_TEXT:
        if rx.search(text):
            problems.append(f"forbidden content: {label}")
    return problems


def prepare(text: str, *, tag: str = "") -> tuple[str, str]:
    """Rename the theory to a content-addressed name and canonicalize the
    HOML_Base import. Returns (new_theory_name, new_text)."""
    problems = check_policy(text)
    if problems:
        raise PolicyError("; ".join(problems))
    hdr = parse_header(text)
    digest = hashlib.sha256((tag + "\0" + text).encode()).hexdigest()[:10]
    new_name = f"{hdr.name}_{digest}"
    imports = " ".join(BASE_IMPORT if i in _BASE_ALIASES else
                       (f'"{i}"' if "." in i or "-" in i else i) for i in hdr.imports)
    a, b = hdr.span
    # Keep the header's line count so Isabelle's message positions still refer
    # to the caller's line numbers.
    newlines = text.count("\n", a, b)
    new_header = f"theory {new_name} imports {imports}" + "\n" * newlines + " begin"
    new_text = text[:a] + new_header + text[b:]
    return new_name, new_text


def _top_level_starts(masked: str) -> list[tuple[int, str]]:
    rx = re.compile(r"(?m)^[ \t]*(?P<kw>" + "|".join(TOP_LEVEL) + r")\b")
    return [(m.start("kw"), m["kw"]) for m in rx.finditer(masked)]


@dataclass(frozen=True)
class LemmaSpan:
    name: str
    start: int          # offset of the lemma keyword
    proof_start: int    # offset where the proof (or diagnostic) begins
    end: int            # offset of the next top-level command (exclusive)


def find_lemma(text: str, name: str) -> LemmaSpan:
    masked = mask(text)
    rx = re.compile(r"(?m)^[ \t]*(lemma|theorem|corollary|proposition)\s+"
                    + re.escape(name) + r"\s*(\[[^\]]*\])?\s*:")
    m = rx.search(masked)
    if not m:
        raise PolicyError(f"lemma {name!r} not found (expected 'lemma {name}: ...')")
    starts = [s for s, _ in _top_level_starts(masked) if s > m.start()]
    end = starts[0] if starts else len(text)
    pm = _PROOF_START.search(masked, m.end(), end)
    proof_start = pm.start() if pm else end
    return LemmaSpan(name, m.start(), proof_start, end)


def lemma_names(text: str) -> list[str]:
    rx = re.compile(r"(?m)^[ \t]*(?:lemma|theorem|corollary|proposition)\s+([\w.']+)\s*(?:\[[^\]]*\])?\s*:")
    return rx.findall(mask(text))


def with_proof(text: str, name: str, proof: str) -> tuple[str, int]:
    """Theory text truncated after lemma ``name`` whose proof is replaced by
    ``proof``. Returns (text, 1-based line of the proof command)."""
    span = find_lemma(text, name)
    head = text[:span.proof_start].rstrip() + "\n  "
    line = _line_of(head + "x", len(head))
    return head + proof + "\n\nend\n", line


def with_command_before_end(text: str, command: str) -> tuple[str, int]:
    """Insert ``command`` right before the final ``end``."""
    masked = mask(text)
    ends = [m.start() for m in re.finditer(r"(?m)^[ \t]*end\b", masked)]
    if not ends:
        raise PolicyError("theory has no final 'end'")
    cut = ends[-1]
    head = text[:cut].rstrip() + "\n\n"
    line = _line_of(head + "x", len(head))
    return head + command + "\n\nend\n", line


# --------------------------------------------------------------------------
# Proof-escape guardrails
# --------------------------------------------------------------------------

_TERMINATOR = re.compile(r"\b(by|done|qed|sorry|oops)\b|(?<![\w.])\.\.?(?![\w.])")
_STMT_RE = r'(?P<stmt>"(?:[^"\\]|\\.)*"|\\<open>.*?\\<close>|‹.*?›)'
_AXIOM_ITEM = re.compile(r"(?P<name>[\w.']+)\s*(?:\[[^\]]*\])?\s*:\s*" + _STMT_RE, re.S)
_LEMMA_STMT = re.compile(r"(?m)^[ \t]*(?:lemma|theorem|corollary|proposition)\s+(?P<name>[\w.']+)"
                         r"\s*(?:\[[^\]]*\])?\s*:\s*" + _STMT_RE, re.S)


def _norm_stmt(s: str) -> str:
    s = s.strip()
    for a, b in (('"', '"'), (r"\<open>", r"\<close>"), ("‹", "›")):
        if s.startswith(a) and s.endswith(b):
            s = s[len(a):len(s) - len(b)]
            break
    return re.sub(r"\s+", "", s)


def axioms(text: str) -> list[tuple[str, str]]:
    """(name, statement) of every axiom introduced by ``axiomatization``."""
    masked = mask(text)
    starts = _top_level_starts(masked)
    out = []
    for k, (pos, kw) in enumerate(starts):
        if kw != "axiomatization":
            continue
        end = starts[k + 1][0] if k + 1 < len(starts) else len(text)
        where = masked.find("where", pos, end)
        if where < 0:
            continue
        out += [(m["name"], m["stmt"]) for m in _AXIOM_ITEM.finditer(text, where + 5, end)]
    return out


def lemma_statements(text: str) -> list[tuple[str, str]]:
    masked = mask(text)
    return [(m["name"], m["stmt"]) for m in _LEMMA_STMT.finditer(text)
            if masked[m.start():m.start("stmt")].strip()]   # skip matches inside comments


def unfinished_lemmas(text: str) -> list[str]:
    """Lemmas whose span contains no proof terminator (open proofs)."""
    masked = mask(text)
    out = []
    for name in lemma_names(text):
        span = find_lemma(text, name)
        if not _TERMINATOR.search(masked, span.proof_start, span.end):
            out.append(name)
    return out


def oops_lemmas(text: str) -> list[str]:
    masked = mask(text)
    out = []
    for name in lemma_names(text):
        span = find_lemma(text, name)
        if re.search(r"\boops\b", masked[span.proof_start:span.end]):
            out.append(name)
    return out


def proof_escape_problems(text: str) -> list[str]:
    """Ways to make a check pass without proving anything. Applied to the text
    Isabelle will actually check (after diagnostic commands are inserted)."""
    masked = mask(text)
    problems = []
    if re.search(r"\bsorry\b", masked):
        problems.append("'sorry' is not allowed: close the proof, or use 'oops' to leave it unproved")
    starts = _top_level_starts(masked)
    for name in unfinished_lemmas(text):
        span = find_lemma(text, name)
        nxt = next((kw for pos, kw in starts if pos >= span.end), None)
        if nxt == "axiomatization":
            problems.append(f"axiomatization while the proof of {name!r} is still open")
    ax = {_norm_stmt(s): n for n, s in axioms(text)}
    for lname, stmt in lemma_statements(text):
        if (aname := ax.get(_norm_stmt(stmt))) is not None:
            problems.append(f"lemma {lname!r} restates axiom {aname!r} (conclusion as axiom)")
    return problems

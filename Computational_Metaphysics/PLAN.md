# Build plan: Auto-Hermeneutics Benchmark

Each phase ends with a green `pytest`. A phase is only started once the previous
one passes (CLAUDE.md, rule 6).

| Phase | Deliverable | Tests |
|---|---|---|
| 0 | Scaffold, `CLAUDE.md`, `theories/HOML_Base.thy`, benchmark JSON + loader | `tests/test_phase0_scaffold.py` |
| 1 | `mcp_server/nitpick_parser.py`, `mcp_server/sledgehammer_parser.py` (deterministic) | `tests/test_nitpick_parser.py`, `tests/test_sledgehammer_parser.py` |
| 2 | `mcp_server/isabelle_client.py`: persistent TCP client for `isabelle server` | `tests/test_isabelle_client.py` (in-process fake server) |
| 3 | `mcp_server/theory.py` (draft → `.thy`), `mcp_server/prover.py` (tools), `mcp_server/server.py` (MCP) | `tests/test_theory.py`, `tests/test_prover.py`, `tests/test_server.py` |
| 4 | `harness/run_ablation.py` (tiers A0–A3, seeds, ground-truth guard, JSONL traces) | `tests/test_guard.py`, `tests/test_run_ablation.py` |
| 5 | `harness/evaluator.py` (metrics, cheating-mode flags) | `tests/test_evaluator.py` |
| 6 | `export/diagrams.py`, `export/to_paper_orchestra.py`, templates | `tests/test_diagrams.py`, `tests/test_export.py` |

Integration tests that need a live Isabelle are marked `isabelle` and skip if
`isabelle` is not on `PATH`.

## Ablation tiers

The four tiers add one capability each. Tools are exposed to the agent only when
the tier allows them; the harness (not the LLM) enforces the gate in A3.

| Tier | Agent sees | Feedback loop |
|---|---|---|
| **A0** zero-shot | text only | none: one draft, scored afterwards |
| **A1** prover feedback | `check_theory`, `sledgehammer` | compile errors, proof found / not found |
| **A2** + countermodels | A1 + `nitpick` | parsed Kripke countermodels (JSON) for failing targets |
| **A3** + gated abduction | A2 + `propose_hidden_premise` | every axiom change must pass `check_consistency` before any proof attempt |

A draft is a structured JSON object (`mcp_server/theory.py: TheoryDraft`), not
free `.thy` text. This makes the axiom/theorem split, hidden premises and
target mapping explicit and lets the harness reject `imports` of anything but
`HOML_Base`.

## Metrics (evaluator)

Per (benchmark, tier, seed): target coverage, proved-target rate, consistency
(genuine model found), number of hidden premises, countermodel-repair iterations,
token and wall-clock cost, and cheating flags:

- `sorry_or_oops`: claimed theorem not actually closed
- `conclusion_as_axiom`: a target formula (modulo whitespace/α-names) appears as an axiom
- `begging_premise`: a single hidden premise alone entails the target (checked with Isabelle when available)
- `vacuous_axioms`: no model found for the axiom set
- `embedding_tampering`: redefines `r`, modal operators or validity, or imports anything other than `HOML_Base`
- `forbidden_command`: `ML`, `oracle`, `skip_proof`, `cheat`, `declare [[quick_and_dirty]]` …
- `ground_truth_reference`: any mention of `ground_truth` in a draft

Ground-truth-dependent metrics (hidden-premise recall vs the reference) are
computed only by `evaluator.py --ground-truth`, in a separate process.

## Original sketch

The first commit held this directory sketch as a plain file named
`Computational_Metaphysics` (project then called `auto-hermeneutics/`); it is
superseded by the tree in `README.md`.

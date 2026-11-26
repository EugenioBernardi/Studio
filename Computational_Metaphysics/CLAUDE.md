# Computational_Metaphysics — repository rules

Benchmark for **countermodel-driven philosophical autoformalization**: an LLM agent
formalizes classical texts in Isabelle/HOL + a LogiKEy-style embedding of
higher-order modal logic, under a blinded 4-way ablation (A0–A3). Results are
exported as a PaperOrchestra input bundle. See `PLAN.md` for phases and tier
definitions.

## Hard constraints (non-negotiable)

1. **Ground-truth isolation.** Never read, grep, glob, `cat`, list or reference the
   contents of `theories/ground_truth/` while writing prompts, benchmarks, harness
   code or while running evaluation loops. `harness/run_ablation.py` enforces this
   with a path guard plus a `sys.addaudithook` hook; do not weaken or bypass either.
   Only the post-hoc scorer (`harness/evaluator.py --ground-truth`) may open those
   files, and only in its own process, never feeding back into prompts.
2. **Mandatory consistency gate.** In tier `A3`, every draft that adds or alters an
   axiom or a `hidden_premise_*` must pass `check_consistency`
   (`nitpick [satisfy, user_axioms, card=1-4]` finds a genuine model) **before** any
   theorem proof is attempted. Vacuous (unsatisfiable) axiom sets are rejected.
3. **Deterministic parsing only.** Never use an LLM to parse Nitpick or Sledgehammer
   output. `mcp_server/nitpick_parser.py` and `mcp_server/sledgehammer_parser.py`
   are regex/state-machine Python with unit tests; extend the tests when you extend them.
4. **Immutable formal artifacts.** Never hand-edit generated `.thy` files under
   `outputs/`. Formal code destined for LaTeX is copied verbatim (checksummed) for
   `\lstinputlisting`.
5. **Deterministic countermodel diagrams.** Kripke countermodels are rendered to
   Graphviz DOT / TikZ from parsed JSON by `export/diagrams.py`. Never use a VLM or an
   image model to draw logical graphs.
6. **Incremental execution.** Each phase in `PLAN.md` must pass `pytest` before work
   on the next phase starts. Do not skip ahead.

## Working conventions

- Python ≥ 3.11. Run tests with `pytest` from this directory.
- Tests that need a real Isabelle installation are marked `@pytest.mark.isabelle` and
  skip automatically when `isabelle` is not on `PATH`.
- Benchmarks (`benchmarks/*.json`) contain primary text only: no formalizations, no
  commentary, no hints about hidden premises.
- Every run writes JSONL traces under `outputs/runs/<run_id>/`; never overwrite a
  finished run directory.

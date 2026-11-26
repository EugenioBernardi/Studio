# Fixtures

All `nitpick/*.txt` and `sledgehammer/*.txt` files are **verbatim** message texts
captured from a live Isabelle2025 server (`use_theories`, `unicode_symbols=true`)
on 2026-11-26, from the probe theories in `tests/fixtures/probes/`. Files whose
name starts with `synthetic_` are hand-written to cover branches not yet observed
live; replace them with captured output when one is seen.

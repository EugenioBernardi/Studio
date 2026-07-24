#!/usr/bin/env python3
"""Inline models/kuramoto-assembly.js into apps/kuramoto-assembly.template.html.

The model is the single source of truth (it also runs headless). This script injects
it verbatim into the app template at the /*__MODEL__*/ marker, so the shipped app and
the validated model can never drift. Patch the template and this script together.

Usage:  python3 build/build-kuramoto-assembly.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "kuramoto-assembly.js"
TEMPLATE = ROOT / "apps" / "kuramoto-assembly.template.html"
OUT = ROOT / "apps" / "kuramoto-assembly.html"
MARKER = "/*__MODEL__*/"


def main() -> int:
    model = MODEL.read_text(encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")
    if MARKER not in template:
        print(f"error: marker {MARKER!r} not found in {TEMPLATE.name}", file=sys.stderr)
        return 1
    # The headless test block is guarded by `typeof require !== 'undefined'`, so it is
    # inert in the browser; inline the file verbatim rather than trying to strip it.
    out = template.replace(MARKER, model)
    OUT.write_text(out, encoding="utf-8")
    print(f"built {OUT.relative_to(ROOT)}  ({len(out):,} bytes, model {len(model):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

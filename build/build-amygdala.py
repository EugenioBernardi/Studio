#!/usr/bin/env python3
"""Inline models/amygdala.js into apps/amygdala.template.html.

The model is the single source of truth (it also runs headless). This injects it
verbatim at the /*__MODEL__*/ marker so the app and the validated model cannot drift.
Patch the template and this script together.

Usage:  python3 build/build-amygdala.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "amygdala.js"
TEMPLATE = ROOT / "apps" / "amygdala.template.html"
OUT = ROOT / "apps" / "amygdala.html"
MARKER = "/*__MODEL__*/"


def main() -> int:
    model = MODEL.read_text(encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")
    if MARKER not in template:
        print(f"error: marker {MARKER!r} not found in {TEMPLATE.name}", file=sys.stderr)
        return 1
    OUT.write_text(template.replace(MARKER, model), encoding="utf-8")
    print(f"built {OUT.relative_to(ROOT)}  ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

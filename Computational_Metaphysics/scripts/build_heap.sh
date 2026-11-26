#!/usr/bin/env bash
# Pre-compile the HOML_Base heap image (HOL + embedding) so that the MCP server
# starts its PIDE session from a saved heap instead of re-checking HOL.
# Usage: scripts/build_heap.sh   (honours $ISABELLE_EXE, else `isabelle` on PATH)
set -euo pipefail
cd "$(dirname "$0")/.."
ISABELLE="${ISABELLE_EXE:-$(command -v isabelle || true)}"
if [[ -z "$ISABELLE" ]]; then
  echo "isabelle not found: set ISABELLE_EXE or add it to PATH" >&2
  exit 1
fi
"$ISABELLE" version
"$ISABELLE" build -b -v -d theories HOML_Base

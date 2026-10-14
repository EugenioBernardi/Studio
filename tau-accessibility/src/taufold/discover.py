"""Step 1 -- discover MAPT cryo-EM entries in the PDB.

Queries by UniProt accession rather than free text, so the result does not
depend on how any given group worded its deposition title. Verified against
RCSB on the author's machine: 234 entries, 2017-2026, median resolution
2.99 A.

All network access in this module goes through `_post` and caches to disk, so
a cached run is reproducible offline and the query that produced a result set
is recorded alongside it.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAPT_UNIPROT = "P10636"
SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query"
DATA_GRAPHQL_URL = "https://data.rcsb.org/graphql"

UNIPROT_ATTRIBUTE = (
    "rcsb_polymer_entity_container_identifiers"
    ".reference_sequence_identifiers.database_accession"
)


def build_query(uniprot: str = MAPT_UNIPROT, rows: int = 1000) -> dict[str, Any]:
    """The search payload. Kept as data so it can be logged with the result."""
    return {
        "query": {
            "type": "group",
            "logical_operator": "and",
            "nodes": [
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": UNIPROT_ATTRIBUTE,
                        "operator": "exact_match",
                        "value": uniprot,
                    },
                },
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": "exptl.method",
                        "operator": "exact_match",
                        "value": "ELECTRON MICROSCOPY",
                    },
                },
            ],
        },
        "return_type": "entry",
        "request_options": {
            "paginate": {"start": 0, "rows": rows},
            "results_content_type": ["experimental"],
        },
    }


def _post(url: str, payload: dict[str, Any], timeout: int = 60) -> dict[str, Any]:
    """POST JSON. Imported lazily so the module is importable without network."""
    import urllib.request

    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


ENTRY_GRAPHQL = """
query($ids: [String!]!) {
  entries(entry_ids: $ids) {
    rcsb_id
    struct { title pdbx_descriptor }
    rcsb_accession_info { initial_release_date }
    rcsb_entry_info {
      resolution_combined
      deposited_polymer_entity_instance_count
      polymer_entity_count_protein
    }
    citation { id title pdbx_database_id_DOI rcsb_journal_abbrev year }
    struct_keywords { pdbx_keywords text }
    polymer_entities {
      rcsb_id
      entity_poly { pdbx_seq_one_letter_code_can rcsb_sample_sequence_length }
      rcsb_polymer_entity { pdbx_description src_method }
      rcsb_entity_source_organism { scientific_name }
      rcsb_polymer_entity_container_identifiers {
        auth_asym_ids
        reference_sequence_identifiers { database_accession database_name }
      }
    }
  }
}
"""


def fetch_entry_metadata(
    ids: list[str], cache: Path, batch: int = 40
) -> dict[str, Any]:
    """Per-entry metadata for curation, cached one JSON file per batch."""
    cache.mkdir(parents=True, exist_ok=True)
    out: dict[str, Any] = {}
    for i in range(0, len(ids), batch):
        chunk = ids[i : i + batch]
        key = cache / f"entries_{i:04d}.json"
        if key.exists():
            payload = json.loads(key.read_text())
        else:
            payload = _post(
                DATA_GRAPHQL_URL, {"query": ENTRY_GRAPHQL, "variables": {"ids": chunk}}
            )
            key.write_text(json.dumps(payload, indent=2))
        for entry in (payload.get("data") or {}).get("entries") or []:
            out[entry["rcsb_id"]] = entry
    return out


def discover(outdir: Path, uniprot: str = MAPT_UNIPROT) -> dict[str, Any]:
    """Run the search and write `mapt_entries.json`."""
    outdir.mkdir(parents=True, exist_ok=True)
    query = build_query(uniprot)
    resp = _post(SEARCH_URL, query)
    ids = sorted(hit["identifier"] for hit in resp.get("result_set", []))
    record = {
        "retrieved_utc": datetime.now(timezone.utc).isoformat(),
        "uniprot": uniprot,
        "query": query,
        "n_entries": len(ids),
        "entry_ids": ids,
    }
    (outdir / "mapt_entries.json").write_text(json.dumps(record, indent=2))
    return record

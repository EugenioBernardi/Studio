import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mcp_server.isabelle_client import find_isabelle  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


def pytest_collection_modifyitems(config, items):
    if find_isabelle() is None:
        skip = pytest.mark.skip(reason="isabelle not found (set ISABELLE_EXE or PATH)")
        for item in items:
            if "isabelle" in item.keywords:
                item.add_marker(skip)


@pytest.fixture
def root() -> Path:
    return ROOT


def fixture_text(rel: str) -> str:
    return (FIXTURES / rel).read_text(encoding="utf-8")

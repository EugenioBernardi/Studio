import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

FIXTURES = Path(__file__).parent / "fixtures"


def pytest_collection_modifyitems(config, items):
    if shutil.which("isabelle") is None:
        skip = pytest.mark.skip(reason="isabelle not on PATH")
        for item in items:
            if "isabelle" in item.keywords:
                item.add_marker(skip)


@pytest.fixture
def root() -> Path:
    return ROOT

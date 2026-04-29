from pathlib import Path
from uuid import uuid4


def make_data_dir() -> Path:
    base_dir = Path(".testdata")
    base_dir.mkdir(exist_ok=True)
    data_dir = base_dir / uuid4().hex
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir

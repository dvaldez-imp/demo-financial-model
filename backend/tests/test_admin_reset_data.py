from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_reset_data_endpoint_clears_data_without_seed() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=True))

    before = client.get("/models")
    assert before.status_code == 200
    assert len(before.json()) > 0

    reset = client.post("/admin/reset-data", json={"seed_demo": False})
    assert reset.status_code == 200
    payload = reset.json()
    assert payload["status"] == "ok"
    assert payload["seed_demo"] is False
    assert payload["models_count"] == 0

    after = client.get("/models")
    assert after.status_code == 200
    assert after.json() == []

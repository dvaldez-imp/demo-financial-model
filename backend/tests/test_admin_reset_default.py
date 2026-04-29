from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_reset_data_without_body_defaults_to_seed_demo_true() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    response = client.post("/admin/reset-data")
    assert response.status_code == 200
    payload = response.json()

    assert payload["seed_demo"] is True
    assert payload["models_count"] == 7

    models = client.get("/models").json()
    assert {item["id"] for item in models} == {
        "model_ventas",
        "model_combustible",
        "model_macro",
        "model_arima",
        "model_agro",
        "model_expansion",
        "model_holding",
    }

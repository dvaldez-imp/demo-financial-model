from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_reject_duplicate_library_premise_name_in_same_model() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Modelo A", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]

    library = client.post(
        "/library/premises",
        json={"name": "Gasolina", "unit": "Q/gal", "category": "Costo", "prediction": {"method": "manual", "params": {}}},
    ).json()

    first = client.post(f"/models/{model_id}/premises", json={"library_premise_id": library["id"]})
    assert first.status_code == 201

    duplicate = client.post(f"/models/{model_id}/premises", json={"library_premise_id": library["id"]})
    assert duplicate.status_code == 400
    assert "already exists" in duplicate.json()["detail"].lower()


def test_allow_same_local_name_in_different_models() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_a = client.post(
        "/models",
        json={"name": "Modelo A", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    model_b = client.post(
        "/models",
        json={"name": "Modelo B", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]

    response_a = client.post(
        f"/models/{model_a}/premises",
        json={"name": "Costo Logistico", "prediction_base": {"method": "manual", "params": {}}},
    )
    response_b = client.post(
        f"/models/{model_b}/premises",
        json={"name": "Costo Logistico", "prediction_base": {"method": "manual", "params": {}}},
    )

    assert response_a.status_code == 201
    assert response_b.status_code == 201


def test_reject_duplicate_library_name_globally() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    first = client.post(
        "/library/premises",
        json={"name": "Inflacion", "unit": "%", "category": "Macro", "prediction": {"method": "manual", "params": {}}},
    )
    duplicate = client.post(
        "/library/premises",
        json={"name": "Inflacion", "unit": "%", "category": "Macro", "prediction": {"method": "manual", "params": {}}},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 400
    assert "already exists" in duplicate.json()["detail"].lower()

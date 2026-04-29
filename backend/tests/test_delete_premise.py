from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_delete_premise_without_dependencies() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Delete simple", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Costo", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]

    response = client.delete(f"/models/{model_id}/premises/{premise_id}")
    assert response.status_code == 204

    board = client.get(f"/models/{model_id}/board").json()
    assert all(item["id"] != premise_id for item in board["premises"])


def test_delete_premise_with_transitive_dependents_returns_409() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    source_model_id = client.post(
        "/models",
        json={"name": "Ventas", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    source_premise_id = client.post(
        f"/models/{source_model_id}/premises",
        json={"name": "Demanda", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]
    output_id = client.post(
        f"/models/{source_model_id}/outputs",
        json={"name": "demanda_exportada", "display_name": "Demanda exportada", "source_premise_id": source_premise_id},
    ).json()["id"]

    target_model_id = client.post(
        "/models",
        json={"name": "Operaciones", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    import_response = client.post(
        f"/models/{target_model_id}/premises/from-output",
        json={"output_id": output_id, "name_override": "Demanda importada"},
    )
    assert import_response.status_code == 201

    response = client.delete(f"/models/{source_model_id}/premises/{source_premise_id}")
    assert response.status_code == 409
    assert "dependent" in response.json()["detail"].lower()

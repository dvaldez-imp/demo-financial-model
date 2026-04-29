from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_dependency_tree_returns_unique_dependencies_without_duplicates() -> None:
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
    root_premise_id = client.post(
        f"/models/{target_model_id}/premises/from-output",
        json={"output_id": output_id, "name_override": "Demanda importada"},
    ).json()["id"]

    response = client.get(
        f"/models/{target_model_id}/dependencies/tree",
        params={"root_premise_id": root_premise_id},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["root"]["id"] == root_premise_id
    assert any(item["id"] == output_id and item["type"] == "model_output" for item in payload["nodes"])
    assert any(item["id"] == source_premise_id and item["type"] == "premise" for item in payload["nodes"])

    unique_ids = [f"{item['type']}:{item['id']}" for item in payload["unique_dependencies"]]
    assert len(unique_ids) == len(set(unique_ids))

from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_dependencies_endpoint_returns_nodes_and_edges() -> None:
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
    imported_premise_id = client.post(
        f"/models/{target_model_id}/premises/from-output",
        json={"output_id": output_id, "name_override": "Demanda importada"},
    ).json()["id"]

    payload = client.get(f"/models/{target_model_id}/dependencies").json()
    assert any(node["id"] == imported_premise_id and node["type"] == "premise" for node in payload["nodes"])
    assert any(node["id"] == output_id and node["type"] == "model_output" for node in payload["nodes"])
    assert any(edge["from_id"] == output_id and edge["to_id"] == imported_premise_id and edge["relation"] == "uses" for edge in payload["edges"])

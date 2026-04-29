from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_create_output_and_reuse_as_premise() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    source_model_id = client.post(
        "/models",
        json={"name": "Ventas", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    source_premise_id = client.post(
        f"/models/{source_model_id}/premises",
        json={
            "name": "Demanda",
            "unit": "ton",
            "prediction_base": {
                "method": "carry_forward",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{source_model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nDemanda\t10\t20"})

    output = client.post(
        f"/models/{source_model_id}/outputs",
        json={"name": "demanda_exportada", "display_name": "Demanda exportada", "source_premise_id": source_premise_id},
    ).json()

    catalog = client.get("/catalog/model-outputs").json()
    assert any(item["id"] == output["id"] for item in catalog)

    target_model_id = client.post(
        "/models",
        json={"name": "Operaciones", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise = client.post(
        f"/models/{target_model_id}/premises/from-output",
        json={"output_id": output["id"], "name_override": "Demanda importada"},
    ).json()

    board = client.get(f"/models/{target_model_id}/board").json()
    imported = next(item for item in board["premises"] if item["id"] == premise["id"])
    assert imported["source"] == "model_output"
    assert [value["value"] for value in imported["values"][:4]] == [10.0, 20.0, 20.0, 20.0]
    assert all(value["editable"] is False for value in imported["values"])

from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_cycle_detection_blocks_invalid_dependency_update() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Ciclos", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    base_premise_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "A", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]

    output_id = client.post(
        f"/models/{model_id}/outputs",
        json={"name": "a_export", "display_name": "A export", "source_premise_id": base_premise_id},
    ).json()["id"]

    dependent_premise_id = client.post(
        f"/models/{model_id}/premises/from-output",
        json={"output_id": output_id, "name_override": "B"},
    ).json()["id"]

    response = client.patch(
        f"/models/{model_id}/outputs/{output_id}",
        json={"source_premise_id": dependent_premise_id},
    )

    assert response.status_code == 409
    assert "ciclo" in response.json()["detail"].lower()


def test_cycle_detection_blocks_cross_model_cycle_via_imported_outputs() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_a = client.post(
        "/models",
        json={"name": "Modelo A", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    premise_a = client.post(
        f"/models/{model_a}/premises",
        json={"name": "A", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]
    output_a = client.post(
        f"/models/{model_a}/outputs",
        json={"name": "a_export", "display_name": "A export", "source_premise_id": premise_a},
    ).json()["id"]

    model_b = client.post(
        "/models",
        json={"name": "Modelo B", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    imported_into_b = client.post(
        f"/models/{model_b}/premises/from-output",
        json={"output_id": output_a, "name_override": "A importada"},
    ).json()["id"]
    output_b = client.post(
        f"/models/{model_b}/outputs",
        json={"name": "b_export", "display_name": "B export", "source_premise_id": imported_into_b},
    ).json()["id"]

    imported_into_a = client.post(
        f"/models/{model_a}/premises/from-output",
        json={"output_id": output_b, "name_override": "B importada"},
    ).json()["id"]

    response = client.patch(
        f"/models/{model_a}/outputs/{output_a}",
        json={"source_premise_id": imported_into_a},
    )

    assert response.status_code == 409
    assert "ciclo" in response.json()["detail"].lower()

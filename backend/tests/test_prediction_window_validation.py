from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_prediction_window_rejects_invalid_range() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Ventana", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-06"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Precio", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]

    response = client.patch(
        f"/premises/{premise_id}/prediction-config",
        json={
            "base": {
                "method": "growth_rate_pct",
                "params": {"rate": 2},
                "forecast_start_period_key": "2025-06",
                "forecast_end_period_key": "2025-04",
            }
        },
    )

    assert response.status_code == 400
    assert "forecast_start_period_key" in response.json()["detail"]

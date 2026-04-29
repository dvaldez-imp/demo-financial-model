from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_forecast_follows_board_timeline_even_if_premise_window_is_shorter() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Scope", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-05"},
    ).json()["id"]

    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Precio",
            "prediction_base": {
                "method": "growth_rate_pct",
                "params": {"rate": 10},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-03"
            }
        },
    ).json()["id"]

    client.post(
        f"/models/{model_id}/import-grid",
        json={"raw_text": "Premisa\tene-25\tfeb-25\nPrecio\t10\t20"},
    )

    board = client.get(f"/models/{model_id}/board").json()
    values = next(item for item in board["premises"] if item["id"] == premise_id)["values"]

    assert values[2]["value"] == 22.0
    assert round(values[3]["value"], 2) == 24.2
    assert round(values[4]["value"], 2) == 26.62

from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def _summary_value(payload: dict, premise_id: str, year_key: str = "2025") -> float | None:
    premise = next(item for item in payload["premises"] if item["id"] == premise_id)
    summary = next(item for item in premise["values"] if item["period_key"] == year_key)
    return summary["value"]


def test_year_summary_methods_sum_avg_last_value() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Resumen", "actuals_end_period_key": "2025-03", "forecast_end_period_key": "2025-03"},
    ).json()["id"]

    sum_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Ventas", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]
    avg_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Precio", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]
    last_id = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Inventario", "prediction_base": {"method": "manual", "params": {}}},
    ).json()["id"]

    client.patch(f"/premises/{sum_id}/year-summary-config", json={"year_summary_method": "sum"})
    client.patch(f"/premises/{avg_id}/year-summary-config", json={"year_summary_method": "avg"})
    client.patch(f"/premises/{last_id}/year-summary-config", json={"year_summary_method": "last_value"})

    client.post(
        f"/models/{model_id}/import-grid",
        json={
            "raw_text": "Premisa\tene-25\tfeb-25\tmar-25\nVentas\t10\t20\t30\nPrecio\t10\t\t20\nInventario\t5\t7\t9"
        },
    )

    board = client.get(f"/models/{model_id}/board")
    assert board.status_code == 200
    payload = board.json()

    assert _summary_value(payload, sum_id) == 60.0
    assert _summary_value(payload, avg_id) == 15.0
    assert _summary_value(payload, last_id) == 9.0

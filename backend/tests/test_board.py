import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_board_returns_zone_prediction_and_value_origins() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model = client.post("/models", json={"name": "Modelo board"}).json()
    model_id = model["id"]
    client.patch(
        f"/models/{model_id}/timeline",
        json={"actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    )
    premise = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Ventas", "unit": "Q", "category": "Ingreso", "prediction_base": {"method": "manual", "params": {}}},
    ).json()
    client.post(
        f"/models/{model_id}/import-grid",
        json={"raw_text": "Premisa\tene-25\tfeb-25\nVentas\t100\t120"},
    )
    client.patch(
        f"/premises/{premise['id']}/prediction-config",
        json={
            "base": {
                "method": "growth_rate_pct",
                "params": {"rate": 10},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    )

    response = client.get(f"/models/{model_id}/board")
    assert response.status_code == 200
    payload = response.json()
    assert [period["zone"] for period in payload["periods"]] == ["historical", "historical", "forecast", "forecast", "summary"]

    ventas = next(item for item in payload["premises"] if item["id"] == premise["id"])
    assert ventas["prediction_base"]["method"] == "growth_rate_pct"
    assert "prediction_override" not in ventas
    assert ventas["values"][0]["value_origin"] == "actual"
    assert ventas["values"][2]["value_origin"] == "forecast_generated"
    assert ventas["values"][2]["value"] == pytest.approx(132.0)
    assert ventas["values"][4]["value_origin"] == "year_summary"


def test_board_returns_year_groups_and_extended_forecast_end() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model = client.post(
        "/models",
        json={
            "name": "Modelo extendido",
            "actuals_end_period_key": "2025-03",
            "forecast_end_period_key": "2026-12",
        },
    ).json()

    board = client.get(f"/models/{model['id']}/board")
    assert board.status_code == 200
    payload = board.json()

    assert payload["model"]["forecast_end_period_key"] == "2026-12"
    assert any(period["key"] == "2026-12" and period["zone"] == "forecast" for period in payload["periods"])
    assert any(group["year"] == 2025 and group["summary_period_key"] == "2025" for group in payload["year_groups"])
    assert any(group["year"] == 2026 and group["summary_period_key"] == "2026" for group in payload["year_groups"])


def test_switching_base_to_manual_keeps_visible_forecast() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model = client.post(
        "/models",
        json={"name": "Manual switch", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()
    premise = client.post(
        f"/models/{model['id']}/premises",
        json={
            "name": "Demanda",
            "prediction_base": {
                "method": "growth_rate_pct",
                "params": {"rate": 10},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()
    client.post(
        f"/models/{model['id']}/import-grid",
        json={"raw_text": "Premisa\tene-25\tfeb-25\nDemanda\t100\t120"},
    )

    response = client.patch(
        f"/premises/{premise['id']}/prediction-config",
        json={
            "base": {
                "method": "manual",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            }
        },
    )
    assert response.status_code == 200

    board = client.get(f"/models/{model['id']}/board").json()
    values = next(item for item in board["premises"] if item["id"] == premise["id"])["values"]
    assert values[0]["value"] == pytest.approx(100.0)
    assert values[1]["value"] == pytest.approx(120.0)
    assert values[2]["value"] == pytest.approx(132.0)
    assert values[3]["value"] == pytest.approx(145.2)
    assert values[2]["value_origin"] == "forecast_manual"
    assert values[2]["editable"] is True
    assert values[3]["value_origin"] == "forecast_manual"
    assert values[3]["editable"] is True

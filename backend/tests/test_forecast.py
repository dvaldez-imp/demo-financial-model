from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def _grid_row(headers: list[str], values: list[float]) -> str:
    rendered = "\t".join(str(value) for value in values)
    return f"Premisa\t" + "\t".join(headers) + f"\nSerie\t{rendered}"


def test_carry_forward_generates_forecast_values() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Carry", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Demanda",
            "prediction_base": {
                "method": "carry_forward",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nDemanda\t10\t12"})

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert [item["value"] for item in values[:4]] == [10.0, 12.0, 12.0, 12.0]
    assert values[2]["value_origin"] == "forecast_generated"


def test_growth_rate_pct_generates_forecast_values() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Growth", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Precio",
            "prediction_base": {
                "method": "growth_rate_pct",
                "params": {"rate": 10},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nPrecio\t10\t20"})

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert values[2]["value"] == 22.0
    assert round(values[3]["value"], 2) == 24.2


def test_moving_average_generates_smoothed_forecast_and_label() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Moving average", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Serie",
            "prediction_base": {
                "method": "moving_average",
                "params": {"window": 2},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()
    assert premise["prediction_base"]["method_label"] == "Promedio movil"
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nSerie\t10\t20"})

    board = client.get(f"/models/{model_id}/board").json()
    board_premise = next(p for p in board["premises"] if p["id"] == premise["id"])
    assert board_premise["prediction_base"]["method_label"] == "Promedio movil"
    values = board_premise["values"]
    assert values[2]["value"] == 15.0
    assert values[3]["value"] == 17.5


def test_linear_trend_generates_forecast_values() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Linear trend", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Serie",
            "prediction_base": {
                "method": "linear_trend",
                "params": {"lookback_periods": 2},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nSerie\t10\t20"})

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert values[2]["value"] == 30.0
    assert values[3]["value"] == 40.0


def test_linear_trend_falls_back_to_carry_forward_with_insufficient_history() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Linear fallback", "actuals_end_period_key": "2025-01", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Serie",
            "prediction_base": {
                "method": "linear_trend",
                "params": {"lookback_periods": 12},
                "forecast_start_period_key": "2025-02",
                "forecast_end_period_key": "2025-03",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\nSerie\t10"})

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert values[1]["value"] == 10.0
    assert values[2]["value"] == 10.0


def test_seasonal_naive_repeats_same_month_previous_cycle() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Seasonal", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Serie",
            "prediction_base": {
                "method": "seasonal_naive",
                "params": {"season_length": 12},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    headers = [
        "ene-24", "feb-24", "mar-24", "abr-24", "may-24", "jun-24",
        "jul-24", "ago-24", "sep-24", "oct-24", "nov-24", "dic-24",
        "ene-25", "feb-25",
    ]
    values = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 115, 125]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": _grid_row(headers, values)})

    board = client.get(f"/models/{model_id}/board").json()
    projected = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    by_key = {item["period_key"]: item["value"] for item in projected}
    assert by_key["2025-03"] == 120.0
    assert by_key["2025-04"] == 130.0


def test_arima_like_differs_from_carry_forward_and_linear_trend_when_seasonality_exists() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "ARIMA like", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Serie",
            "prediction_base": {
                "method": "arima_like",
                "params": {"lookback_periods": 14},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-03",
            },
        },
    ).json()["id"]
    headers = [
        "ene-24", "feb-24", "mar-24", "abr-24", "may-24", "jun-24",
        "jul-24", "ago-24", "sep-24", "oct-24", "nov-24", "dic-24",
        "ene-25", "feb-25",
    ]
    values = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 130, 132]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": _grid_row(headers, values)})

    board = client.get(f"/models/{model_id}/board").json()
    projected = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    march_value = next(item["value"] for item in projected if item["period_key"] == "2025-03")
    assert round(march_value, 2) == 124.21
    assert march_value != 132.0
    assert march_value != 134.0


def test_switching_base_forecast_to_manual_keeps_projected_values_editable() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Manual base", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Gasolina",
            "prediction_base": {
                "method": "growth_rate_pct",
                "params": {"rate": 10},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nGasolina\t10\t20"})

    response = client.patch(
        f"/premises/{premise_id}/prediction-config",
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

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert [values[0]["value"], values[1]["value"], values[2]["value"]] == [10.0, 20.0, 22.0]
    assert round(values[3]["value"], 2) == 24.2
    assert values[2]["value_origin"] == "forecast_manual"
    assert values[2]["editable"] is True
    assert values[3]["value_origin"] == "forecast_manual"
    assert values[3]["editable"] is True


def test_manual_forecast_without_saved_values_is_editable() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))
    model_id = client.post(
        "/models",
        json={"name": "Manual empty", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-04"},
    ).json()["id"]
    premise_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Inflacion",
            "prediction_base": {
                "method": "manual",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-04",
            },
        },
    ).json()["id"]
    client.post(f"/models/{model_id}/import-grid", json={"raw_text": "Premisa\tene-25\tfeb-25\nInflacion\t4.1\t4.3"})

    board = client.get(f"/models/{model_id}/board").json()
    values = next(p for p in board["premises"] if p["id"] == premise_id)["values"]
    assert values[2]["value"] is None
    assert values[2]["value_origin"] == "forecast_manual"
    assert values[2]["editable"] is True
    assert values[3]["value"] is None
    assert values[3]["value_origin"] == "forecast_manual"
    assert values[3]["editable"] is True

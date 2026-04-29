from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_seed_demo_builds_varied_models_with_forecast_only_in_2026() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=True))

    models = client.get("/models")
    assert models.status_code == 200
    payload = models.json()
    assert {item["id"] for item in payload} == {
        "model_ventas",
        "model_combustible",
        "model_macro",
        "model_arima",
        "model_agro",
        "model_expansion",
        "model_holding",
    }

    expected_starts = {
        "model_ventas": "2021-01",
        "model_combustible": "2022-01",
        "model_macro": "2022-01",
        "model_arima": "2021-01",
        "model_agro": "2021-01",
        "model_expansion": "2022-01",
        "model_holding": "2022-01",
    }
    expected_methods = {
        "model_ventas": ("Demanda retail exportada", "linear_trend", "Tendencia lineal"),
        "model_combustible": ("Gasolina regular", "seasonal_naive", "Estacional / oscilante"),
        "model_macro": ("Tipo de cambio USD/GTQ", "moving_average", "Promedio movil"),
        "model_arima": ("Demanda operativa", "arima_like", "ARIMA simplificado"),
        "model_agro": ("Volumen cafe exportado", "seasonal_naive", "Estacional / oscilante"),
        "model_expansion": ("Tiendas nuevas", "linear_trend", "Tendencia lineal"),
        "model_holding": ("Resultado holding", "formula_placeholder", "Formula placeholder"),
    }
    expected_scenarios = {
        "model_ventas": {"Base", "Upside comercial"},
        "model_combustible": {"Base", "Choque alcista"},
        "model_macro": {"Base", "Depreciacion GTQ"},
        "model_arima": {"Base", "Stress", "Upside operativo"},
        "model_agro": {"Base", "Sequia"},
        "model_expansion": {"Base", "Expansion agresiva"},
        "model_holding": {"Base", "Sinergias"},
    }

    for model_id, start_key in expected_starts.items():
        board = client.get(f"/models/{model_id}/board")
        assert board.status_code == 200
        board_payload = board.json()
        assert board_payload["periods"][0]["key"] == start_key
        assert any(period["key"] == "2026-12" and period["zone"] == "forecast" for period in board_payload["periods"])
        assert all(period["zone"] != "forecast" for period in board_payload["periods"] if period["type"] == "month" and period["key"] < "2026-01")

        premise_name, method, label = expected_methods[model_id]
        protagonist = next(item for item in board_payload["premises"] if item["name"] == premise_name)
        assert protagonist["prediction_base"]["method"] == method
        assert protagonist["prediction_base"]["method_label"] == label
        assert {item["name"] for item in board_payload["scenarios"]} == expected_scenarios[model_id]

    holding_board = client.get("/models/model_holding/board").json()
    imported_names = {item["name"] for item in holding_board["premises"] if item["source"] == "model_output"}
    assert imported_names == {
        "Ingreso retail consolidado",
        "Ingreso agro consolidado",
        "Flujo expansion consolidado",
    }

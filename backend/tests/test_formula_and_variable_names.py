from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_formula_premise_uses_variable_names_and_generates_values() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post(
        "/models",
        json={"name": "Formula model", "actuals_end_period_key": "2025-02", "forecast_end_period_key": "2025-03"},
    ).json()["id"]

    a_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Precio Unitario",
            "prediction_base": {
                "method": "carry_forward",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-03",
            },
        },
    ).json()["id"]
    b_id = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Cantidad",
            "prediction_base": {
                "method": "carry_forward",
                "params": {},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-03",
            },
        },
    ).json()["id"]
    total = client.post(
        f"/models/{model_id}/premises",
        json={
            "name": "Total",
            "prediction_base": {
                "method": "formula_placeholder",
                "params": {"expression": "precio_unitario * cantidad"},
                "forecast_start_period_key": "2025-03",
                "forecast_end_period_key": "2025-03",
            },
        },
    ).json()

    client.post(
        f"/models/{model_id}/import-grid",
        json={"raw_text": "Premisa\tene-25\tfeb-25\nPrecio Unitario\t10\t12\nCantidad\t2\t3"},
    )

    board = client.get(f"/models/{model_id}/board").json()
    total_values = next(item for item in board["premises"] if item["id"] == total["id"])["values"]
    assert [value["value"] for value in total_values[:3]] == [20.0, 36.0, 36.0]

    deps = client.get(f"/models/{model_id}/dependencies").json()
    assert any(edge["from_id"] == a_id and edge["to_id"] == total["id"] and edge["relation"] == "derives_from" for edge in deps["edges"])
    assert any(edge["from_id"] == b_id and edge["to_id"] == total["id"] and edge["relation"] == "derives_from" for edge in deps["edges"])


def test_variable_name_endpoints_for_model_and_library() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    library = client.post(
        "/library/premises",
        json={"name": "Combustible", "prediction": {"method": "manual", "params": {}}},
    ).json()
    updated_library = client.patch(
        f"/library/premises/{library['id']}/variable-name",
        json={"variable_name": "combustible_base"},
    )
    assert updated_library.status_code == 200
    assert updated_library.json()["variable_name"] == "combustible_base"

    model_id = client.post(
        "/models",
        json={"name": "M1", "actuals_end_period_key": "2025-01", "forecast_end_period_key": "2025-02"},
    ).json()["id"]
    premise = client.post(
        f"/models/{model_id}/premises",
        json={"name": "Costo total", "prediction_base": {"method": "manual", "params": {}}},
    ).json()

    updated_model = client.patch(
        f"/premises/{premise['id']}/variable-name",
        json={"variable_name": "costo_total"},
    )
    assert updated_model.status_code == 200
    assert updated_model.json()["variable_name"] == "costo_total"


def test_block_local_and_library_same_name_in_same_model_but_allow_other_model() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    lib = client.post(
        "/library/premises",
        json={"name": "Gasolina", "prediction": {"method": "manual", "params": {}}},
    ).json()

    model_a = client.post(
        "/models",
        json={"name": "A", "actuals_end_period_key": "2025-01", "forecast_end_period_key": "2025-02"},
    ).json()["id"]
    model_b = client.post(
        "/models",
        json={"name": "B", "actuals_end_period_key": "2025-01", "forecast_end_period_key": "2025-02"},
    ).json()["id"]

    local_in_a = client.post(
        f"/models/{model_a}/premises",
        json={"name": "Gasolina", "prediction_base": {"method": "manual", "params": {}}},
    )
    assert local_in_a.status_code == 201

    library_in_a = client.post(
        f"/models/{model_a}/premises",
        json={"library_premise_id": lib["id"]},
    )
    assert library_in_a.status_code == 400

    library_in_b = client.post(
        f"/models/{model_b}/premises",
        json={"library_premise_id": lib["id"]},
    )
    assert library_in_b.status_code == 201

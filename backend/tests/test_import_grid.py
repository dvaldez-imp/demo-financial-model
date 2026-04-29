from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import make_data_dir


def test_import_grid_preserves_existing_values_and_sets_timeline_if_missing() -> None:
    client = TestClient(create_app(data_dir=make_data_dir(), seed_demo=False))

    model_id = client.post("/models", json={"name": "Modelo import"}).json()["id"]
    first_import = client.post(
        f"/models/{model_id}/import-grid",
        json={"raw_text": "Premisa\tene-25\tfeb-25\tmar-25\nGasolina\t34\t35\t36"},
    )
    assert first_import.status_code == 200

    model = client.get(f"/models/{model_id}").json()
    assert model["actuals_end_period_key"] == "2025-03"
    assert model["forecast_end_period_key"] == "2025-03"

    second_import = client.post(
        f"/models/{model_id}/import-grid",
        json={"raw_text": "Premisa\tene-25\nGasolina\t40"},
    )
    assert second_import.status_code == 200

    board = client.get(f"/models/{model_id}/board").json()
    gasolina = next(premise for premise in board["premises"] if premise["name"] == "Gasolina")
    assert [value["value"] for value in gasolina["values"][:4]] == [40.0, 35.0, 36.0, 111.0]
    assert gasolina["values"][0]["value_origin"] == "actual"

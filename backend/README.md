# Financial Modeling MVP Backend

Backend en FastAPI para un tablero de modelado financiero con:

- timeline mensual con historico, forecast y resumen anual
- timeline mensual dinamico con alcance configurable por forecast_end_period_key
- premisas locales, de biblioteca y desde outputs de otros modelos
- forecast visible en el board
- metodos de prediccion: manual, carry_forward, growth_rate_pct, moving_average, linear_trend, seasonal_naive, arima_like y formulas
- modo manual editable en forecast; al cambiar desde una proyeccion automatica conserva los valores visibles
- escenarios con override de prediccion
- resumen anual configurable por premisa: sum, avg, last_value
- validacion anti-ciclos en dependencias
- la proyeccion forecast se ajusta al timeline del board/modelo
- soporte de formulas por variable_name para premisas
- importacion TSV pegada desde Excel
- seed demo con mini-modelos, historicos mixtos 2021/2022-2025 y forecast 2026
- persistencia simple en CSV con repositorio abstracto

## Requisitos

- Python 3.13
- `uv` o un virtualenv local

## Correr localmente

```powershell
uv sync --dev
uv run uvicorn app.main:app --reload
```

Si ya estas usando `.venv`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Base URL: `http://127.0.0.1:8000`

Swagger UI: `http://127.0.0.1:8000/docs`

## Variables utiles

- `DATA_DIR`: directorio para los CSV.
- `ALLOWED_ORIGINS`: origins separados por coma para CORS.

## Persistencia

CSV canonicos usados por la app:

- `models.csv`
- `periods.csv`
- `premises.csv`
- `premise_values.csv`
- `scenarios.csv`
- `scenario_overrides.csv`
- `model_outputs.csv`
- `dependency_edges.csv`
- `library_premises.csv`

Si el directorio de datos tiene el esquema viejo, la app lo migra al nuevo formato al iniciar.

## Endpoints principales

Health:

- `GET /health`

Admin:

- `POST /admin/reset-data`

Models:

- `GET /models`
- `POST /models`
- `GET /models/{model_id}`
- `PATCH /models/{model_id}/timeline`
- `GET /models/{model_id}/board`
- `GET /models/{model_id}/dependencies`
- `GET /models/{model_id}/dependencies/tree?root_premise_id=...`
- `GET /models/{model_id}/outputs`
- `POST /models/{model_id}/outputs`
- `PATCH /models/{model_id}/outputs/{output_id}`
- `POST /models/{model_id}/import-grid`
- `DELETE /models/{model_id}/premises/{premise_id}`

Premises:

- `POST /models/{model_id}/premises`
- `POST /models/{model_id}/premises/from-output`
- `PATCH /premises/{premise_id}`
- `PATCH /premises/{premise_id}/prediction-config`
- `PATCH /premises/{premise_id}/year-summary-config`
- `PATCH /premises/{premise_id}/variable-name`

Library:

- `GET /library/premises`
- `POST /library/premises`
- `PATCH /library/premises/{premise_id}/variable-name`

Scenarios:

- `GET /models/{model_id}/scenarios`
- `POST /models/{model_id}/scenarios`
- `PATCH /scenarios/{scenario_id}`

Catalog:

- `GET /catalog/model-outputs`

## Payloads utiles

Actualizar timeline:

```json
{
  "actuals_end_period_key": "2025-03",
  "forecast_end_period_key": "2025-12"
}
```

Actualizar prediction config:

```json
{
  "base": {
    "method": "growth_rate_pct",
    "params": {"rate": 3.5},
    "forecast_start_period_key": "2025-04",
    "forecast_end_period_key": "2025-12"
  },
  "scenario_override": {
    "scenario_id": "scn_123",
    "method": "growth_rate_pct",
    "params": {"rate": -5.0},
    "forecast_start_period_key": "2025-04",
    "forecast_end_period_key": "2025-12"
  }
}
```

Actualizar year summary config:

```json
{
  "year_summary_method": "avg"
}
```

Actualizar variable_name de premisa (modelo o biblioteca):

```json
{
  "variable_name": "costo_total"
}
```

Ejemplo formula (2 premisas base + 1 resultado):

```json
{
  "name": "Total",
  "prediction_base": {
    "method": "formula_placeholder",
    "params": {
      "expression": "insumo_a + insumo_b"
    }
  }
}
```

Reiniciar datos:

```json
{
  "seed_demo": false
}
```

Crear output exportable:

```json
{
  "name": "ebitda_proyectado",
  "display_name": "EBITDA proyectado",
  "source_premise_id": "prem_123",
  "description": "Salida reutilizable"
}
```

Crear premisa desde output:

```json
{
  "output_id": "out_123",
  "name_override": "Demanda importada"
}
```

Importar grid:

```json
{
  "raw_text": "Premisa\\tene-25\\tfeb-25\\t2025\\nGasolina\\t34\\t35\\t420"
}
```

## Flujo rapido

1. Crear o abrir un modelo.
2. Definir timeline con `PATCH /models/{model_id}/timeline`.
3. Cargar historico con `POST /models/{model_id}/import-grid`.
4. Crear premisas locales o vincular premisas de biblioteca.
5. Ajustar `prediction-config` de las premisas.
6. Crear escenarios y consultar `GET /models/{model_id}/board?scenario_id=...`.
7. Exportar outputs y reutilizarlos desde `/catalog/model-outputs`.
8. Ver jerarquia simple con `GET /models/{model_id}/dependencies`.
9. Ver arbol por premisa con `GET /models/{model_id}/dependencies/tree?root_premise_id=...`.
10. Eliminar premisas con `DELETE /models/{model_id}/premises/{premise_id}` (bloquea con 409 si hay dependientes).

## Contrato board (extracto)

`GET /models/{model_id}/board` devuelve ahora:

- `periods`: meses + columnas `year_summary`.
- `year_groups`: agrupacion por anio para UI colapsable/expandible.
- `premises[].year_summary_method` y `premises[].year_summary_method_label`.

## Estructura

```text
app/
  api/routes/
  repositories/
  schemas/
  services/
  utils/
data/
tests/
```

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

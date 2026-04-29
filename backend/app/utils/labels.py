from app.schemas.domain import DependencyType, PredictionMethod, PremiseSource, ValueOrigin

METHOD_LABELS: dict[PredictionMethod, str] = {
    "manual": "Manual",
    "carry_forward": "Repetir ultimo valor",
    "growth_rate_pct": "Crecimiento porcentual",
    "moving_average": "Promedio movil",
    "linear_trend": "Tendencia lineal",
    "seasonal_naive": "Estacional / oscilante",
    "arima_like": "ARIMA simplificado",
    "formula_placeholder": "Formula placeholder",
}

SOURCE_LABELS: dict[PremiseSource, str] = {
    "local": "Local",
    "library": "Biblioteca",
    "model_output": "Output de modelo",
}

DEPENDENCY_LABELS: dict[DependencyType, str] = {
    "none": "Sin dependencia",
    "local_premise": "Premisa local",
    "model_output": "Output de modelo",
}

VALUE_ORIGIN_LABELS: dict[ValueOrigin, str] = {
    "actual": "Actual",
    "forecast_generated": "Forecast generado",
    "forecast_manual": "Forecast manual",
    "year_summary": "Resumen anual",
}

YEAR_SUMMARY_METHOD_LABELS: dict[str, str] = {
    "sum": "Suma",
    "avg": "Promedio",
    "last_value": "Ultimo valor",
}

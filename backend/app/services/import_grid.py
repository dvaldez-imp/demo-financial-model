from __future__ import annotations

import csv
from io import StringIO

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import ImportGridResponse, ImportedRowOut
from app.schemas.domain import ModelPremiseRecord, PredictionConfig, PremiseValueRecord
from app.services.ids import generate_id
from app.services.period_parser import normalize_text, parse_period_label, to_variable_name
from app.services.timeline import build_timeline_periods


def parse_numeric_value(raw_value: str) -> float | None:
    value = raw_value.strip().replace(" ", "")
    if value == "":
        return None
    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif "," in value:
        if value.count(",") == 1:
            left, right = value.split(",", 1)
            value = f"{left}.{right}" if len(right) <= 2 else f"{left}{right}"
        else:
            value = value.replace(",", "")
    try:
        return float(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid numeric value: {raw_value}") from exc


def import_grid(repository: FinancialRepository, model_id: str, raw_text: str) -> ImportGridResponse:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    base_scenario = repository.get_base_scenario(model_id)
    if base_scenario is None:
        raise HTTPException(status_code=400, detail="Model has no base scenario.")

    rows = list(csv.reader(StringIO(raw_text), delimiter="\t"))
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="Grid must include headers and at least one data row.")

    headers = [column.strip() for column in rows[0]]
    ordered_detected_periods = []
    invalid_headers: list[str] = []
    for header in headers[1:]:
        parsed = parse_period_label(header)
        if parsed is None:
            invalid_headers.append(header)
        else:
            ordered_detected_periods.append(parsed)
    if invalid_headers:
        raise HTTPException(status_code=400, detail=f"Invalid period headers: {', '.join(invalid_headers)}")
    if not ordered_detected_periods:
        raise HTTPException(status_code=400, detail="No valid period headers detected.")

    month_keys = [period.key for period in ordered_detected_periods if period.type == "month"]
    if model.actuals_end_period_key is None and month_keys:
        last_month = max(month_keys)
        model = repository.update_model(
            model_id=model_id,
            changes={
                "actuals_end_period_key": last_month,
                "forecast_end_period_key": last_month,
            },
        ) or model

    merged_periods = build_timeline_periods(
        existing_periods=repository.list_periods(model_id) + ordered_detected_periods,
        actuals_end_period_key=model.actuals_end_period_key,
        forecast_end_period_key=model.forecast_end_period_key,
    )
    repository.replace_periods(model_id=model_id, periods=merged_periods)

    existing_by_name = {premise.normalized_name: premise for premise in repository.list_model_premises(model_id)}
    created_premises: list[str] = []
    updated_premises: list[str] = []
    imported_rows: list[ImportedRowOut] = []
    values_to_upsert: list[PremiseValueRecord] = []

    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        padded = row + [""] * (len(headers) - len(row))
        premise_name = padded[0].strip()
        if not premise_name:
            raise HTTPException(status_code=400, detail="Each row must include a premise name.")
        normalized_name = normalize_text(premise_name)
        premise = existing_by_name.get(normalized_name)
        if premise is None:
            premise = ModelPremiseRecord(
                id=generate_id("prem"),
                model_id=model_id,
                name=premise_name,
                normalized_name=normalized_name,
                variable_name=to_variable_name(premise_name),
                unit=None,
                category=None,
                source="local",
                source_ref_id=None,
                dependency_type="none",
                source_model_id=None,
                source_output_id=None,
                prediction_base=PredictionConfig(
                    method="manual",
                    params={},
                    forecast_start_period_key=model.actuals_end_period_key,
                    forecast_end_period_key=model.forecast_end_period_key,
                ),
            )
            repository.create_model_premise(premise=premise)
            existing_by_name[normalized_name] = premise
            created_premises.append(premise_name)
        elif premise_name not in updated_premises:
            updated_premises.append(premise_name)

        parsed_values: dict[str, float | None] = {}
        for period, raw_value in zip(ordered_detected_periods, padded[1:], strict=False):
            numeric_value = parse_numeric_value(raw_value)
            parsed_values[period.key] = numeric_value
            if numeric_value is None:
                continue
            if period.type == "year_summary":
                value_origin = "year_summary"
                editable = False
            elif period.zone == "forecast":
                value_origin = "forecast_manual"
                editable = True
            else:
                value_origin = "actual"
                editable = True
            values_to_upsert.append(
                PremiseValueRecord(
                    premise_id=premise.id,
                    period_key=period.key,
                    scenario_id=base_scenario.id,
                    value=numeric_value,
                    value_origin=value_origin,
                    editable=editable,
                )
            )
        imported_rows.append(ImportedRowOut(premise_name=premise_name, values=parsed_values))

    repository.upsert_values(values=values_to_upsert)
    return ImportGridResponse(
        detected_periods=merged_periods,
        rows=imported_rows,
        created_premises=created_premises,
        updated_premises=updated_premises,
    )

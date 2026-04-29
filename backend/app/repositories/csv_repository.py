from __future__ import annotations

import csv
import json
from pathlib import Path

from app.repositories.base import FinancialRepository
from app.schemas.domain import (
    ActivityLogRecord,
    DependencyEdgeRecord,
    LibraryPremiseRecord,
    ModelOutputRecord,
    ModelPremiseRecord,
    ModelRecord,
    PeriodRecord,
    PredictionConfig,
    PremiseValueRecord,
    ScenarioRecord,
)
from app.services.period_parser import sort_periods
from app.services.timeline import build_timeline_periods, infer_actuals_end_from_periods, make_period_label

FILE_FIELDS = {
    "models.csv": ["id", "name", "frequency", "actuals_end_period_key", "forecast_end_period_key"],
    "library_premises.csv": ["id", "name", "normalized_name", "variable_name", "unit", "category", "prediction_json"],
    "premises.csv": [
        "id",
        "model_id",
        "name",
        "normalized_name",
        "variable_name",
        "unit",
        "category",
        "source",
        "source_ref_id",
        "dependency_type",
        "source_model_id",
        "source_output_id",
        "year_summary_method",
        "prediction_base_json",
    ],
    "periods.csv": ["model_id", "key", "label", "type", "year", "month", "zone"],
    "scenarios.csv": ["id", "model_id", "name", "description", "is_base"],
    "scenario_overrides.csv": ["scenario_id", "premise_id", "prediction_override_json"],
    "premise_values.csv": ["premise_id", "period_key", "scenario_id", "value", "value_origin", "editable"],
    "model_outputs.csv": [
        "id",
        "model_id",
        "name",
        "display_name",
        "source_premise_id",
        "source_metric_key",
        "description",
        "active",
    ],
    "dependency_edges.csv": ["from_type", "from_id", "to_type", "to_id", "relation"],
    "activity_log.csv": [
        "id", "timestamp", "user", "user_initials", "user_color",
        "action_type", "target_type", "target_name", "model_name", "description", "detail",
    ],
}

LEGACY_FIELDS = {
    "models.csv": ["id", "name", "frequency"],
    "model_premises.csv": [
        "id",
        "model_id",
        "name",
        "normalized_name",
        "unit",
        "category",
        "source",
        "library_premise_id",
        "prediction_json",
    ],
    "model_periods.csv": ["model_id", "key", "label", "type", "year", "month"],
    "scenario_prediction_overrides.csv": ["scenario_id", "premise_id", "prediction_json"],
    "values.csv": ["premise_id", "period_key", "scenario_id", "value", "cell_type"],
}


class CsvFinancialRepository(FinancialRepository):
    def __init__(self, data_dir: str | Path) -> None:
        self.data_dir = Path(data_dir)

    def initialize(self, *, seed_demo: bool = True) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if self._needs_migration():
            self._migrate_legacy_data()
        for filename, fields in FILE_FIELDS.items():
            self._ensure_file(filename, fields)
        if seed_demo and not self._read_rows("models.csv"):
            self._seed_demo_data()
        elif seed_demo and not self._read_rows("activity_log.csv"):
            self._seed_activity_log()

    def reset_data(self, *, seed_demo: bool = True) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        for filename in FILE_FIELDS:
            self._write_rows(filename, [])
        if seed_demo:
            self._seed_demo_data()

    def list_models(self) -> list[ModelRecord]:
        return [self._model_from_row(row) for row in self._read_rows("models.csv")]

    def get_model(self, model_id: str) -> ModelRecord | None:
        for row in self._read_rows("models.csv"):
            if row["id"] == model_id:
                return self._model_from_row(row)
        return None

    def create_model(self, *, model: ModelRecord) -> ModelRecord:
        rows = self._read_rows("models.csv")
        rows.append(self._model_to_row(model))
        self._write_rows("models.csv", rows)
        return model

    def update_model(self, *, model_id: str, changes: dict[str, object]) -> ModelRecord | None:
        rows = self._read_rows("models.csv")
        updated: ModelRecord | None = None
        for row in rows:
            if row["id"] != model_id:
                continue
            updated = self._model_from_row(row)
            for field, value in changes.items():
                setattr(updated, field, value)
            row.update(self._model_to_row(updated))
            break
        if updated is None:
            return None
        self._write_rows("models.csv", rows)
        return updated

    def list_library_premises(self) -> list[LibraryPremiseRecord]:
        return [self._library_from_row(row) for row in self._read_rows("library_premises.csv")]

    def get_library_premise(self, premise_id: str) -> LibraryPremiseRecord | None:
        for row in self._read_rows("library_premises.csv"):
            if row["id"] == premise_id:
                return self._library_from_row(row)
        return None

    def create_library_premise(self, *, premise: LibraryPremiseRecord) -> LibraryPremiseRecord:
        rows = self._read_rows("library_premises.csv")
        rows.append(self._library_to_row(premise))
        self._write_rows("library_premises.csv", rows)
        return premise

    def update_library_premise(self, *, premise_id: str, changes: dict[str, object]) -> LibraryPremiseRecord | None:
        rows = self._read_rows("library_premises.csv")
        updated: LibraryPremiseRecord | None = None
        for row in rows:
            if row["id"] != premise_id:
                continue
            updated = self._library_from_row(row)
            for field, value in changes.items():
                setattr(updated, field, value)
            row.update(self._library_to_row(updated))
            break
        if updated is None:
            return None
        self._write_rows("library_premises.csv", rows)
        return updated

    def list_model_premises(self, model_id: str) -> list[ModelPremiseRecord]:
        return [self._premise_from_row(row) for row in self._read_rows("premises.csv") if row["model_id"] == model_id]

    def get_model_premise(self, premise_id: str) -> ModelPremiseRecord | None:
        for row in self._read_rows("premises.csv"):
            if row["id"] == premise_id:
                return self._premise_from_row(row)
        return None

    def find_model_premise_by_normalized_name(
        self,
        *,
        model_id: str,
        normalized_name: str,
    ) -> ModelPremiseRecord | None:
        for row in self._read_rows("premises.csv"):
            if row["model_id"] == model_id and row["normalized_name"] == normalized_name:
                return self._premise_from_row(row)
        return None

    def create_model_premise(self, *, premise: ModelPremiseRecord) -> ModelPremiseRecord:
        rows = self._read_rows("premises.csv")
        rows.append(self._premise_to_row(premise))
        self._write_rows("premises.csv", rows)
        return premise

    def update_model_premise(self, *, premise_id: str, changes: dict[str, object]) -> ModelPremiseRecord | None:
        rows = self._read_rows("premises.csv")
        updated: ModelPremiseRecord | None = None
        for row in rows:
            if row["id"] != premise_id:
                continue
            updated = self._premise_from_row(row)
            for field, value in changes.items():
                setattr(updated, field, value)
            row.update(self._premise_to_row(updated))
            break
        if updated is None:
            return None
        self._write_rows("premises.csv", rows)
        return updated

    def delete_model_premise(self, *, premise_id: str) -> bool:
        premises_rows = self._read_rows("premises.csv")
        premise_exists = any(row["id"] == premise_id for row in premises_rows)
        if not premise_exists:
            return False

        self._write_rows("premises.csv", [row for row in premises_rows if row["id"] != premise_id])

        value_rows = self._read_rows("premise_values.csv")
        self._write_rows("premise_values.csv", [row for row in value_rows if row["premise_id"] != premise_id])

        override_rows = self._read_rows("scenario_overrides.csv")
        self._write_rows("scenario_overrides.csv", [row for row in override_rows if row["premise_id"] != premise_id])

        edge_rows = self._read_rows("dependency_edges.csv")
        self._write_rows(
            "dependency_edges.csv",
            [
                row
                for row in edge_rows
                if not (
                    (row["from_type"] == "premise" and row["from_id"] == premise_id)
                    or (row["to_type"] == "premise" and row["to_id"] == premise_id)
                )
            ],
        )
        return True

    def list_periods(self, model_id: str) -> list[PeriodRecord]:
        periods = [self._period_from_row(row) for row in self._read_rows("periods.csv") if row["model_id"] == model_id]
        return sort_periods(periods)

    def replace_periods(self, *, model_id: str, periods: list[PeriodRecord]) -> list[PeriodRecord]:
        rows = [row for row in self._read_rows("periods.csv") if row["model_id"] != model_id]
        rows.extend(self._period_to_row(model_id, period) for period in periods)
        self._write_rows("periods.csv", rows)
        return self.list_periods(model_id)

    def upsert_periods(self, *, model_id: str, periods: list[PeriodRecord]) -> list[PeriodRecord]:
        rows = self._read_rows("periods.csv")
        by_key = {(row["model_id"], row["key"]): row for row in rows}
        for period in periods:
            by_key[(model_id, period.key)] = self._period_to_row(model_id, period)
        self._write_rows("periods.csv", list(by_key.values()))
        return self.list_periods(model_id)

    def list_scenarios(self, model_id: str) -> list[ScenarioRecord]:
        return [self._scenario_from_row(row) for row in self._read_rows("scenarios.csv") if row["model_id"] == model_id]

    def get_scenario(self, scenario_id: str) -> ScenarioRecord | None:
        for row in self._read_rows("scenarios.csv"):
            if row["id"] == scenario_id:
                return self._scenario_from_row(row)
        return None

    def get_base_scenario(self, model_id: str) -> ScenarioRecord | None:
        for row in self._read_rows("scenarios.csv"):
            if row["model_id"] == model_id and row["is_base"] == "true":
                return self._scenario_from_row(row)
        return None

    def create_scenario(self, *, scenario: ScenarioRecord) -> ScenarioRecord:
        rows = self._read_rows("scenarios.csv")
        rows.append(self._scenario_to_row(scenario))
        self._write_rows("scenarios.csv", rows)
        return scenario

    def update_scenario(self, *, scenario_id: str, changes: dict[str, object]) -> ScenarioRecord | None:
        rows = self._read_rows("scenarios.csv")
        updated: ScenarioRecord | None = None
        for row in rows:
            if row["id"] != scenario_id:
                continue
            updated = self._scenario_from_row(row)
            for field, value in changes.items():
                setattr(updated, field, value)
            row.update(self._scenario_to_row(updated))
            break
        if updated is None:
            return None
        self._write_rows("scenarios.csv", rows)
        return updated

    def get_prediction_overrides(self, scenario_id: str) -> dict[str, PredictionConfig]:
        overrides: dict[str, PredictionConfig] = {}
        for row in self._read_rows("scenario_overrides.csv"):
            if row["scenario_id"] == scenario_id:
                overrides[row["premise_id"]] = self._prediction_from_json(row["prediction_override_json"])
        return overrides

    def upsert_prediction_overrides(self, *, scenario_id: str, overrides: dict[str, PredictionConfig | None]) -> None:
        rows = [row for row in self._read_rows("scenario_overrides.csv") if row["scenario_id"] != scenario_id]
        current = self.get_prediction_overrides(scenario_id)
        for premise_id, prediction in overrides.items():
            if prediction is None:
                current.pop(premise_id, None)
            else:
                current[premise_id] = prediction
        rows.extend(
            {
                "scenario_id": scenario_id,
                "premise_id": premise_id,
                "prediction_override_json": self._prediction_to_json(prediction),
            }
            for premise_id, prediction in current.items()
        )
        self._write_rows("scenario_overrides.csv", rows)

    def list_values_for_model(self, model_id: str) -> list[PremiseValueRecord]:
        return self.list_values_for_premise_ids([premise.id for premise in self.list_model_premises(model_id)])

    def list_values_for_premise_ids(self, premise_ids: list[str]) -> list[PremiseValueRecord]:
        premise_id_set = set(premise_ids)
        return [self._value_from_row(row) for row in self._read_rows("premise_values.csv") if row["premise_id"] in premise_id_set]

    def upsert_values(self, *, values: list[PremiseValueRecord]) -> None:
        rows = self._read_rows("premise_values.csv")
        by_key = {(row["premise_id"], row["period_key"], row["scenario_id"]): row for row in rows}
        for value in values:
            by_key[(value.premise_id, value.period_key, value.scenario_id)] = self._value_to_row(value)
        self._write_rows("premise_values.csv", list(by_key.values()))

    def list_outputs(self, model_id: str) -> list[ModelOutputRecord]:
        return [self._output_from_row(row) for row in self._read_rows("model_outputs.csv") if row["model_id"] == model_id]

    def get_output(self, output_id: str) -> ModelOutputRecord | None:
        for row in self._read_rows("model_outputs.csv"):
            if row["id"] == output_id:
                return self._output_from_row(row)
        return None

    def create_output(self, *, output: ModelOutputRecord) -> ModelOutputRecord:
        rows = self._read_rows("model_outputs.csv")
        rows.append(self._output_to_row(output))
        self._write_rows("model_outputs.csv", rows)
        return output

    def update_output(self, *, output_id: str, changes: dict[str, object]) -> ModelOutputRecord | None:
        rows = self._read_rows("model_outputs.csv")
        updated: ModelOutputRecord | None = None
        for row in rows:
            if row["id"] != output_id:
                continue
            updated = self._output_from_row(row)
            for field, value in changes.items():
                setattr(updated, field, value)
            row.update(self._output_to_row(updated))
            break
        if updated is None:
            return None
        self._write_rows("model_outputs.csv", rows)
        return updated

    def list_active_outputs(self) -> list[ModelOutputRecord]:
        return [output for output in self.list_all_outputs() if output.active]

    def list_dependency_edges(self) -> list[DependencyEdgeRecord]:
        return [DependencyEdgeRecord(**row) for row in self._read_rows("dependency_edges.csv")]

    def upsert_dependency_edge(self, *, edge: DependencyEdgeRecord) -> DependencyEdgeRecord:
        rows = self._read_rows("dependency_edges.csv")
        by_key = {
            (row["from_type"], row["from_id"], row["to_type"], row["to_id"], row["relation"]): row
            for row in rows
        }
        by_key[(edge.from_type, edge.from_id, edge.to_type, edge.to_id, edge.relation)] = edge.model_dump()
        self._write_rows("dependency_edges.csv", list(by_key.values()))
        return edge

    def delete_dependency_edges(
        self,
        *,
        to_type: str,
        to_id: str,
        relation: str | None = None,
    ) -> None:
        rows = self._read_rows("dependency_edges.csv")
        filtered = []
        for row in rows:
            if row["to_type"] != to_type or row["to_id"] != to_id:
                filtered.append(row)
                continue
            if relation is not None and row["relation"] != relation:
                filtered.append(row)
        self._write_rows("dependency_edges.csv", filtered)

    def list_all_outputs(self) -> list[ModelOutputRecord]:
        return [self._output_from_row(row) for row in self._read_rows("model_outputs.csv")]

    def list_activity_log(self) -> list[ActivityLogRecord]:
        rows = self._read_rows("activity_log.csv")
        entries = [self._activity_log_from_row(row) for row in rows]
        return sorted(entries, key=lambda e: e.timestamp, reverse=True)

    def create_activity_log_entry(self, *, entry: ActivityLogRecord) -> ActivityLogRecord:
        rows = self._read_rows("activity_log.csv")
        rows.append(self._activity_log_to_row(entry))
        self._write_rows("activity_log.csv", rows)
        return entry

    def _activity_log_from_row(self, row: dict[str, str]) -> ActivityLogRecord:
        return ActivityLogRecord(
            id=row["id"],
            timestamp=row["timestamp"],
            user=row["user"],
            user_initials=row["user_initials"],
            user_color=row["user_color"],
            action_type=row["action_type"],
            target_type=row["target_type"],
            target_name=row["target_name"],
            model_name=row["model_name"],
            description=row["description"],
            detail=row["detail"] or None,
        )

    def _activity_log_to_row(self, entry: ActivityLogRecord) -> dict[str, str]:
        return {
            "id": entry.id,
            "timestamp": entry.timestamp,
            "user": entry.user,
            "user_initials": entry.user_initials,
            "user_color": entry.user_color,
            "action_type": entry.action_type,
            "target_type": entry.target_type,
            "target_name": entry.target_name,
            "model_name": entry.model_name,
            "description": entry.description,
            "detail": entry.detail or "",
        }

    def _needs_migration(self) -> bool:
        models_header = self._read_header("models.csv")
        if models_header and models_header != FILE_FIELDS["models.csv"]:
            return True
        legacy_files = [name for name in LEGACY_FIELDS if name != "models.csv"]
        if any((self.data_dir / name).exists() for name in legacy_files) and not (self.data_dir / "premises.csv").exists():
            return True
        return False

    def _migrate_legacy_data(self) -> None:
        legacy_models_rows = self._read_rows_generic("models.csv", LEGACY_FIELDS["models.csv"])
        legacy_period_rows = self._read_rows_generic("model_periods.csv", LEGACY_FIELDS["model_periods.csv"])
        periods_by_model: dict[str, list[PeriodRecord]] = {}
        for row in legacy_period_rows:
            periods_by_model.setdefault(row["model_id"], []).append(
                PeriodRecord(
                    key=row["key"],
                    label=row["label"],
                    type=row["type"],
                    year=int(row["year"]),
                    month=int(row["month"]) if row["month"] else None,
                    zone="summary" if row["type"] == "year_summary" else "historical",
                )
            )

        migrated_models: list[dict[str, str]] = []
        for row in legacy_models_rows:
            sorted_periods = sort_periods(periods_by_model.get(row["id"], []))
            actuals_end = infer_actuals_end_from_periods(sorted_periods)
            rebuilt_periods = build_timeline_periods(
                existing_periods=sorted_periods,
                actuals_end_period_key=actuals_end,
                forecast_end_period_key=actuals_end,
            )
            periods_by_model[row["id"]] = rebuilt_periods
            migrated_models.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "frequency": row.get("frequency", "monthly"),
                    "actuals_end_period_key": actuals_end or "",
                    "forecast_end_period_key": actuals_end or "",
                }
            )

        migrated_premises = []
        for row in self._read_rows_generic("model_premises.csv", LEGACY_FIELDS["model_premises.csv"]):
            migrated_premises.append(
                {
                    "id": row["id"],
                    "model_id": row["model_id"],
                    "name": row["name"],
                    "normalized_name": row["normalized_name"],
                    "variable_name": row["normalized_name"].replace(" ", "_"),
                    "unit": row["unit"],
                    "category": row["category"],
                    "source": row["source"],
                    "source_ref_id": row["library_premise_id"],
                    "dependency_type": "none",
                    "source_model_id": "",
                    "source_output_id": "",
                    "year_summary_method": "sum",
                    "prediction_base_json": row["prediction_json"],
                }
            )

        migrated_periods = []
        for model_id, periods in periods_by_model.items():
            migrated_periods.extend(self._period_to_row(model_id, period) for period in periods)

        migrated_overrides = [
            {
                "scenario_id": row["scenario_id"],
                "premise_id": row["premise_id"],
                "prediction_override_json": row["prediction_json"],
            }
            for row in self._read_rows_generic(
                "scenario_prediction_overrides.csv",
                LEGACY_FIELDS["scenario_prediction_overrides.csv"],
            )
        ]

        premise_model_index = {row["id"]: row["model_id"] for row in migrated_premises}
        actuals_by_model = {row["id"]: row["actuals_end_period_key"] or None for row in migrated_models}
        migrated_values = []
        for row in self._read_rows_generic("values.csv", LEGACY_FIELDS["values.csv"]):
            model_id = premise_model_index.get(row["premise_id"])
            actuals_end = actuals_by_model.get(model_id)
            if row["cell_type"] == "year_summary":
                value_origin = "year_summary"
                editable = "false"
            elif actuals_end and row["period_key"] > actuals_end:
                value_origin = "forecast_manual"
                editable = "true"
            else:
                value_origin = "actual"
                editable = "true"
            migrated_values.append(
                {
                    "premise_id": row["premise_id"],
                    "period_key": row["period_key"],
                    "scenario_id": row["scenario_id"],
                    "value": row["value"],
                    "value_origin": value_origin,
                    "editable": editable,
                }
            )

        self._write_rows("models.csv", migrated_models)
        self._write_rows("library_premises.csv", self._read_rows_generic("library_premises.csv", FILE_FIELDS["library_premises.csv"]))
        self._write_rows("premises.csv", migrated_premises)
        self._write_rows("periods.csv", migrated_periods)
        self._write_rows("scenarios.csv", self._read_rows_generic("scenarios.csv", FILE_FIELDS["scenarios.csv"]))
        self._write_rows("scenario_overrides.csv", migrated_overrides)
        self._write_rows("premise_values.csv", migrated_values)
        self._write_rows("model_outputs.csv", [])
        self._write_rows("dependency_edges.csv", [])

    def _ensure_file(self, filename: str, fields: list[str]) -> None:
        path = self.data_dir / filename
        if path.exists() and self._read_header(filename) == fields:
            return
        if path.exists() and self._read_header(filename) != fields:
            rows = self._read_rows_generic(filename, self._read_header(filename) or fields)
            self._write_rows(filename, rows)
            return
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()

    def _read_header(self, filename: str) -> list[str] | None:
        path = self.data_dir / filename
        if not path.exists():
            return None
        with path.open("r", newline="", encoding="utf-8") as handle:
            return next(csv.reader(handle), None)

    def _read_rows(self, filename: str) -> list[dict[str, str]]:
        return self._read_rows_generic(filename, FILE_FIELDS[filename])

    def _read_rows_generic(self, filename: str, fields: list[str]) -> list[dict[str, str]]:
        path = self.data_dir / filename
        if not path.exists():
            return []
        with path.open("r", newline="", encoding="utf-8") as handle:
            return [{field: row.get(field, "") or "" for field in fields} for row in csv.DictReader(handle)]

    def _write_rows(self, filename: str, rows: list[dict[str, str]]) -> None:
        path = self.data_dir / filename
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FILE_FIELDS[filename])
            writer.writeheader()
            writer.writerows([{field: row.get(field, "") for field in FILE_FIELDS[filename]} for row in rows])

    def _prediction_to_json(self, prediction: PredictionConfig) -> str:
        return json.dumps(prediction.model_dump(), ensure_ascii=False)

    def _prediction_from_json(self, raw_json: str) -> PredictionConfig:
        if not raw_json:
            return PredictionConfig()
        return PredictionConfig.model_validate(json.loads(raw_json))

    def _model_to_row(self, model: ModelRecord) -> dict[str, str]:
        return {
            "id": model.id,
            "name": model.name,
            "frequency": model.frequency,
            "actuals_end_period_key": model.actuals_end_period_key or "",
            "forecast_end_period_key": model.forecast_end_period_key or "",
        }

    def _model_from_row(self, row: dict[str, str]) -> ModelRecord:
        return ModelRecord(
            id=row["id"],
            name=row["name"],
            frequency=row["frequency"],
            actuals_end_period_key=row["actuals_end_period_key"] or None,
            forecast_end_period_key=row["forecast_end_period_key"] or None,
        )

    def _library_from_row(self, row: dict[str, str]) -> LibraryPremiseRecord:
        return LibraryPremiseRecord(
            id=row["id"],
            name=row["name"],
            normalized_name=row["normalized_name"],
            variable_name=row.get("variable_name", "") or row["normalized_name"].replace(" ", "_"),
            unit=row["unit"] or None,
            category=row["category"] or None,
            prediction=self._prediction_from_json(row["prediction_json"]),
        )

    def _library_to_row(self, premise: LibraryPremiseRecord) -> dict[str, str]:
        return {
            "id": premise.id,
            "name": premise.name,
            "normalized_name": premise.normalized_name,
            "variable_name": premise.variable_name,
            "unit": premise.unit or "",
            "category": premise.category or "",
            "prediction_json": self._prediction_to_json(premise.prediction),
        }

    def _premise_from_row(self, row: dict[str, str]) -> ModelPremiseRecord:
        return ModelPremiseRecord(
            id=row["id"],
            model_id=row["model_id"],
            name=row["name"],
            normalized_name=row["normalized_name"],
            variable_name=row.get("variable_name", "") or row["normalized_name"].replace(" ", "_"),
            unit=row["unit"] or None,
            category=row["category"] or None,
            source=row["source"],
            source_ref_id=row["source_ref_id"] or None,
            dependency_type=row["dependency_type"] or "none",
            source_model_id=row["source_model_id"] or None,
            source_output_id=row["source_output_id"] or None,
            year_summary_method=row.get("year_summary_method", "") or "sum",
            prediction_base=self._prediction_from_json(row["prediction_base_json"]),
        )

    def _premise_to_row(self, premise: ModelPremiseRecord) -> dict[str, str]:
        return {
            "id": premise.id,
            "model_id": premise.model_id,
            "name": premise.name,
            "normalized_name": premise.normalized_name,
            "variable_name": premise.variable_name,
            "unit": premise.unit or "",
            "category": premise.category or "",
            "source": premise.source,
            "source_ref_id": premise.source_ref_id or "",
            "dependency_type": premise.dependency_type,
            "source_model_id": premise.source_model_id or "",
            "source_output_id": premise.source_output_id or "",
            "year_summary_method": premise.year_summary_method,
            "prediction_base_json": self._prediction_to_json(premise.prediction_base),
        }

    def _period_from_row(self, row: dict[str, str]) -> PeriodRecord:
        return PeriodRecord(
            key=row["key"],
            label=row["label"],
            type=row["type"],
            year=int(row["year"]),
            month=int(row["month"]) if row["month"] else None,
            zone=row["zone"] or ("summary" if row["type"] == "year_summary" else "historical"),
        )

    def _period_to_row(self, model_id: str, period: PeriodRecord) -> dict[str, str]:
        return {
            "model_id": model_id,
            "key": period.key,
            "label": period.label,
            "type": period.type,
            "year": str(period.year),
            "month": "" if period.month is None else str(period.month),
            "zone": period.zone,
        }

    def _scenario_from_row(self, row: dict[str, str]) -> ScenarioRecord:
        return ScenarioRecord(
            id=row["id"],
            model_id=row["model_id"],
            name=row["name"],
            description=row["description"] or None,
            is_base=row["is_base"] == "true",
        )

    def _scenario_to_row(self, scenario: ScenarioRecord) -> dict[str, str]:
        return {
            "id": scenario.id,
            "model_id": scenario.model_id,
            "name": scenario.name,
            "description": scenario.description or "",
            "is_base": "true" if scenario.is_base else "false",
        }

    def _value_from_row(self, row: dict[str, str]) -> PremiseValueRecord:
        return PremiseValueRecord(
            premise_id=row["premise_id"],
            period_key=row["period_key"],
            scenario_id=row["scenario_id"],
            value=float(row["value"]) if row["value"] != "" else None,
            value_origin=row["value_origin"],
            editable=row["editable"] == "true",
        )

    def _value_to_row(self, value: PremiseValueRecord) -> dict[str, str]:
        return {
            "premise_id": value.premise_id,
            "period_key": value.period_key,
            "scenario_id": value.scenario_id,
            "value": "" if value.value is None else str(value.value),
            "value_origin": value.value_origin,
            "editable": "true" if value.editable else "false",
        }

    def _output_from_row(self, row: dict[str, str]) -> ModelOutputRecord:
        return ModelOutputRecord(
            id=row["id"],
            model_id=row["model_id"],
            name=row["name"],
            display_name=row["display_name"],
            source_premise_id=row["source_premise_id"] or None,
            source_metric_key=row["source_metric_key"] or None,
            description=row["description"] or None,
            active=row["active"] != "false",
        )

    def _output_to_row(self, output: ModelOutputRecord) -> dict[str, str]:
        return {
            "id": output.id,
            "model_id": output.model_id,
            "name": output.name,
            "display_name": output.display_name,
            "source_premise_id": output.source_premise_id or "",
            "source_metric_key": output.source_metric_key or "",
            "description": output.description or "",
            "active": "true" if output.active else "false",
        }

    def _seed_demo_data(self) -> None:
        def month_key(year: int, month: int) -> str:
            return f"{year:04d}-{month:02d}"

        def historical_periods(start_year: int) -> list[PeriodRecord]:
            return [
                PeriodRecord(
                    key=month_key(year, month),
                    label=make_period_label(month_key(year, month)),
                    type="month",
                    year=year,
                    month=month,
                    zone="historical",
                )
                for year in range(start_year, 2026)
                for month in range(1, 13)
            ]

        def add_series(
            values: list[PremiseValueRecord],
            *,
            premise_id: str,
            scenario_id: str,
            start_year: int,
            generator,
        ) -> None:
            for year in range(start_year, 2026):
                for month in range(1, 13):
                    values.append(
                        PremiseValueRecord(
                            premise_id=premise_id,
                            period_key=month_key(year, month),
                            scenario_id=scenario_id,
                            value=round(generator(year, month), 2),
                            value_origin="actual",
                            editable=True,
                        )
                    )

        actuals_end = "2025-12"
        forecast_end = "2026-12"
        forecast_start = "2026-01"
        model_start_years = {
            "model_ventas": 2021,
            "model_combustible": 2022,
            "model_macro": 2022,
            "model_arima": 2021,
            "model_agro": 2021,
            "model_expansion": 2022,
            "model_holding": 2022,
        }

        for model in [
            ModelRecord(id="model_ventas", name="Modelo demanda retail", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_combustible", name="Modelo combustible estacional", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_macro", name="Modelo macro suavizado", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_arima", name="Modelo rentabilidad ARIMA simplificado", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_agro", name="Modelo agro exportacion", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_expansion", name="Modelo expansion tiendas", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
            ModelRecord(id="model_holding", name="Modelo holding consolidado", frequency="monthly", actuals_end_period_key=actuals_end, forecast_end_period_key=forecast_end),
        ]:
            self.create_model(model=model)

        for scenario in [
            ScenarioRecord(id="scn_ventas_base", model_id="model_ventas", name="Base", description="Escenario base de demanda retail", is_base=True),
            ScenarioRecord(id="scn_ventas_upside", model_id="model_ventas", name="Upside comercial", description="Mayor traccion comercial y mejor ticket", is_base=False),
            ScenarioRecord(id="scn_combustible_base", model_id="model_combustible", name="Base", description="Escenario base de combustible", is_base=True),
            ScenarioRecord(id="scn_macro_base", model_id="model_macro", name="Base", description="Escenario base macro", is_base=True),
            ScenarioRecord(id="scn_macro_depreciacion", model_id="model_macro", name="Depreciacion GTQ", description="Depreciacion cambiaria y resina mas cara", is_base=False),
            ScenarioRecord(id="scn_arima_base", model_id="model_arima", name="Base", description="Escenario base ARIMA simplificado", is_base=True),
            ScenarioRecord(id="scn_combustible_choque", model_id="model_combustible", name="Choque alcista", description="Escenario con tendencia alcista sobre el combustible", is_base=False),
            ScenarioRecord(id="scn_arima_estres", model_id="model_arima", name="Stress", description="Escenario con forecast conservador", is_base=False),
            ScenarioRecord(id="scn_arima_upside", model_id="model_arima", name="Upside operativo", description="Mejor demanda y mejor precio unitario", is_base=False),
            ScenarioRecord(id="scn_agro_base", model_id="model_agro", name="Base", description="Escenario base agro exportacion", is_base=True),
            ScenarioRecord(id="scn_agro_sequia", model_id="model_agro", name="Sequia", description="Menor lluvia y menor rendimiento", is_base=False),
            ScenarioRecord(id="scn_expansion_base", model_id="model_expansion", name="Base", description="Escenario base de expansion", is_base=True),
            ScenarioRecord(id="scn_expansion_agresiva", model_id="model_expansion", name="Expansion agresiva", description="Mas aperturas y mayor capex", is_base=False),
            ScenarioRecord(id="scn_holding_base", model_id="model_holding", name="Base", description="Escenario base consolidado", is_base=True),
            ScenarioRecord(id="scn_holding_sinergias", model_id="model_holding", name="Sinergias", description="Mayor eficiencia corporativa consolidada", is_base=False),
        ]:
            self.create_scenario(scenario=scenario)

        gasolina_prediction = PredictionConfig(
            method="seasonal_naive",
            params={"season_length": 12},
            forecast_start_period_key=forecast_start,
            forecast_end_period_key=forecast_end,
        )
        tipo_cambio_prediction = PredictionConfig(
            method="moving_average",
            params={"window": 4},
            forecast_start_period_key=forecast_start,
            forecast_end_period_key=forecast_end,
        )
        diesel_prediction = PredictionConfig(
            method="seasonal_naive",
            params={"season_length": 12},
            forecast_start_period_key=forecast_start,
            forecast_end_period_key=forecast_end,
        )
        resina_prediction = PredictionConfig(
            method="linear_trend",
            params={"lookback_periods": 12},
            forecast_start_period_key=forecast_start,
            forecast_end_period_key=forecast_end,
        )
        for premise in [
            LibraryPremiseRecord(
                id="lib_gasolina",
                name="Gasolina regular",
                normalized_name="gasolina regular",
                variable_name="gasolina",
                unit="Q/gal",
                category="Costo",
                prediction=gasolina_prediction,
            ),
            LibraryPremiseRecord(
                id="lib_tipo_cambio",
                name="Tipo de cambio USD/GTQ",
                normalized_name="tipo de cambio usd gtq",
                variable_name="tipo_cambio",
                unit="Q/USD",
                category="Macro",
                prediction=tipo_cambio_prediction,
            ),
            LibraryPremiseRecord(
                id="lib_diesel",
                name="Diesel flotilla",
                normalized_name="diesel flotilla",
                variable_name="diesel",
                unit="Q/gal",
                category="Costo",
                prediction=diesel_prediction,
            ),
            LibraryPremiseRecord(
                id="lib_resina_usd",
                name="Resina importada USD",
                normalized_name="resina importada usd",
                variable_name="resina_usd",
                unit="USD/ton",
                category="Macro",
                prediction=resina_prediction,
            ),
        ]:
            self.create_library_premise(premise=premise)

        for premise in [
            ModelPremiseRecord(
                id="prem_ventas_demanda",
                model_id="model_ventas",
                name="Demanda retail exportada",
                normalized_name="demanda retail exportada",
                variable_name="demanda_exportada",
                unit="ton",
                category="Operacion",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="linear_trend",
                    params={"lookback_periods": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_ventas_ticket_promedio",
                model_id="model_ventas",
                name="Ticket promedio retail",
                normalized_name="ticket promedio retail",
                variable_name="ticket_promedio",
                unit="Q/ton",
                category="Ingreso",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 2.1},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_ventas_promocion",
                model_id="model_ventas",
                name="Intensidad promocional",
                normalized_name="intensidad promocional",
                variable_name="intensidad_promocional",
                unit="indice",
                category="Comercial",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="seasonal_naive",
                    params={"season_length": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_ventas_ingreso_neto",
                model_id="model_ventas",
                name="Ingreso neto retail",
                normalized_name="ingreso neto retail",
                variable_name="ingreso_neto_retail",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "demanda_exportada * ticket_promedio * (1 - intensidad_promocional / 100)"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_combustible_gasolina",
                model_id="model_combustible",
                name="Gasolina regular",
                normalized_name="gasolina regular",
                variable_name="gasolina",
                unit="Q/gal",
                category="Costo",
                source="library",
                source_ref_id="lib_gasolina",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=gasolina_prediction,
            ),
            ModelPremiseRecord(
                id="prem_combustible_diesel",
                model_id="model_combustible",
                name="Diesel flotilla",
                normalized_name="diesel flotilla",
                variable_name="diesel",
                unit="Q/gal",
                category="Costo",
                source="library",
                source_ref_id="lib_diesel",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=diesel_prediction,
            ),
            ModelPremiseRecord(
                id="prem_combustible_flete",
                model_id="model_combustible",
                name="Indice de flete regional",
                normalized_name="indice de flete regional",
                variable_name="indice_flete",
                unit="indice",
                category="Costo",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 3},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_combustible_costo_ruta",
                model_id="model_combustible",
                name="Costo ruta norte",
                normalized_name="costo ruta norte",
                variable_name="costo_ruta_norte",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "gasolina * 180 + diesel * 240 + indice_flete * 95"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_macro_tipo_cambio",
                model_id="model_macro",
                name="Tipo de cambio USD/GTQ",
                normalized_name="tipo de cambio usd gtq",
                variable_name="tipo_cambio",
                unit="Q/USD",
                category="Macro",
                source="library",
                source_ref_id="lib_tipo_cambio",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=tipo_cambio_prediction,
            ),
            ModelPremiseRecord(
                id="prem_macro_resina_usd",
                model_id="model_macro",
                name="Resina importada USD",
                normalized_name="resina importada usd",
                variable_name="resina_usd",
                unit="USD/ton",
                category="Macro",
                source="library",
                source_ref_id="lib_resina_usd",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=resina_prediction,
            ),
            ModelPremiseRecord(
                id="prem_macro_inflacion_bienes",
                model_id="model_macro",
                name="Inflacion bienes importados",
                normalized_name="inflacion bienes importados",
                variable_name="inflacion_importados",
                unit="%",
                category="Macro",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 5},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_macro_costo_importado",
                model_id="model_macro",
                name="Costo importado puesto en planta",
                normalized_name="costo importado puesto en planta",
                variable_name="costo_importado",
                unit="Q/ton",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "tipo_cambio * resina_usd * (1 + inflacion_importados / 100)"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_demanda",
                model_id="model_arima",
                name="Demanda operativa",
                normalized_name="demanda operativa",
                variable_name="demanda_operativa",
                unit="ton",
                category="Operacion",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="arima_like",
                    params={"lookback_periods": 24},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_precio_unitario",
                model_id="model_arima",
                name="Precio unitario",
                normalized_name="precio unitario",
                variable_name="precio_unitario",
                unit="Q/ton",
                category="Ingreso",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 2.4},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_costo_fijo",
                model_id="model_arima",
                name="Costo fijo",
                normalized_name="costo fijo",
                variable_name="costo_fijo",
                unit="Q",
                category="Costo",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="carry_forward",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_ocupacion_bodega",
                model_id="model_arima",
                name="Ocupacion bodega",
                normalized_name="ocupacion bodega",
                variable_name="ocupacion_bodega",
                unit="%",
                category="Operacion",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 3},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_ingreso_bruto",
                model_id="model_arima",
                name="Ingreso bruto",
                normalized_name="ingreso bruto",
                variable_name="ingreso_bruto",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "demanda_operativa * precio_unitario"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_costo_variable",
                model_id="model_arima",
                name="Costo variable",
                normalized_name="costo variable",
                variable_name="costo_variable",
                unit="Q",
                category="Costo",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "demanda_operativa * 88 + costo_fijo"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_resultado_operacion",
                model_id="model_arima",
                name="Resultado operacion",
                normalized_name="resultado operacion",
                variable_name="resultado_operacion",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "ingreso_bruto - costo_variable"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_arima_ebitda",
                model_id="model_arima",
                name="EBITDA",
                normalized_name="ebitda",
                variable_name="ebitda",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "resultado_operacion - ocupacion_bodega * 180"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_agro_cafe_volumen",
                model_id="model_agro",
                name="Volumen cafe exportado",
                normalized_name="volumen cafe exportado",
                variable_name="cafe_exportado",
                unit="qq",
                category="Operacion",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="seasonal_naive",
                    params={"season_length": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_agro_lluvia",
                model_id="model_agro",
                name="Lluvia acumulada",
                normalized_name="lluvia acumulada",
                variable_name="lluvia_acumulada",
                unit="mm",
                category="Clima",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 4},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_agro_precio_cafe",
                model_id="model_agro",
                name="Precio internacional cafe",
                normalized_name="precio internacional cafe",
                variable_name="precio_cafe",
                unit="Q/qq",
                category="Ingreso",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="linear_trend",
                    params={"lookback_periods": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_agro_ingreso",
                model_id="model_agro",
                name="Ingreso cafe exportacion",
                normalized_name="ingreso cafe exportacion",
                variable_name="ingreso_cafe",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "cafe_exportado * precio_cafe * (0.9 + lluvia_acumulada / 2000)"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_expansion_tiendas",
                model_id="model_expansion",
                name="Tiendas nuevas",
                normalized_name="tiendas nuevas",
                variable_name="tiendas_nuevas",
                unit="unidades",
                category="Operacion",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="linear_trend",
                    params={"lookback_periods": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_expansion_capex_tienda",
                model_id="model_expansion",
                name="Capex por tienda",
                normalized_name="capex por tienda",
                variable_name="capex_tienda",
                unit="Q",
                category="Capex",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 3},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_expansion_payback",
                model_id="model_expansion",
                name="Meses payback",
                normalized_name="meses payback",
                variable_name="meses_payback",
                unit="meses",
                category="Retorno",
                source="local",
                dependency_type="none",
                year_summary_method="avg",
                prediction_base=PredictionConfig(
                    method="arima_like",
                    params={"lookback_periods": 24},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_expansion_flujo",
                model_id="model_expansion",
                name="Flujo expansion",
                normalized_name="flujo expansion",
                variable_name="flujo_expansion",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "tiendas_nuevas * capex_tienda / meses_payback"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_holding_ingreso_retail",
                model_id="model_holding",
                name="Ingreso retail consolidado",
                normalized_name="ingreso retail consolidado",
                variable_name="ingreso_retail_consolidado",
                unit="Q",
                category="Resultado",
                source="model_output",
                source_ref_id="out_ventas_ingreso_neto",
                dependency_type="model_output",
                source_model_id="model_ventas",
                source_output_id="out_ventas_ingreso_neto",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="manual",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_holding_ingreso_agro",
                model_id="model_holding",
                name="Ingreso agro consolidado",
                normalized_name="ingreso agro consolidado",
                variable_name="ingreso_agro_consolidado",
                unit="Q",
                category="Resultado",
                source="model_output",
                source_ref_id="out_agro_ingreso",
                dependency_type="model_output",
                source_model_id="model_agro",
                source_output_id="out_agro_ingreso",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="manual",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_holding_flujo_expansion",
                model_id="model_holding",
                name="Flujo expansion consolidado",
                normalized_name="flujo expansion consolidado",
                variable_name="flujo_expansion_consolidado",
                unit="Q",
                category="Resultado",
                source="model_output",
                source_ref_id="out_expansion_flujo",
                dependency_type="model_output",
                source_model_id="model_expansion",
                source_output_id="out_expansion_flujo",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="manual",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_holding_corporativo",
                model_id="model_holding",
                name="Costo corporativo",
                normalized_name="costo corporativo",
                variable_name="costo_corporativo",
                unit="Q",
                category="Costo",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="moving_average",
                    params={"window": 4},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
            ModelPremiseRecord(
                id="prem_holding_resultado",
                model_id="model_holding",
                name="Resultado holding",
                normalized_name="resultado holding",
                variable_name="resultado_holding",
                unit="Q",
                category="Resultado",
                source="local",
                dependency_type="none",
                year_summary_method="sum",
                prediction_base=PredictionConfig(
                    method="formula_placeholder",
                    params={"expression": "ingreso_retail_consolidado + ingreso_agro_consolidado + flujo_expansion_consolidado - costo_corporativo"},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            ),
        ]:
            self.create_model_premise(premise=premise)

        for model_id, start_year in model_start_years.items():
            self.replace_periods(
                model_id=model_id,
                periods=build_timeline_periods(
                    existing_periods=historical_periods(start_year),
                    actuals_end_period_key=actuals_end,
                    forecast_end_period_key=forecast_end,
                ),
            )

        sales_seasonality = [0.0, 8.0, 18.0, 28.0, 40.0, 55.0, 70.0, 60.0, 42.0, 30.0, 18.0, 48.0]
        fuel_seasonality = [31.4, 30.9, 30.5, 31.0, 31.9, 33.0, 34.3, 34.8, 34.1, 33.2, 32.6, 31.9]
        fx_path = [7.74, 7.68, 7.72, 7.65, 7.71, 7.63, 7.69, 7.61, 7.67, 7.60, 7.66, 7.58]
        diesel_seasonality = [29.8, 29.4, 29.1, 29.5, 30.2, 31.0, 31.8, 32.1, 31.7, 31.0, 30.6, 30.1]
        freight_path = [95.0, 94.0, 96.0, 99.0, 102.0, 106.0, 109.0, 108.0, 104.0, 101.0, 98.0, 100.0]
        resin_path = [845.0, 848.0, 852.0, 857.0, 861.0, 866.0, 870.0, 874.0, 879.0, 884.0, 889.0, 895.0]
        imported_inflation = [8.4, 8.0, 7.7, 7.3, 6.9, 6.6, 6.3, 6.0, 5.8, 5.6, 5.4, 5.2]
        arima_seasonality = [920.0, 940.0, 975.0, 1005.0, 1035.0, 1080.0, 1125.0, 1115.0, 1088.0, 1052.0, 1038.0, 1175.0]
        price_seasonality = [214.0, 215.0, 216.0, 217.0, 218.0, 220.0, 221.0, 222.0, 223.0, 224.0, 225.0, 227.0]
        fixed_cost_seasonality = [33200.0, 33150.0, 33320.0, 33450.0, 33600.0, 33720.0, 33810.0, 33780.0, 33690.0, 33610.0, 33590.0, 33950.0]
        occupancy_path = [78.0, 79.0, 80.0, 81.0, 82.0, 84.0, 86.0, 85.0, 84.0, 83.0, 82.0, 85.0]
        coffee_harvest = [420.0, 405.0, 430.0, 445.0, 470.0, 520.0, 610.0, 690.0, 760.0, 880.0, 930.0, 850.0]
        rainfall_path = [52.0, 48.0, 61.0, 92.0, 130.0, 176.0, 205.0, 198.0, 172.0, 118.0, 88.0, 67.0]
        coffee_price = [1220.0, 1235.0, 1248.0, 1262.0, 1270.0, 1288.0, 1302.0, 1310.0, 1325.0, 1336.0, 1348.0, 1362.0]
        stores_opened = [2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 4.0, 4.0, 4.0, 5.0, 5.0, 5.0]
        capex_store = [182000.0, 181000.0, 180500.0, 181500.0, 182500.0, 183000.0, 184500.0, 185000.0, 186500.0, 187500.0, 188000.0, 189000.0]
        payback_path = [23.0, 22.5, 22.0, 21.8, 21.5, 21.2, 20.9, 20.8, 20.6, 20.4, 20.2, 20.0]
        sales_year_boost = {2021: 0.0, 2022: 72.0, 2023: 150.0, 2024: 238.0, 2025: 330.0}
        fuel_year_boost = {2022: 0.0, 2023: 1.1, 2024: 2.5, 2025: 3.6}
        fx_year_boost = {2022: 0.0, 2023: 0.06, 2024: 0.12, 2025: 0.21}
        freight_year_boost = {2022: 0.0, 2023: 3.0, 2024: 6.5, 2025: 10.0}
        resin_year_boost = {2022: 0.0, 2023: 18.0, 2024: 36.0, 2025: 54.0}
        imported_inflation_adjustment = {2022: 0.0, 2023: -1.1, 2024: -2.0, 2025: -2.9}
        arima_year_multiplier = {2021: 1.00, 2022: 1.05, 2023: 1.11, 2024: 1.16, 2025: 1.23}
        price_year_boost = {2021: 0.0, 2022: 6.0, 2023: 12.0, 2024: 20.0, 2025: 29.0}
        fixed_cost_year_boost = {2021: 0.0, 2022: 950.0, 2023: 2050.0, 2024: 3120.0, 2025: 4280.0}
        occupancy_year_boost = {2021: 0.0, 2022: 1.0, 2023: 2.2, 2024: 3.6, 2025: 5.0}
        coffee_year_multiplier = {2021: 1.00, 2022: 1.04, 2023: 1.07, 2024: 1.12, 2025: 1.17}
        rainfall_year_boost = {2021: 0.0, 2022: 8.0, 2023: 14.0, 2024: 10.0, 2025: 6.0}
        coffee_price_year_boost = {2021: 0.0, 2022: 75.0, 2023: 145.0, 2024: 215.0, 2025: 260.0}
        stores_year_boost = {2022: 0.0, 2023: 0.6, 2024: 1.1, 2025: 1.7}
        capex_year_boost = {2022: 0.0, 2023: 4500.0, 2024: 9800.0, 2025: 15200.0}
        payback_year_adjustment = {2022: 0.0, 2023: -0.5, 2024: -1.1, 2025: -1.8}
        corporate_costs = [142000.0, 141500.0, 142800.0, 143600.0, 144400.0, 145100.0, 145900.0, 146300.0, 145700.0, 145000.0, 144800.0, 146200.0]
        corporate_year_boost = {2022: 0.0, 2023: 4200.0, 2024: 8600.0, 2025: 13100.0}

        values: list[PremiseValueRecord] = []
        add_series(
            values,
            premise_id="prem_ventas_demanda",
            scenario_id="scn_ventas_base",
            start_year=2021,
            generator=lambda year, month: 780 + sales_year_boost[year] + month * 6 + sales_seasonality[month - 1],
        )
        add_series(
            values,
            premise_id="prem_ventas_ticket_promedio",
            scenario_id="scn_ventas_base",
            start_year=2021,
            generator=lambda year, month: 186 + (year - 2021) * 6 + month * 0.9,
        )
        add_series(
            values,
            premise_id="prem_ventas_promocion",
            scenario_id="scn_ventas_base",
            start_year=2021,
            generator=lambda year, month: 4.5 + [0.5, 0.8, 1.0, 1.2, 1.8, 2.4, 3.1, 2.9, 2.0, 1.6, 1.2, 2.8][month - 1] + (year - 2021) * 0.25,
        )
        add_series(
            values,
            premise_id="prem_combustible_gasolina",
            scenario_id="scn_combustible_base",
            start_year=2022,
            generator=lambda year, month: fuel_seasonality[month - 1] + fuel_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_combustible_diesel",
            scenario_id="scn_combustible_base",
            start_year=2022,
            generator=lambda year, month: diesel_seasonality[month - 1] + fuel_year_boost[year] * 0.9,
        )
        add_series(
            values,
            premise_id="prem_combustible_flete",
            scenario_id="scn_combustible_base",
            start_year=2022,
            generator=lambda year, month: freight_path[month - 1] + freight_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_macro_tipo_cambio",
            scenario_id="scn_macro_base",
            start_year=2022,
            generator=lambda year, month: fx_path[month - 1] + fx_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_macro_resina_usd",
            scenario_id="scn_macro_base",
            start_year=2022,
            generator=lambda year, month: resin_path[month - 1] + resin_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_macro_inflacion_bienes",
            scenario_id="scn_macro_base",
            start_year=2022,
            generator=lambda year, month: max(1.9, imported_inflation[month - 1] + imported_inflation_adjustment[year]),
        )
        add_series(
            values,
            premise_id="prem_arima_demanda",
            scenario_id="scn_arima_base",
            start_year=2021,
            generator=lambda year, month: arima_seasonality[month - 1] * arima_year_multiplier[year],
        )
        add_series(
            values,
            premise_id="prem_arima_precio_unitario",
            scenario_id="scn_arima_base",
            start_year=2021,
            generator=lambda year, month: price_seasonality[month - 1] + price_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_arima_costo_fijo",
            scenario_id="scn_arima_base",
            start_year=2021,
            generator=lambda year, month: fixed_cost_seasonality[month - 1] + fixed_cost_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_arima_ocupacion_bodega",
            scenario_id="scn_arima_base",
            start_year=2021,
            generator=lambda year, month: min(96.0, occupancy_path[month - 1] + occupancy_year_boost[year]),
        )
        add_series(
            values,
            premise_id="prem_agro_cafe_volumen",
            scenario_id="scn_agro_base",
            start_year=2021,
            generator=lambda year, month: coffee_harvest[month - 1] * coffee_year_multiplier[year],
        )
        add_series(
            values,
            premise_id="prem_agro_lluvia",
            scenario_id="scn_agro_base",
            start_year=2021,
            generator=lambda year, month: rainfall_path[month - 1] + rainfall_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_agro_precio_cafe",
            scenario_id="scn_agro_base",
            start_year=2021,
            generator=lambda year, month: coffee_price[month - 1] + coffee_price_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_expansion_tiendas",
            scenario_id="scn_expansion_base",
            start_year=2022,
            generator=lambda year, month: stores_opened[month - 1] + stores_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_expansion_capex_tienda",
            scenario_id="scn_expansion_base",
            start_year=2022,
            generator=lambda year, month: capex_store[month - 1] + capex_year_boost[year],
        )
        add_series(
            values,
            premise_id="prem_expansion_payback",
            scenario_id="scn_expansion_base",
            start_year=2022,
            generator=lambda year, month: max(12.0, payback_path[month - 1] + payback_year_adjustment[year]),
        )
        add_series(
            values,
            premise_id="prem_holding_corporativo",
            scenario_id="scn_holding_base",
            start_year=2022,
            generator=lambda year, month: corporate_costs[month - 1] + corporate_year_boost[year],
        )
        self.upsert_values(values=values)

        for output in [
            ModelOutputRecord(
                id="out_ventas_ingreso_neto",
                model_id="model_ventas",
                name="ingreso_neto_retail",
                display_name="Ingreso neto retail",
                source_premise_id="prem_ventas_ingreso_neto",
                description="Output consolidable del modelo retail",
                active=True,
            ),
            ModelOutputRecord(
                id="out_agro_ingreso",
                model_id="model_agro",
                name="ingreso_cafe",
                display_name="Ingreso cafe exportacion",
                source_premise_id="prem_agro_ingreso",
                description="Output consolidable del modelo agro",
                active=True,
            ),
            ModelOutputRecord(
                id="out_expansion_flujo",
                model_id="model_expansion",
                name="flujo_expansion",
                display_name="Flujo expansion",
                source_premise_id="prem_expansion_flujo",
                description="Output consolidable del modelo expansion",
                active=True,
            ),
            ModelOutputRecord(
                id="out_arima_resultado_operacion",
                model_id="model_arima",
                name="resultado_operacion",
                display_name="Resultado operacion",
                source_premise_id="prem_arima_resultado_operacion",
                description="Salida reutilizable del mini-modelo ARIMA simplificado",
                active=True,
            )
        ]:
            self.create_output(output=output)

        for edge in [
            DependencyEdgeRecord(from_type="premise", from_id="prem_ventas_demanda", to_type="premise", to_id="prem_ventas_ingreso_neto", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_ventas_ticket_promedio", to_type="premise", to_id="prem_ventas_ingreso_neto", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_ventas_promocion", to_type="premise", to_id="prem_ventas_ingreso_neto", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_combustible_gasolina", to_type="premise", to_id="prem_combustible_costo_ruta", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_combustible_diesel", to_type="premise", to_id="prem_combustible_costo_ruta", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_combustible_flete", to_type="premise", to_id="prem_combustible_costo_ruta", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_macro_tipo_cambio", to_type="premise", to_id="prem_macro_costo_importado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_macro_resina_usd", to_type="premise", to_id="prem_macro_costo_importado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_macro_inflacion_bienes", to_type="premise", to_id="prem_macro_costo_importado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_demanda", to_type="premise", to_id="prem_arima_ingreso_bruto", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_precio_unitario", to_type="premise", to_id="prem_arima_ingreso_bruto", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_demanda", to_type="premise", to_id="prem_arima_costo_variable", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_costo_fijo", to_type="premise", to_id="prem_arima_costo_variable", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_ingreso_bruto", to_type="premise", to_id="prem_arima_resultado_operacion", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_costo_variable", to_type="premise", to_id="prem_arima_resultado_operacion", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_resultado_operacion", to_type="premise", to_id="prem_arima_ebitda", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_ocupacion_bodega", to_type="premise", to_id="prem_arima_ebitda", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_agro_cafe_volumen", to_type="premise", to_id="prem_agro_ingreso", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_agro_lluvia", to_type="premise", to_id="prem_agro_ingreso", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_agro_precio_cafe", to_type="premise", to_id="prem_agro_ingreso", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_expansion_tiendas", to_type="premise", to_id="prem_expansion_flujo", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_expansion_capex_tienda", to_type="premise", to_id="prem_expansion_flujo", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_expansion_payback", to_type="premise", to_id="prem_expansion_flujo", relation="derives_from"),
            DependencyEdgeRecord(from_type="model_output", from_id="out_ventas_ingreso_neto", to_type="premise", to_id="prem_holding_ingreso_retail", relation="uses"),
            DependencyEdgeRecord(from_type="model_output", from_id="out_agro_ingreso", to_type="premise", to_id="prem_holding_ingreso_agro", relation="uses"),
            DependencyEdgeRecord(from_type="model_output", from_id="out_expansion_flujo", to_type="premise", to_id="prem_holding_flujo_expansion", relation="uses"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_holding_ingreso_retail", to_type="premise", to_id="prem_holding_resultado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_holding_ingreso_agro", to_type="premise", to_id="prem_holding_resultado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_holding_flujo_expansion", to_type="premise", to_id="prem_holding_resultado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_holding_corporativo", to_type="premise", to_id="prem_holding_resultado", relation="derives_from"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_ventas_ingreso_neto", to_type="model_output", to_id="out_ventas_ingreso_neto", relation="exports"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_agro_ingreso", to_type="model_output", to_id="out_agro_ingreso", relation="exports"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_expansion_flujo", to_type="model_output", to_id="out_expansion_flujo", relation="exports"),
            DependencyEdgeRecord(from_type="premise", from_id="prem_arima_resultado_operacion", to_type="model_output", to_id="out_arima_resultado_operacion", relation="exports"),
        ]:
            self.upsert_dependency_edge(edge=edge)

        self.upsert_prediction_overrides(
            scenario_id="scn_ventas_upside",
            overrides={
                "prem_ventas_demanda": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 5.4},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
                "prem_ventas_ticket_promedio": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 3.5},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_combustible_choque",
            overrides={
                "prem_combustible_gasolina": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 6.5},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_macro_depreciacion",
            overrides={
                "prem_macro_tipo_cambio": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 1.6},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
                "prem_macro_resina_usd": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 2.8},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_arima_estres",
            overrides={
                "prem_arima_demanda": PredictionConfig(
                    method="carry_forward",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_arima_upside",
            overrides={
                "prem_arima_demanda": PredictionConfig(
                    method="linear_trend",
                    params={"lookback_periods": 12},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
                "prem_arima_precio_unitario": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 3.6},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_agro_sequia",
            overrides={
                "prem_agro_lluvia": PredictionConfig(
                    method="carry_forward",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
                "prem_agro_cafe_volumen": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": -4.0},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_expansion_agresiva",
            overrides={
                "prem_expansion_tiendas": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 12.0},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
                "prem_expansion_capex_tienda": PredictionConfig(
                    method="growth_rate_pct",
                    params={"rate": 4.5},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )
        self.upsert_prediction_overrides(
            scenario_id="scn_holding_sinergias",
            overrides={
                "prem_holding_corporativo": PredictionConfig(
                    method="carry_forward",
                    params={},
                    forecast_start_period_key=forecast_start,
                    forecast_end_period_key=forecast_end,
                ),
            },
        )

        self._seed_activity_log()

    def _seed_activity_log(self) -> None:
        for entry in [
            ActivityLogRecord(
                id="seed_log_01",
                timestamp="2026-04-29T14:52:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="guardar", target_type="modelo",
                target_name="Modelo holding consolidado", model_name="Modelo holding consolidado",
                description="Guardó cambios en el modelo",
                detail="Timeline actualizado: actuals hasta 2025-12, forecast hasta 2026-12",
            ),
            ActivityLogRecord(
                id="seed_log_02",
                timestamp="2026-04-29T14:38:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="editar", target_type="celda",
                target_name="Inflacion bienes importados", model_name="Modelo macro suavizado",
                description="Editó valores en premisa",
                detail="Periodos 2026-01 al 2026-06 modificados",
            ),
            ActivityLogRecord(
                id="seed_log_03",
                timestamp="2026-04-29T13:15:00+00:00",
                user="Sofia Reyes", user_initials="SR", user_color="#7c3aed",
                action_type="crear", target_type="premisa",
                target_name="Costo corporativo ajustado", model_name="Modelo holding consolidado",
                description="Creó nueva premisa",
                detail="Unidad: Q · Categoría: Costo",
            ),
            ActivityLogRecord(
                id="seed_log_04",
                timestamp="2026-04-29T13:02:00+00:00",
                user="Sofia Reyes", user_initials="SR", user_color="#7c3aed",
                action_type="escenario", target_type="escenario",
                target_name="Sinergias", model_name="Modelo holding consolidado",
                description="Creó nuevo escenario",
                detail="Mayor eficiencia corporativa consolidada",
            ),
            ActivityLogRecord(
                id="seed_log_05",
                timestamp="2026-04-29T11:47:00+00:00",
                user="Mateo Guzman", user_initials="MG", user_color="#0891b2",
                action_type="prediccion", target_type="prediccion",
                target_name="Demanda operativa", model_name="Modelo rentabilidad ARIMA simplificado",
                description="Cambió método de predicción",
                detail="Método anterior: Manual → ARIMA (lookback: 24 periodos)",
            ),
            ActivityLogRecord(
                id="seed_log_06",
                timestamp="2026-04-29T11:30:00+00:00",
                user="Mateo Guzman", user_initials="MG", user_color="#0891b2",
                action_type="importar", target_type="grid",
                target_name="Modelo demanda retail", model_name="Modelo demanda retail",
                description="Importó grilla desde Excel",
                detail="14 premisas nuevas · 3 actualizadas",
            ),
            ActivityLogRecord(
                id="seed_log_07",
                timestamp="2026-04-29T10:05:00+00:00",
                user="Lucia Perez", user_initials="LP", user_color="#fc4c02",
                action_type="eliminar", target_type="premisa",
                target_name="Costo Financiero Bruto (Deprecado)", model_name="Modelo holding consolidado",
                description="Eliminó premisa del modelo",
            ),
            ActivityLogRecord(
                id="seed_log_08",
                timestamp="2026-04-28T18:20:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="crear", target_type="premisa",
                target_name="EBITDA", model_name="Modelo rentabilidad ARIMA simplificado",
                description="Creó nueva premisa",
                detail="Unidad: Q · Categoría: Resultado",
            ),
            ActivityLogRecord(
                id="seed_log_09",
                timestamp="2026-04-28T17:45:00+00:00",
                user="Sofia Reyes", user_initials="SR", user_color="#7c3aed",
                action_type="editar", target_type="timeline",
                target_name="Modelo agro exportacion", model_name="Modelo agro exportacion",
                description="Actualizó timeline del modelo",
                detail="Forecast extendido a 2027-12",
            ),
            ActivityLogRecord(
                id="seed_log_10",
                timestamp="2026-04-28T16:10:00+00:00",
                user="Mateo Guzman", user_initials="MG", user_color="#0891b2",
                action_type="prediccion", target_type="prediccion",
                target_name="Precio unitario", model_name="Modelo rentabilidad ARIMA simplificado",
                description="Configuró override en escenario",
                detail="Escenario: Upside operativo · Método: growth_rate_pct (3.6%)",
            ),
            ActivityLogRecord(
                id="seed_log_11",
                timestamp="2026-04-28T14:55:00+00:00",
                user="Lucia Perez", user_initials="LP", user_color="#fc4c02",
                action_type="guardar", target_type="modelo",
                target_name="Modelo macro suavizado", model_name="Modelo macro suavizado",
                description="Guardó cambios en el modelo",
            ),
            ActivityLogRecord(
                id="seed_log_12",
                timestamp="2026-04-28T13:30:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="escenario", target_type="escenario",
                target_name="Upside comercial", model_name="Modelo demanda retail",
                description="Creó nuevo escenario",
                detail="Mayor traccion comercial y mejor ticket",
            ),
            ActivityLogRecord(
                id="seed_log_13",
                timestamp="2026-04-27T17:00:00+00:00",
                user="Sofia Reyes", user_initials="SR", user_color="#7c3aed",
                action_type="importar", target_type="grid",
                target_name="Modelo combustible estacional", model_name="Modelo combustible estacional",
                description="Importó grilla desde Excel",
                detail="22 premisas nuevas · 0 actualizadas",
            ),
            ActivityLogRecord(
                id="seed_log_14",
                timestamp="2026-04-27T11:20:00+00:00",
                user="Lucia Perez", user_initials="LP", user_color="#fc4c02",
                action_type="eliminar", target_type="premisa",
                target_name="Indice de flete regional (v1)", model_name="Modelo combustible estacional",
                description="Eliminó premisa del modelo",
            ),
            ActivityLogRecord(
                id="seed_log_15",
                timestamp="2026-04-27T09:45:00+00:00",
                user="Mateo Guzman", user_initials="MG", user_color="#0891b2",
                action_type="crear", target_type="premisa",
                target_name="Costo ruta norte", model_name="Modelo combustible estacional",
                description="Creó nueva premisa",
                detail="Unidad: Q · Categoría: Resultado",
            ),
            ActivityLogRecord(
                id="seed_log_16",
                timestamp="2026-04-26T15:30:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="prediccion", target_type="prediccion",
                target_name="Demanda retail exportada", model_name="Modelo demanda retail",
                description="Cambió método de predicción",
                detail="Método anterior: carry_forward → linear_trend (lookback: 12 periodos)",
            ),
            ActivityLogRecord(
                id="seed_log_17",
                timestamp="2026-04-26T12:10:00+00:00",
                user="Sofia Reyes", user_initials="SR", user_color="#7c3aed",
                action_type="crear", target_type="premisa",
                target_name="Tipo de cambio USD/GTQ", model_name="Modelo macro suavizado",
                description="Creó nueva premisa desde librería",
                detail="Fuente: librería · Unidad: Q/USD · Categoría: Macro",
            ),
            ActivityLogRecord(
                id="seed_log_18",
                timestamp="2026-04-25T16:45:00+00:00",
                user="Lucia Perez", user_initials="LP", user_color="#fc4c02",
                action_type="editar", target_type="celda",
                target_name="Lluvia acumulada", model_name="Modelo agro exportacion",
                description="Editó valores en premisa",
                detail="Periodos 2026-01 al 2026-12 modificados",
            ),
            ActivityLogRecord(
                id="seed_log_19",
                timestamp="2026-04-25T11:20:00+00:00",
                user="Mateo Guzman", user_initials="MG", user_color="#0891b2",
                action_type="escenario", target_type="escenario",
                target_name="Sequia", model_name="Modelo agro exportacion",
                description="Creó nuevo escenario",
                detail="Menor lluvia y menor rendimiento proyectado",
            ),
            ActivityLogRecord(
                id="seed_log_20",
                timestamp="2026-04-24T09:00:00+00:00",
                user="Danval Valdez", user_initials="DV", user_color="#003865",
                action_type="importar", target_type="grid",
                target_name="Modelo expansion tiendas", model_name="Modelo expansion tiendas",
                description="Importó grilla desde Excel",
                detail="8 premisas nuevas · 2 actualizadas",
            ),
        ]:
            self.create_activity_log_entry(entry=entry)

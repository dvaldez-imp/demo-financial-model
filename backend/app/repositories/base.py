from __future__ import annotations

from abc import ABC, abstractmethod

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
    ScenarioPremiseOverrideRecord,
    ScenarioRecord,
)


class FinancialRepository(ABC):
    @abstractmethod
    def initialize(self, *, seed_demo: bool = True) -> None:
        raise NotImplementedError

    @abstractmethod
    def reset_data(self, *, seed_demo: bool = True) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_models(self) -> list[ModelRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_model(self, model_id: str) -> ModelRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_model(self, *, model: ModelRecord) -> ModelRecord:
        raise NotImplementedError

    @abstractmethod
    def update_model(self, *, model_id: str, changes: dict[str, object]) -> ModelRecord | None:
        raise NotImplementedError

    @abstractmethod
    def list_library_premises(self) -> list[LibraryPremiseRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_library_premise(self, premise_id: str) -> LibraryPremiseRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_library_premise(self, *, premise: LibraryPremiseRecord) -> LibraryPremiseRecord:
        raise NotImplementedError

    @abstractmethod
    def update_library_premise(self, *, premise_id: str, changes: dict[str, object]) -> LibraryPremiseRecord | None:
        raise NotImplementedError

    @abstractmethod
    def list_model_premises(self, model_id: str) -> list[ModelPremiseRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_model_premise(self, premise_id: str) -> ModelPremiseRecord | None:
        raise NotImplementedError

    @abstractmethod
    def find_model_premise_by_normalized_name(
        self,
        *,
        model_id: str,
        normalized_name: str,
    ) -> ModelPremiseRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_model_premise(self, *, premise: ModelPremiseRecord) -> ModelPremiseRecord:
        raise NotImplementedError

    @abstractmethod
    def update_model_premise(
        self,
        *,
        premise_id: str,
        changes: dict[str, object],
    ) -> ModelPremiseRecord | None:
        raise NotImplementedError

    @abstractmethod
    def delete_model_premise(self, *, premise_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def list_periods(self, model_id: str) -> list[PeriodRecord]:
        raise NotImplementedError

    @abstractmethod
    def replace_periods(self, *, model_id: str, periods: list[PeriodRecord]) -> list[PeriodRecord]:
        raise NotImplementedError

    @abstractmethod
    def upsert_periods(self, *, model_id: str, periods: list[PeriodRecord]) -> list[PeriodRecord]:
        raise NotImplementedError

    @abstractmethod
    def list_scenarios(self, model_id: str) -> list[ScenarioRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_scenario(self, scenario_id: str) -> ScenarioRecord | None:
        raise NotImplementedError

    @abstractmethod
    def get_base_scenario(self, model_id: str) -> ScenarioRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_scenario(self, *, scenario: ScenarioRecord) -> ScenarioRecord:
        raise NotImplementedError

    @abstractmethod
    def update_scenario(self, *, scenario_id: str, changes: dict[str, object]) -> ScenarioRecord | None:
        raise NotImplementedError

    @abstractmethod
    def get_prediction_overrides(self, scenario_id: str) -> dict[str, PredictionConfig]:
        raise NotImplementedError

    @abstractmethod
    def upsert_prediction_overrides(
        self,
        *,
        scenario_id: str,
        overrides: dict[str, PredictionConfig | None],
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_values_for_model(self, model_id: str) -> list[PremiseValueRecord]:
        raise NotImplementedError

    @abstractmethod
    def list_values_for_premise_ids(self, premise_ids: list[str]) -> list[PremiseValueRecord]:
        raise NotImplementedError

    @abstractmethod
    def upsert_values(self, *, values: list[PremiseValueRecord]) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_outputs(self, model_id: str) -> list[ModelOutputRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_output(self, output_id: str) -> ModelOutputRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_output(self, *, output: ModelOutputRecord) -> ModelOutputRecord:
        raise NotImplementedError

    @abstractmethod
    def update_output(self, *, output_id: str, changes: dict[str, object]) -> ModelOutputRecord | None:
        raise NotImplementedError

    @abstractmethod
    def list_active_outputs(self) -> list[ModelOutputRecord]:
        raise NotImplementedError

    @abstractmethod
    def list_all_outputs(self) -> list[ModelOutputRecord]:
        raise NotImplementedError

    @abstractmethod
    def list_dependency_edges(self) -> list[DependencyEdgeRecord]:
        raise NotImplementedError

    @abstractmethod
    def upsert_dependency_edge(self, *, edge: DependencyEdgeRecord) -> DependencyEdgeRecord:
        raise NotImplementedError

    @abstractmethod
    def delete_dependency_edges(
        self,
        *,
        to_type: str,
        to_id: str,
        relation: str | None = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_activity_log(self) -> list[ActivityLogRecord]:
        raise NotImplementedError

    @abstractmethod
    def create_activity_log_entry(self, *, entry: ActivityLogRecord) -> ActivityLogRecord:
        raise NotImplementedError

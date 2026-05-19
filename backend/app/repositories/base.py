from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.domain import (
    ActivityLogRecord,
    CompositePremiseModeRecord,
    DependencyEdgeRecord,
    LibraryPremiseRecord,
    ModelOutputRecord,
    ModelPremiseRecord,
    ModelRecord,
    PeriodRecord,
    PredictionConfig,
    PremiseModeRecord,
    PremiseValueRecord,
    ScenarioPremiseModeRecord,
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

    # ── Primitive premise modes ───────────────────────────────────────────────

    @abstractmethod
    def list_premise_modes(self, premise_id: str) -> list[PremiseModeRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_premise_mode(self, mode_id: str) -> PremiseModeRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_premise_mode(self, *, mode: PremiseModeRecord) -> PremiseModeRecord:
        raise NotImplementedError

    @abstractmethod
    def update_premise_mode(self, *, mode_id: str, changes: dict[str, object]) -> PremiseModeRecord | None:
        raise NotImplementedError

    @abstractmethod
    def delete_premise_mode(self, *, mode_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def set_default_premise_mode(self, *, premise_id: str, mode_id: str) -> bool:
        raise NotImplementedError

    # ── Composite premise modes ───────────────────────────────────────────────

    @abstractmethod
    def list_composite_premise_modes(self, premise_id: str) -> list[CompositePremiseModeRecord]:
        raise NotImplementedError

    @abstractmethod
    def get_composite_premise_mode(self, mode_id: str) -> CompositePremiseModeRecord | None:
        raise NotImplementedError

    @abstractmethod
    def create_composite_premise_mode(self, *, mode: CompositePremiseModeRecord) -> CompositePremiseModeRecord:
        raise NotImplementedError

    @abstractmethod
    def update_composite_premise_mode(self, *, mode_id: str, changes: dict[str, object]) -> CompositePremiseModeRecord | None:
        raise NotImplementedError

    @abstractmethod
    def delete_composite_premise_mode(self, *, mode_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def set_default_composite_premise_mode(self, *, premise_id: str, mode_id: str) -> bool:
        raise NotImplementedError

    # ── Scenario ↔ premise mode selections ───────────────────────────────────

    @abstractmethod
    def get_scenario_premise_modes(self, scenario_id: str) -> dict[str, str]:
        """Returns {premise_id: mode_id} for all explicit mode overrides in the scenario."""
        raise NotImplementedError

    @abstractmethod
    def upsert_scenario_premise_mode(self, *, scenario_id: str, premise_id: str, mode_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def remove_scenario_premise_mode(self, *, scenario_id: str, premise_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_effective_prediction_config(
        self,
        *,
        premise_id: str,
        scenario_id: str,
        fallback: PredictionConfig,
    ) -> PredictionConfig:
        """Resolves the active prediction config for a primitive premise in a scenario.

        Priority: scenario_premise_modes → default mode → fallback.
        """
        raise NotImplementedError

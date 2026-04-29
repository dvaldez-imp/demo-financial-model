from __future__ import annotations

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import (
    DependenciesResponse,
    DependencyEdgeOut,
    DependencyNodeOut,
    DependencyTreeResponse,
    DependencyTreeRootOut,
)
from app.schemas.domain import DependencyEdgeRecord
from app.services.predictions import extract_formula_variables


def _node_key(node_type: str, node_id: str) -> str:
    return f"{node_type}:{node_id}"


def _edge_key(edge: DependencyEdgeRecord) -> tuple[str, str]:
    return (_node_key(edge.from_type, edge.from_id), _node_key(edge.to_type, edge.to_id))


def _build_graph(edges: list[DependencyEdgeRecord]) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for edge in edges:
        source, target = _edge_key(edge)
        graph.setdefault(source, set()).add(target)
    return graph


def would_create_cycle(repository: FinancialRepository, edge: DependencyEdgeRecord) -> bool:
    if edge.from_type == edge.to_type and edge.from_id == edge.to_id:
        return True
    existing_edges = repository.list_dependency_edges()
    graph = _build_graph(existing_edges)
    source, target = _edge_key(edge)
    graph.setdefault(source, set()).add(target)

    stack = [target]
    visited: set[str] = set()
    while stack:
        node = stack.pop()
        if node == source:
            return True
        for nxt in graph.get(node, set()):
            if nxt in visited:
                continue
            visited.add(nxt)
            stack.append(nxt)
    return False


def sync_formula_dependencies(
    repository: FinancialRepository,
    *,
    model_id: str,
    target_premise_id: str,
    expression: str,
) -> None:
    try:
        variables = extract_formula_variables(expression)
    except SyntaxError as exc:
        raise HTTPException(status_code=400, detail="Formula invalida: expresion no parseable.") from exc
    model_premises = repository.list_model_premises(model_id)
    variable_index = {premise.variable_name: premise for premise in model_premises}

    repository.delete_dependency_edges(to_type="premise", to_id=target_premise_id, relation="derives_from")

    for variable_name in sorted(variables):
        source = variable_index.get(variable_name)
        if source is None or source.id == target_premise_id:
            continue
        edge = DependencyEdgeRecord(
            from_type="premise",
            from_id=source.id,
            to_type="premise",
            to_id=target_premise_id,
            relation="derives_from",
        )
        if would_create_cycle(repository, edge):
            raise HTTPException(status_code=409, detail="Dependencia invalida: crearia un ciclo entre premisas.")
        repository.upsert_dependency_edge(edge=edge)


def get_model_dependencies(repository: FinancialRepository, model_id: str) -> DependenciesResponse:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")

    models = {item.id: item.name for item in repository.list_models()}
    premises = repository.list_model_premises(model_id)
    outputs = repository.list_outputs(model_id)
    premise_ids = {premise.id for premise in premises}
    output_ids = {output.id for output in outputs}

    nodes: dict[tuple[str, str], DependencyNodeOut] = {}
    for premise in premises:
        nodes[("premise", premise.id)] = DependencyNodeOut(id=premise.id, type="premise", name=premise.name)
        if premise.source == "model_output" and premise.source_output_id:
            output = repository.get_output(premise.source_output_id)
            if output is not None:
                nodes[("model_output", output.id)] = DependencyNodeOut(
                    id=output.id,
                    type="model_output",
                    name=output.display_name,
                    model_id=output.model_id,
                    model_name=models.get(output.model_id),
                )
                output_ids.add(output.id)

    for output in outputs:
        nodes[("model_output", output.id)] = DependencyNodeOut(
            id=output.id,
            type="model_output",
            name=output.display_name,
            model_id=output.model_id,
            model_name=models.get(output.model_id),
        )

    edges: list[DependencyEdgeOut] = []
    for edge in repository.list_dependency_edges():
        if edge.from_id in premise_ids or edge.to_id in premise_ids or edge.from_id in output_ids or edge.to_id in output_ids:
            edges.append(DependencyEdgeOut(**edge.model_dump()))

    return DependenciesResponse(nodes=list(nodes.values()), edges=edges)


def get_model_dependencies_tree(
    repository: FinancialRepository,
    model_id: str,
    root_premise_id: str,
) -> DependencyTreeResponse:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")

    root_premise = repository.get_model_premise(root_premise_id)
    if root_premise is None or root_premise.model_id != model_id:
        raise HTTPException(status_code=404, detail="Root premise not found.")

    models = {item.id: item.name for item in repository.list_models()}
    premises_by_id = {}
    for item in repository.list_models():
        for premise in repository.list_model_premises(item.id):
            premises_by_id[premise.id] = premise
    outputs = repository.list_all_outputs()
    outputs_by_id = {output.id: output for output in outputs}

    incoming_by_target: dict[str, list[DependencyEdgeRecord]] = {}
    for edge in repository.list_dependency_edges():
        incoming_by_target.setdefault(_node_key(edge.to_type, edge.to_id), []).append(edge)

    nodes: dict[tuple[str, str], DependencyNodeOut] = {
        ("premise", root_premise.id): DependencyNodeOut(id=root_premise.id, type="premise", name=root_premise.name)
    }
    rendered_edges: dict[tuple[str, str, str, str, str], DependencyEdgeOut] = {}
    visited: set[str] = set()
    stack = [_node_key("premise", root_premise.id)]

    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        for edge in incoming_by_target.get(current, []):
            edge_id = (edge.from_type, edge.from_id, edge.to_type, edge.to_id, edge.relation)
            rendered_edges[edge_id] = DependencyEdgeOut(**edge.model_dump())

            if edge.from_type == "premise":
                source_premise = premises_by_id.get(edge.from_id)
                if source_premise is not None:
                    nodes[("premise", source_premise.id)] = DependencyNodeOut(
                        id=source_premise.id,
                        type="premise",
                        name=source_premise.name,
                    )
            elif edge.from_type == "model_output":
                source_output = outputs_by_id.get(edge.from_id)
                if source_output is not None:
                    nodes[("model_output", source_output.id)] = DependencyNodeOut(
                        id=source_output.id,
                        type="model_output",
                        name=source_output.display_name,
                        model_id=source_output.model_id,
                        model_name=models.get(source_output.model_id),
                    )

            source_key = _node_key(edge.from_type, edge.from_id)
            if source_key not in visited:
                stack.append(source_key)

    unique_dependencies = [
        node
        for key, node in nodes.items()
        if key != ("premise", root_premise.id)
    ]

    return DependencyTreeResponse(
        root=DependencyTreeRootOut(id=root_premise.id, type="premise", name=root_premise.name),
        nodes=list(nodes.values()),
        edges=list(rendered_edges.values()),
        unique_dependencies=unique_dependencies,
    )

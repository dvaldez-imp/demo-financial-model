from __future__ import annotations

import ast

from app.schemas.domain import PredictionConfig


class FormulaEvaluationError(ValueError):
    pass


def extract_formula_variables(expression: str) -> set[str]:
    if not expression.strip():
        return set()
    node = ast.parse(expression, mode="eval")
    variables: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            variables.add(child.id)
    return variables


def evaluate_formula(expression: str, variable_values: dict[str, float | None]) -> float | None:
    if not expression.strip():
        return None

    def _eval(node: ast.AST) -> float | None:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return float(node.value)
            raise FormulaEvaluationError("Only numeric constants are allowed in formula.")
        if isinstance(node, ast.Name):
            return variable_values.get(node.id)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            operand = _eval(node.operand)
            if operand is None:
                return None
            return operand if isinstance(node.op, ast.UAdd) else -operand
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            left = _eval(node.left)
            right = _eval(node.right)
            if left is None or right is None:
                return None
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return None if right == 0 else left / right
        raise FormulaEvaluationError("Unsupported formula expression.")

    tree = ast.parse(expression, mode="eval")
    return _eval(tree)


def _last_non_null(history: list[float | None]) -> float | None:
    for value in reversed(history):
        if value is not None:
            return value
    return None


def _recent_non_null(history: list[float | None], limit: int) -> list[float]:
    values = [value for value in history if value is not None]
    if limit <= 0:
        return values
    return values[-limit:]


def _to_positive_int(raw_value: object, default: int) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _carry_forward(history: list[float | None]) -> float | None:
    return _last_non_null(history)


def _moving_average(history: list[float | None], window: int) -> float | None:
    recent = _recent_non_null(history, window)
    if not recent:
        return None
    return sum(recent) / len(recent)


def _linear_trend(history: list[float | None], lookback_periods: int) -> float | None:
    recent = _recent_non_null(history, lookback_periods)
    if len(recent) < 2:
        return _carry_forward(history)

    x_values = list(range(len(recent)))
    x_mean = sum(x_values) / len(x_values)
    y_mean = sum(recent) / len(recent)
    denominator = sum((x - x_mean) ** 2 for x in x_values)
    if denominator == 0:
        return recent[-1]

    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, recent, strict=False)) / denominator
    intercept = y_mean - slope * x_mean
    return intercept + slope * len(recent)


def _seasonal_naive(history: list[float | None], season_length: int) -> float | None:
    if season_length <= 0 or len(history) < season_length:
        return _carry_forward(history)
    seasonal_reference = history[-season_length]
    return seasonal_reference if seasonal_reference is not None else _carry_forward(history)


def _arima_like(history: list[float | None], lookback_periods: int) -> float | None:
    season_length = 12
    recent = _recent_non_null(history, lookback_periods)
    if len(recent) < 2:
        return _carry_forward(history)
    if len(history) < season_length or history[-season_length] is None:
        return _linear_trend(history, lookback_periods)

    seasonal_reference = history[-season_length]
    assert seasonal_reference is not None
    drift_window = min(6, len(recent) - 1)
    if drift_window <= 0:
        return _carry_forward(history)

    drift_samples = [
        recent[index] - recent[index - 1]
        for index in range(len(recent) - drift_window, len(recent))
    ]
    drift = sum(drift_samples) / len(drift_samples)
    baseline = recent[-1] + drift
    return baseline * 0.65 + seasonal_reference * 0.35


def project_value(prediction: PredictionConfig, history: list[float | None]) -> float | None:
    if prediction.method == "manual":
        return None
    if prediction.method == "carry_forward":
        return _carry_forward(history)
    if prediction.method == "growth_rate_pct":
        last_value = _carry_forward(history)
        if last_value is None:
            return None
        rate = float(prediction.params.get("rate", 0))
        return last_value * (1 + rate / 100)
    if prediction.method == "moving_average":
        return _moving_average(history, _to_positive_int(prediction.params.get("window"), 3))
    if prediction.method == "linear_trend":
        return _linear_trend(history, _to_positive_int(prediction.params.get("lookback_periods"), 12))
    if prediction.method == "seasonal_naive":
        return _seasonal_naive(history, _to_positive_int(prediction.params.get("season_length"), 12))
    if prediction.method == "arima_like":
        return _arima_like(history, _to_positive_int(prediction.params.get("lookback_periods"), 24))
    if prediction.method == "formula_placeholder":
        return None
    return None

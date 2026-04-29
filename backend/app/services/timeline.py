from __future__ import annotations

from app.schemas.domain import PeriodRecord
from app.services.period_parser import sort_periods

SPANISH_MONTH_LABELS = {
    1: "ene",
    2: "feb",
    3: "mar",
    4: "abr",
    5: "may",
    6: "jun",
    7: "jul",
    8: "ago",
    9: "sep",
    10: "oct",
    11: "nov",
    12: "dic",
}


def is_month_key(value: str | None) -> bool:
    return bool(value and len(value) == 7 and value[4] == "-")


def month_key_parts(period_key: str) -> tuple[int, int]:
    year, month = period_key.split("-")
    return int(year), int(month)


def compare_month_keys(left: str | None, right: str | None) -> int:
    if left is None and right is None:
        return 0
    if left is None:
        return -1
    if right is None:
        return 1
    left_value = month_key_parts(left)
    right_value = month_key_parts(right)
    if left_value < right_value:
        return -1
    if left_value > right_value:
        return 1
    return 0


def shift_month(period_key: str, delta: int = 1) -> str:
    year, month = month_key_parts(period_key)
    month += delta
    while month > 12:
        month -= 12
        year += 1
    while month < 1:
        month += 12
        year -= 1
    return f"{year:04d}-{month:02d}"


def month_range(start_key: str, end_key: str) -> list[str]:
    current = start_key
    keys = []
    while compare_month_keys(current, end_key) <= 0:
        keys.append(current)
        current = shift_month(current)
    return keys


def make_period_label(period_key: str) -> str:
    year, month = month_key_parts(period_key)
    return f"{SPANISH_MONTH_LABELS[month]}-{str(year)[-2:]}"


def infer_actuals_end_from_periods(periods: list[PeriodRecord]) -> str | None:
    month_keys = [period.key for period in periods if period.type == "month"]
    if not month_keys:
        return None
    return max(month_keys)


def build_timeline_periods(
    *,
    existing_periods: list[PeriodRecord],
    actuals_end_period_key: str | None,
    forecast_end_period_key: str | None,
) -> list[PeriodRecord]:
    months_by_key = {period.key: period for period in existing_periods if period.type == "month"}
    month_keys = sorted(months_by_key)

    start_key: str | None = month_keys[0] if month_keys else None
    if start_key is None and actuals_end_period_key:
        start_year, _ = month_key_parts(actuals_end_period_key)
        start_key = f"{start_year:04d}-01"
    if start_key is None:
        start_key = forecast_end_period_key
    if start_key is None:
        summaries = [period for period in existing_periods if period.type == "year_summary"]
        return sort_periods(summaries)

    end_key = forecast_end_period_key or actuals_end_period_key or (month_keys[-1] if month_keys else start_key)
    assert end_key is not None

    periods: list[PeriodRecord] = []
    for key in month_range(start_key, end_key):
        if key in months_by_key:
            period = months_by_key[key]
        else:
            year, month = month_key_parts(key)
            period = PeriodRecord(
                key=key,
                label=make_period_label(key),
                type="month",
                year=year,
                month=month,
            )
        if actuals_end_period_key and compare_month_keys(key, actuals_end_period_key) <= 0:
            period.zone = "historical"
        else:
            period.zone = "forecast"
        periods.append(period)

    years = sorted({period.year for period in periods})
    existing_summaries = {period.key: period for period in existing_periods if period.type == "year_summary"}
    for year in years:
        key = str(year)
        periods.append(
            existing_summaries.get(
                key,
                PeriodRecord(
                    key=key,
                    label=key,
                    type="year_summary",
                    year=year,
                    month=None,
                    zone="summary",
                ),
            )
        )

    return sort_periods(periods)

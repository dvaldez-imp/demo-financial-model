from __future__ import annotations

import re
import unicodedata

from fastapi import HTTPException

from app.schemas.domain import PeriodRecord

MONTH_MAP = {
    "ene": 1,
    "enero": 1,
    "jan": 1,
    "january": 1,
    "feb": 2,
    "febrero": 2,
    "february": 2,
    "mar": 3,
    "marzo": 3,
    "march": 3,
    "abr": 4,
    "abril": 4,
    "apr": 4,
    "april": 4,
    "may": 5,
    "mayo": 5,
    "jun": 6,
    "junio": 6,
    "june": 6,
    "jul": 7,
    "julio": 7,
    "july": 7,
    "ago": 8,
    "agosto": 8,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "septiembre": 9,
    "september": 9,
    "oct": 10,
    "octubre": 10,
    "october": 10,
    "nov": 11,
    "noviembre": 11,
    "november": 11,
    "dic": 12,
    "diciembre": 12,
    "dec": 12,
    "december": 12,
}

MONTH_PATTERN = re.compile(r"^([a-z]+)[\s\-/]+(\d{2,4})$")
REVERSED_MONTH_PATTERN = re.compile(r"^(\d{2,4})[\s\-/]+([a-z]+)$")
YEAR_PATTERN = re.compile(r"^\d{4}$")
VARIABLE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    return normalized.strip().lower()


def to_variable_name(value: str) -> str:
    normalized = normalize_text(value)
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if not normalized:
        return "var"
    if normalized[0].isdigit():
        normalized = f"v_{normalized}"
    return normalized


def is_valid_variable_name(value: str) -> bool:
    return bool(VARIABLE_NAME_PATTERN.match(value.strip().lower()))


def parse_year(year_token: str) -> int:
    year = int(year_token)
    return 2000 + year if year < 100 else year


def parse_period_label(label: str) -> PeriodRecord | None:
    raw_label = label.strip()
    normalized = normalize_text(raw_label)
    if not normalized:
        return None
    if YEAR_PATTERN.match(normalized):
        year = int(normalized)
        return PeriodRecord(
            key=str(year),
            label=raw_label,
            type="year_summary",
            year=year,
            month=None,
            zone="summary",
        )

    match = MONTH_PATTERN.match(normalized) or REVERSED_MONTH_PATTERN.match(normalized)
    if not match:
        return None

    token_a, token_b = match.groups()
    if token_a.isdigit():
        year = parse_year(token_a)
        month_token = token_b
    else:
        month_token = token_a
        year = parse_year(token_b)

    month = MONTH_MAP.get(month_token)
    if month is None:
        return None

    return PeriodRecord(
        key=f"{year:04d}-{month:02d}",
        label=raw_label,
        type="month",
        year=year,
        month=month,
        zone="historical",
    )


def sort_periods(periods: list[PeriodRecord]) -> list[PeriodRecord]:
    unique_by_key: dict[str, PeriodRecord] = {}
    for period in periods:
        unique_by_key[period.key] = period
    return sorted(
        unique_by_key.values(),
        key=lambda period: (
            period.year,
            period.month if period.month is not None else 13,
            0 if period.type == "month" else 1,
        ),
    )


def parse_period_headers(headers: list[str]) -> list[PeriodRecord]:
    periods: list[PeriodRecord] = []
    invalid_headers: list[str] = []
    for header in headers:
        parsed = parse_period_label(header)
        if parsed is None:
            invalid_headers.append(header)
            continue
        periods.append(parsed)
    if invalid_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period headers: {', '.join(invalid_headers)}",
        )
    if not periods:
        raise HTTPException(status_code=400, detail="No valid period headers detected.")
    return sort_periods(periods)

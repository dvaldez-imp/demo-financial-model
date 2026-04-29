from app.services.period_parser import parse_period_headers, parse_period_label
from app.services.timeline import build_timeline_periods


def test_parse_period_label_supports_spanish_and_english() -> None:
    january_es = parse_period_label("ene-25")
    february_en = parse_period_label("Feb 2025")
    year_summary = parse_period_label("2025")

    assert january_es is not None
    assert january_es.key == "2025-01"
    assert february_en is not None
    assert february_en.key == "2025-02"
    assert year_summary is not None
    assert year_summary.key == "2025"
    assert year_summary.zone == "summary"


def test_build_timeline_periods_adds_forecast_and_summary_zones() -> None:
    periods = parse_period_headers(["ene-25", "mar-25"])
    timeline = build_timeline_periods(
        existing_periods=periods,
        actuals_end_period_key="2025-03",
        forecast_end_period_key="2025-05",
    )

    assert [period.key for period in timeline] == ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025"]
    assert [period.zone for period in timeline] == ["historical", "historical", "historical", "forecast", "forecast", "summary"]


def test_build_timeline_periods_supports_years_beyond_2025() -> None:
    periods = parse_period_headers(["nov-25", "dic-25"])
    timeline = build_timeline_periods(
        existing_periods=periods,
        actuals_end_period_key="2025-12",
        forecast_end_period_key="2026-03",
    )

    assert [period.key for period in timeline] == ["2025-11", "2025-12", "2025", "2026-01", "2026-02", "2026-03", "2026"]
    assert [period.zone for period in timeline] == ["historical", "historical", "summary", "forecast", "forecast", "forecast", "summary"]

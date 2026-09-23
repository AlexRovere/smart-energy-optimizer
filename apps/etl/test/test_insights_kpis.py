import pandas as pd
import pytest
from insights.kpis import build_kpis


def _frame() -> pd.DataFrame:
    timestamps = pd.date_range("2026-09-18", periods=96, freq="h", tz="UTC")
    return pd.DataFrame(
        {
            "site_id": "SITE001",
            "site_type": "office",
            "timestamp": timestamps,
            "consumption_kwh_corrected": [10.0] * 72 + [20.0] * 24,
            "consumption_kw_corrected": [10.0] * 72 + [20.0] * 24,
            "data_quality": "good",
        }
    )


def test_kpis_compare_equal_complete_windows():
    result = build_kpis(_frame(), periods_days=(1,))
    metrics = result["results"]["site:SITE001"]["1"]

    assert result["anchor_end_utc"] == "2026-09-22T00:00:00+00:00"
    assert metrics["total_energy_kwh"] == {
        "value": 480.0,
        "previous": 240.0,
        "change_percent": 100.0,
    }
    assert metrics["average_daily_kwh"]["value"] == 480.0
    assert metrics["p95_kw"]["value"] == 20.0
    assert metrics["reliable_rate_percent"]["value"] == 100.0
    assert metrics["coverage_rate_percent"]["value"] == 100.0
    assert metrics["expected_hours"] == 24


def test_kpis_build_global_type_and_site_entities():
    result = build_kpis(_frame(), periods_days=(1,))

    assert [entity["key"] for entity in result["entities"]] == [
        "all",
        "type:office",
        "site:SITE001",
    ]
    assert result["peak_thresholds_percent"] == [50, 60, 70, 80, 90, 100]


def test_kpis_reject_missing_columns():
    frame = pd.DataFrame({"site_id": ["SITE001"]})

    with pytest.raises(ValueError, match="Colonnes manquantes"):
        build_kpis(frame)

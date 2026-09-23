# teste la comparaison seuils/mesures : le CSV Locust en entrée, les dépassements en sortie
from pathlib import Path

import pytest
from check_thresholds import find_violations, read_p95

STATS_HEADER = (
    "Type,Name,Request Count,Failure Count,Median Response Time,Average Response Time,"
    "Min Response Time,Max Response Time,Average Content Size,Requests/s,Failures/s,"
    "50%,66%,75%,80%,90%,95%,98%,99%,99.9%,99.99%,100%\n"
)


def _write_stats_csv(tmp_path: Path, rows: list[str]) -> Path:
    csv_path = tmp_path / "loadtest_stats.csv"
    csv_path.write_text(STATS_HEADER + "\n".join(rows) + "\n")
    return csv_path


def test_read_p95_extracts_the_95th_percentile_per_named_request(tmp_path):
    csv_path = _write_stats_csv(
        tmp_path,
        [
            "POST,predictions_1h,100,0,120,130,90,600,200,10,0,110,115,120,125,140,180,200,250,300,400,600",
            "POST,predictions_168h,100,0,900,950,800,2000,200,10,0,850,880,900,920,1000,1400,1600,1800,1900,1950,2000",
        ],
    )

    result = read_p95(csv_path)

    assert result == {"predictions_1h": 180.0, "predictions_168h": 1400.0}


def test_read_p95_ignores_the_aggregated_total_row(tmp_path):
    csv_path = _write_stats_csv(
        tmp_path,
        [
            "POST,predictions_1h,100,0,120,130,90,600,200,10,0,110,115,120,125,140,180,200,250,300,400,600",
            ",Aggregated,100,0,120,130,90,600,200,10,0,110,115,120,125,140,180,200,250,300,400,600",
        ],
    )

    result = read_p95(csv_path)

    assert list(result) == ["predictions_1h"]


def test_find_violations_reports_requests_over_their_threshold():
    measured = {"predictions_1h": 180.0, "predictions_168h": 6000.0}
    thresholds = {"predictions_1h": 500.0, "predictions_168h": 5000.0}

    violations = find_violations(measured, thresholds)

    assert violations == [("predictions_168h", 6000.0, 5000.0)]


def test_find_violations_is_empty_when_every_measure_is_under_its_threshold():
    measured = {"predictions_1h": 180.0}
    thresholds = {"predictions_1h": 500.0}

    assert find_violations(measured, thresholds) == []


def test_find_violations_ignores_measures_without_a_configured_threshold():
    measured = {"predictions_1h": 180.0, "unconfigured": 999999.0}
    thresholds = {"predictions_1h": 500.0}

    assert find_violations(measured, thresholds) == []


def test_main_refuses_a_csv_outside_the_repository(tmp_path, monkeypatch):
    import check_thresholds

    monkeypatch.setattr("sys.argv", ["check_thresholds.py", str(tmp_path / "stats.csv")])

    with pytest.raises(SystemExit) as exit_info:
        check_thresholds.main()

    assert exit_info.value.code == 2

# teste l'orchestration extract -> transform -> load et le CLI exposé par main
import json
import sys
from datetime import date, datetime, timedelta, timezone
from unittest.mock import ANY, call, patch

import pandas as pd
import pytest

from main import build_parser, main, run_hour, run_periods, run_sites


@patch("main.load_sites_to_db")
@patch("main.dedupe_sites")
@patch("main.load_sites")
@patch("main.transform_sites")
@patch("main.fetch_sites")
def test_run_sites_writes_parquet_without_db_sync_by_default(
    mock_fetch_sites,
    mock_transform_sites,
    mock_load_sites,
    mock_dedupe_sites,
    mock_load_sites_to_db,
):
    raw = pd.DataFrame([{"site_id": "SITE001"}])
    transformed = pd.DataFrame([{"id": "SITE001", "name": "Bureau Paris"}])
    mock_fetch_sites.return_value = raw
    mock_transform_sites.return_value = transformed
    mock_load_sites.return_value = "/data/parquet/sites.parquet"

    result = run_sites()

    mock_fetch_sites.assert_called_once_with()
    mock_transform_sites.assert_called_once_with(raw)
    mock_load_sites.assert_called_once_with(transformed)
    mock_dedupe_sites.assert_not_called()
    mock_load_sites_to_db.assert_not_called()
    assert result == {"parquet_file": "/data/parquet/sites.parquet"}


@patch("main.load_sites_to_db")
@patch("main.dedupe_sites")
@patch("main.load_sites")
@patch("main.transform_sites")
@patch("main.fetch_sites")
def test_run_sites_also_syncs_db_when_requested(
    mock_fetch_sites,
    mock_transform_sites,
    mock_load_sites,
    mock_dedupe_sites,
    mock_load_sites_to_db,
):
    raw = pd.DataFrame([{"site_id": "SITE001"}])
    transformed = pd.DataFrame([{"id": "SITE001", "name": "Bureau Paris"}])
    deduped = pd.DataFrame([{"id": "SITE001", "name": "Bureau Paris"}])
    mock_fetch_sites.return_value = raw
    mock_transform_sites.return_value = transformed
    mock_load_sites.return_value = "/data/parquet/sites.parquet"
    mock_dedupe_sites.return_value = deduped
    mock_load_sites_to_db.return_value = 3

    result = run_sites(sync_db=True)

    mock_dedupe_sites.assert_called_once_with(transformed)
    mock_load_sites_to_db.assert_called_once_with(deduped)
    assert result == {"parquet_file": "/data/parquet/sites.parquet", "db_inserted": 3}


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_writes_parquet_files(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    start_time = datetime(2026, 9, 16, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 17, tzinfo=timezone.utc)
    raw = pd.DataFrame([{"site_id": "SITE001", "timestamp": pd.Timestamp("2026-09-16", tz="UTC")}])
    transformed = raw.copy()
    mock_fetch_readings.return_value = raw
    mock_transform_readings.return_value = transformed
    mock_load_readings.return_value = ["/data/parquet/site_id=SITE001/.../readings.parquet"]

    result = run_periods(start_time=start_time, end_time=end_time)

    mock_fetch_readings.assert_called_once_with(
        start_time=start_time,
        end_time=end_time,
        on_window=ANY,
        already_covered_days={"SITE001": set()},
    )
    pd.testing.assert_frame_equal(mock_transform_readings.call_args.args[0], raw)
    loaded = mock_load_readings.call_args.args[0]
    pd.testing.assert_frame_equal(loaded.reset_index(drop=True), transformed.reset_index(drop=True))
    assert result == {"parquet_files": mock_load_readings.return_value}


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_forwards_the_requested_time_range(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame()
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    start_time = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 2, tzinfo=timezone.utc)
    mock_fetch_readings.return_value = pd.DataFrame()
    mock_transform_readings.return_value = pd.DataFrame()
    mock_load_readings.return_value = []

    run_periods(start_time=start_time, end_time=end_time)

    mock_fetch_readings.assert_called_once_with(
        start_time=start_time, end_time=end_time, on_window=ANY, already_covered_days={}
    )


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_looks_up_existing_days_per_site(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}, {"site_id": "SITE002"}])
    mock_get_existing_days.side_effect = [{date(2026, 9, 1)}, set()]
    mock_get_context_days.return_value = pd.DataFrame()
    mock_fetch_readings.return_value = pd.DataFrame()
    mock_transform_readings.return_value = pd.DataFrame()
    mock_load_readings.return_value = []

    run_periods()

    mock_get_existing_days.assert_has_calls([call("SITE001"), call("SITE002")])
    mock_fetch_readings.assert_called_once_with(
        start_time=None,
        end_time=None,
        on_window=ANY,
        already_covered_days={"SITE001": {date(2026, 9, 1)}, "SITE002": set()},
    )


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_prepends_context_before_transform_and_strips_it_afterwards(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = {date(2026, 9, 1), date(2026, 9, 2)}
    context_row = pd.DataFrame(
        [
            {
                "site_id": "SITE001",
                "timestamp": pd.Timestamp("2026-08-27", tz="UTC"),
                "consumption_kw": 1.0,
            }
        ]
    )
    mock_get_context_days.return_value = context_row
    raw = pd.DataFrame(
        [
            {
                "site_id": "SITE001",
                "timestamp": pd.Timestamp("2026-09-03", tz="UTC"),
                "consumption_kw": 2.0,
            }
        ]
    )
    mock_fetch_readings.return_value = raw
    transformed_all = pd.DataFrame(
        [
            {
                "site_id": "SITE001",
                "timestamp": pd.Timestamp("2026-08-27", tz="UTC"),
                "consumption_kw_corrected": 1.0,
            },
            {
                "site_id": "SITE001",
                "timestamp": pd.Timestamp("2026-09-03", tz="UTC"),
                "consumption_kw_corrected": 2.0,
            },
        ]
    )
    mock_transform_readings.return_value = transformed_all
    mock_load_readings.return_value = []

    run_periods(
        start_time=datetime(2026, 9, 3, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 4, tzinfo=timezone.utc),
    )

    # le contexte precede bien les nouvelles lignes dans ce qui est transmis au transform
    combined = mock_transform_readings.call_args.args[0]
    assert list(combined["consumption_kw"]) == [1.0, 2.0]

    # le jour manquant (9/3) et les 7 jours avant sont demandes comme contexte : le jour lui-meme
    # peut deja porter des heures ecrites par un run precedent (cron horaire)
    mock_get_context_days.assert_called_once_with(
        "SITE001",
        {
            date(2026, 9, 3),
            date(2026, 9, 2),
            date(2026, 9, 1),
            date(2026, 8, 31),
            date(2026, 8, 30),
            date(2026, 8, 29),
            date(2026, 8, 28),
            date(2026, 8, 27),
        },
    )

    # mais seule la ligne du jour reellement extrait (9/3) est transmise au load, pas le contexte
    loaded = mock_load_readings.call_args.args[0]
    assert list(loaded["timestamp"].dt.date) == [date(2026, 9, 3)]


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_can_bypass_the_coverage_check_to_always_refetch_the_window(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    # le jour est deja entierement couvert au sens habituel...
    mock_get_existing_days.return_value = {date(2026, 9, 3)}
    mock_get_context_days.return_value = pd.DataFrame()
    mock_fetch_readings.return_value = pd.DataFrame()
    mock_transform_readings.return_value = pd.DataFrame()
    mock_load_readings.return_value = []

    # ...mais on demande quand meme a toujours refetcher la fenetre (cas de l'heure courante)
    run_periods(
        start_time=datetime(2026, 9, 3, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 3, 1, tzinfo=timezone.utc),
        skip_coverage_check=True,
    )

    mock_fetch_readings.assert_called_once_with(
        start_time=datetime(2026, 9, 3, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 3, 1, tzinfo=timezone.utc),
        on_window=ANY,
        already_covered_days={"SITE001": set()},
    )


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_skips_context_lookup_when_a_site_has_nothing_to_fetch(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = {date(2026, 9, 3)}
    mock_fetch_readings.return_value = pd.DataFrame()
    mock_transform_readings.return_value = pd.DataFrame()
    mock_load_readings.return_value = []

    run_periods(
        start_time=datetime(2026, 9, 3, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 4, tzinfo=timezone.utc),
    )

    mock_get_context_days.assert_not_called()


@patch("main.run_periods")
def test_run_hour_covers_the_60_minutes_up_to_now(mock_run_periods):
    now = datetime(2026, 9, 16, 14, 30, tzinfo=timezone.utc)
    mock_run_periods.return_value = {"parquet_files": []}

    result = run_hour(now=now)

    mock_run_periods.assert_called_once_with(
        start_time=datetime(2026, 9, 16, 13, 30, tzinfo=timezone.utc),
        end_time=now,
        verbose=False,
        skip_coverage_check=True,
        command="hour",
    )
    assert result == {"parquet_files": []}


@patch("main.run_periods")
def test_run_hour_forwards_verbose(mock_run_periods):
    mock_run_periods.return_value = {"parquet_files": []}

    run_hour(now=datetime(2026, 9, 16, 14, 30, tzinfo=timezone.utc), verbose=True)

    assert mock_run_periods.call_args.kwargs["verbose"] is True


def test_cli_exposes_sites_command():
    parser = build_parser()

    args = parser.parse_args(["sites"])

    assert args.command == "sites"


def test_cli_sync_db_flag_defaults_to_false():
    parser = build_parser()

    args = parser.parse_args(["sites"])

    assert args.sync_db is False


def test_cli_sync_db_flag_can_be_enabled():
    parser = build_parser()

    args = parser.parse_args(["sites", "--sync-db"])

    assert args.sync_db is True


def test_cli_requires_a_command():
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args([])


def test_cli_exposes_periods_command_with_no_bound_by_default():
    parser = build_parser()

    args = parser.parse_args(["periods"])

    assert args.command == "periods"
    assert args.start_time is None
    assert args.end_time is None


def test_cli_periods_start_time_option_parses_iso8601_as_utc():
    parser = build_parser()

    args = parser.parse_args(["periods", "--start-time", "2026-09-01T00:00:00"])

    assert args.start_time == datetime(2026, 9, 1, tzinfo=timezone.utc)


def test_cli_periods_end_time_option_parses_iso8601_as_utc():
    parser = build_parser()

    args = parser.parse_args(["periods", "--end-time", "2026-09-02T00:00:00"])

    assert args.end_time == datetime(2026, 9, 2, tzinfo=timezone.utc)


def test_cli_periods_time_option_keeps_an_explicit_offset():
    parser = build_parser()

    args = parser.parse_args(["periods", "--start-time", "2026-09-01T00:00:00+02:00"])

    assert args.start_time == datetime(2026, 9, 1, tzinfo=timezone(timedelta(hours=2)))


def test_cli_periods_verbose_flag_defaults_to_false():
    parser = build_parser()

    args = parser.parse_args(["periods"])

    assert args.verbose is False


def test_cli_periods_verbose_flag_can_be_enabled():
    parser = build_parser()

    args = parser.parse_args(["periods", "--verbose"])

    assert args.verbose is True


def test_cli_exposes_hour_command():
    parser = build_parser()

    args = parser.parse_args(["hour"])

    assert args.command == "hour"


def test_cli_hour_verbose_flag_defaults_to_false():
    parser = build_parser()

    args = parser.parse_args(["hour"])

    assert args.verbose is False


def test_cli_hour_verbose_flag_can_be_enabled():
    parser = build_parser()

    args = parser.parse_args(["hour", "--verbose"])

    assert args.verbose is True


def journal(captured_out: str) -> list[dict]:
    return [json.loads(line) for line in captured_out.splitlines()]


def line_of(lines: list[dict], phase: str) -> dict:
    return next(line for line in lines if line["phase"] == phase)


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_logs_one_line_per_phase_on_stdout(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
    capsys,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    raw = pd.DataFrame([{"site_id": "SITE001", "timestamp": pd.Timestamp("2026-09-16", tz="UTC")}])
    mock_fetch_readings.return_value = raw
    mock_transform_readings.return_value = raw.copy()
    mock_load_readings.return_value = ["/data/parquet/site_id=SITE001/readings.parquet"]

    run_periods(
        start_time=datetime(2026, 9, 16, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 17, tzinfo=timezone.utc),
    )

    lines = journal(capsys.readouterr().out)
    assert [line["phase"] for line in lines] == ["extract", "transform", "load", "run"]
    assert {line["command"] for line in lines} == {"periods"}


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_logs_a_mute_site_at_zero_rows(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
    capsys,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}, {"site_id": "SITE002"}])
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    raw = pd.DataFrame([{"site_id": "SITE001", "timestamp": pd.Timestamp("2026-09-16", tz="UTC")}])
    mock_fetch_readings.return_value = raw
    mock_transform_readings.return_value = raw.copy()
    mock_load_readings.return_value = ["/data/parquet/site_id=SITE001/readings.parquet"]

    run_periods(
        start_time=datetime(2026, 9, 16, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 17, tzinfo=timezone.utc),
    )

    extract = line_of(journal(capsys.readouterr().out), "extract")
    assert extract["rows"] == 1
    assert extract["rows_by_site"] == {"SITE001": 1, "SITE002": 0}


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_logs_the_requested_window_and_the_files_written(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
    capsys,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    raw = pd.DataFrame([{"site_id": "SITE001", "timestamp": pd.Timestamp("2026-09-16", tz="UTC")}])
    mock_fetch_readings.return_value = raw
    mock_transform_readings.return_value = raw.copy()
    mock_load_readings.return_value = ["a.parquet", "b.parquet"]

    run_periods(
        start_time=datetime(2026, 9, 16, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 17, tzinfo=timezone.utc),
    )

    lines = journal(capsys.readouterr().out)
    assert line_of(lines, "extract")["period_requested"] == [
        "2026-09-16T00:00:00Z",
        "2026-09-17T00:00:00Z",
    ]
    assert line_of(lines, "load")["files"] == 2


@patch("main.get_context_days")
@patch("main.get_existing_days")
@patch("main.fetch_sites")
@patch("main.load_readings")
@patch("main.transform_readings")
@patch("main.fetch_readings")
def test_run_periods_keeps_the_progress_display_out_of_stdout(
    mock_fetch_readings,
    mock_transform_readings,
    mock_load_readings,
    mock_fetch_sites,
    mock_get_existing_days,
    mock_get_context_days,
    capsys,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    mock_get_existing_days.return_value = set()
    mock_get_context_days.return_value = pd.DataFrame()
    raw = pd.DataFrame([{"site_id": "SITE001", "timestamp": pd.Timestamp("2026-09-16", tz="UTC")}])
    mock_fetch_readings.return_value = raw
    mock_transform_readings.return_value = raw.copy()
    mock_load_readings.return_value = ["a.parquet"]

    run_periods(
        start_time=datetime(2026, 9, 16, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 17, tzinfo=timezone.utc),
        verbose=True,
    )

    captured = capsys.readouterr()
    # chaque ligne de stdout doit rester du JSON : sinon jq s'arrete a la premiere
    assert [line["phase"] for line in journal(captured.out)] == [
        "extract",
        "transform",
        "load",
        "run",
    ]
    assert "au total" in captured.err


@patch("main.load_sites_to_db")
@patch("main.dedupe_sites")
@patch("main.load_sites")
@patch("main.transform_sites")
@patch("main.fetch_sites")
def test_run_sites_logs_one_line_per_phase_on_stdout(
    mock_fetch_sites,
    mock_transform_sites,
    mock_load_sites,
    mock_dedupe_sites,
    mock_load_sites_to_db,
    capsys,
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}, {"site_id": "SITE002"}])
    mock_transform_sites.return_value = pd.DataFrame([{"id": "SITE001"}, {"id": "SITE002"}])
    mock_load_sites.return_value = "/data/parquet/sites.parquet"

    run_sites()

    lines = journal(capsys.readouterr().out)
    assert [line["phase"] for line in lines] == ["extract", "transform", "load", "run"]
    assert {line["command"] for line in lines} == {"sites"}
    assert line_of(lines, "load")["rows"] == 2


@patch("main.run_periods")
def test_run_hour_tells_the_journal_which_command_it_is(mock_run_periods):
    mock_run_periods.return_value = {"parquet_files": []}

    run_hour(now=datetime(2026, 9, 16, 14, 30, tzinfo=timezone.utc))

    assert mock_run_periods.call_args.kwargs["command"] == "hour"


@patch("main.load_root_env")
@patch("main.run_sites")
def test_cli_keeps_the_human_summary_out_of_stdout(
    mock_run_sites, _mock_load_root_env, capsys, monkeypatch
):
    mock_run_sites.return_value = {"parquet_file": "/data/parquet/sites.parquet"}
    monkeypatch.setattr(sys, "argv", ["main.py", "sites"])

    main()

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "sites.parquet" in captured.err

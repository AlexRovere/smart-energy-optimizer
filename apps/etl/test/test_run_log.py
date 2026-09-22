# teste le journal d'exécution : une ligne JSON par phase sur la sortie standard
import io
import json
from datetime import datetime, timezone
from unittest.mock import patch

import pandas as pd
import pytest

from run_log import RunLogger

FROZEN_START = datetime(2026, 9, 18, 2, 0, 3, tzinfo=timezone.utc)


def read_lines(stream: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines()]


def test_emits_one_line_per_phase_then_a_run_summary():
    stream = io.StringIO()

    with RunLogger("hour", stream=stream) as logger:
        with logger.phase("extract"):
            pass
        with logger.phase("load"):
            pass

    assert [line["phase"] for line in read_lines(stream)] == ["extract", "load", "run"]


def test_each_line_carries_the_mandatory_fields():
    stream = io.StringIO()

    with RunLogger("hour", stream=stream) as logger, logger.phase("extract"):
        pass

    for line in read_lines(stream):
        assert line["command"] == "hour"
        assert line["status"] == "ok"
        assert isinstance(line["run"], str)
        assert isinstance(line["ts"], str)
        assert isinstance(line["duration_s"], float)


@patch("run_log._now", return_value=FROZEN_START)
def test_run_identifier_is_the_start_timestamp_shared_by_every_line(_mock_now):
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract"):
        pass

    identifiers = {line["run"] for line in read_lines(stream)}
    assert identifiers == {"2026-09-18T02:00:03Z"}


def test_writes_one_self_contained_json_object_per_physical_line():
    stream = io.StringIO()

    with RunLogger("sites", stream=stream) as logger, logger.phase("extract"):
        pass

    written = stream.getvalue()
    assert written.endswith("\n")
    assert "\n" not in written.rstrip("\n").replace("}\n{", "")
    for line in written.splitlines():
        json.loads(line)


def frame_for(rows: list[tuple[str, str]]) -> pd.DataFrame:
    return pd.DataFrame([{"site_id": site_id, "timestamp": moment} for site_id, moment in rows])


def first_line(stream: io.StringIO) -> dict:
    return read_lines(stream)[0]


def test_counts_rows_by_site_including_the_mute_ones():
    stream = io.StringIO()
    frame = frame_for([("SITE001", "2026-09-17T00:00:00Z"), ("SITE001", "2026-09-17T01:00:00Z")])

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract") as phase:
        phase.measure(frame, site_ids=["SITE001", "SITE002"])

    extract = first_line(stream)
    assert extract["rows"] == 2
    assert extract["rows_by_site"] == {"SITE001": 2, "SITE002": 0}


def test_logs_the_period_actually_covered():
    stream = io.StringIO()
    frame = frame_for([("SITE001", "2026-09-17T00:00:00Z"), ("SITE001", "2026-09-17T05:00:00Z")])

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract") as phase:
        phase.measure(frame, site_ids=["SITE001"])

    assert first_line(stream)["period"] == ["2026-09-17T00:00:00Z", "2026-09-17T05:00:00Z"]


def test_covered_period_reads_the_unparsed_timestamps_of_the_api():
    stream = io.StringIO()
    frame = frame_for([("SITE001", "2026-09-17T00:21:39.091922")])

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract") as phase:
        phase.measure(frame, site_ids=["SITE001"])

    assert first_line(stream)["period"] == ["2026-09-17T00:21:39Z", "2026-09-17T00:21:39Z"]


def test_logs_the_requested_window_next_to_the_covered_one():
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract") as phase:
        phase.requested(
            datetime(2026, 9, 17, tzinfo=timezone.utc),
            datetime(2026, 9, 18, tzinfo=timezone.utc),
        )

    assert first_line(stream)["period_requested"] == [
        "2026-09-17T00:00:00Z",
        "2026-09-18T00:00:00Z",
    ]


def test_an_empty_frame_reports_zero_rows_and_no_period():
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger, logger.phase("extract") as phase:
        phase.measure(pd.DataFrame(), site_ids=["SITE001"])

    extract = first_line(stream)
    assert extract["rows"] == 0
    assert extract["rows_by_site"] == {"SITE001": 0}
    assert "period" not in extract


def test_the_load_phase_reports_the_number_of_files_written():
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger, logger.phase("load") as phase:
        phase.files(14)

    assert first_line(stream)["files"] == 14


def test_the_sites_command_counts_rows_without_a_per_site_breakdown():
    stream = io.StringIO()

    with RunLogger("sites", stream=stream) as logger, logger.phase("load") as phase:
        phase.rows(7)

    load = first_line(stream)
    assert load["rows"] == 7
    assert "rows_by_site" not in load


def test_the_run_summary_reports_the_rows_of_the_last_phase_that_counted_them():
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger:
        with logger.phase("extract") as phase:
            phase.rows(5)
        with logger.phase("load") as phase:
            phase.rows(3)

    assert read_lines(stream)[-1]["rows"] == 3


def test_a_line_omits_the_fields_it_has_nothing_to_say_about():
    stream = io.StringIO()

    with RunLogger("periods", stream=stream) as logger, logger.phase("transform"):
        pass

    transform = first_line(stream)
    for absent in ("rows", "rows_by_site", "period", "period_requested", "files", "error"):
        assert absent not in transform


def fail_during(
    stream: io.StringIO,
    phase_name: str = "extract",
    message: str = "API Mock injoignable",
) -> None:
    with RunLogger("hour", stream=stream) as logger, logger.phase(phase_name) as phase:
        phase.requested(
            datetime(2026, 9, 18, 11, tzinfo=timezone.utc),
            datetime(2026, 9, 18, 12, tzinfo=timezone.utc),
        )
        raise RuntimeError(message)


def test_a_failing_phase_is_logged_with_the_exception_type_and_message():
    stream = io.StringIO()

    with pytest.raises(RuntimeError):
        fail_during(stream)

    extract = first_line(stream)
    assert extract["status"] == "error"
    assert extract["error"] == {"type": "RuntimeError", "message": "API Mock injoignable"}


def test_a_failing_phase_lets_the_exception_propagate():
    with pytest.raises(RuntimeError, match="API Mock injoignable"):
        fail_during(io.StringIO())


def test_the_run_summary_reports_the_failure_too():
    stream = io.StringIO()

    with pytest.raises(RuntimeError):
        fail_during(stream)

    run = read_lines(stream)[-1]
    assert run["phase"] == "run"
    assert run["status"] == "error"
    assert run["error"]["type"] == "RuntimeError"


def test_what_the_phase_knew_before_failing_survives_on_the_error_line():
    stream = io.StringIO()

    with pytest.raises(RuntimeError):
        fail_during(stream)

    assert first_line(stream)["period_requested"] == [
        "2026-09-18T11:00:00Z",
        "2026-09-18T12:00:00Z",
    ]


def test_no_phase_is_logged_after_the_one_that_failed():
    stream = io.StringIO()

    with pytest.raises(RuntimeError):
        fail_during(stream, phase_name="transform")

    assert [line["phase"] for line in read_lines(stream)] == ["transform", "run"]


def test_a_non_ascii_message_is_escaped_so_the_file_stays_valid_json():
    stream = io.StringIO()

    with pytest.raises(RuntimeError):
        fail_during(stream, message="connexion refusée")

    # la locale du conteneur ou de la machine decide de l'encodage de stdout : sans echappement,
    # un accent part en cp1252 dans le fichier et jq refuse de le lire
    assert stream.getvalue().isascii()
    assert first_line(stream)["error"]["message"] == "connexion refusée"

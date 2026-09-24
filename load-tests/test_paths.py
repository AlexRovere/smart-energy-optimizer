# teste que les chemins fixes des scripts de charge pointent dans le dépôt, là où la CI les attend
from pathlib import Path

from paths import LOADTEST_PARQUET_DIR, REPO_ROOT, REPORTS_DIR


def test_the_repository_root_contains_the_load_tests():
    assert (REPO_ROOT / "load-tests" / "paths.py").is_file()
    assert Path(__file__).resolve().is_relative_to(REPO_ROOT)


def test_the_synthetic_history_goes_to_the_git_ignored_data_directory():
    assert LOADTEST_PARQUET_DIR == REPO_ROOT / "data" / "loadtest-parquet"


def test_the_locust_reports_go_to_the_quality_report_directory():
    assert REPORTS_DIR == REPO_ROOT / "rapport-qualite"

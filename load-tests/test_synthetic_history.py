# teste que le générateur d'historique synthétique écrit toujours dans son dossier fixe du dépôt
import pytest
from fixtures import synthetic_history


def test_main_writes_the_history_to_the_fixed_directory(tmp_path, monkeypatch):
    output_dir = tmp_path / "loadtest-parquet"
    monkeypatch.setattr(synthetic_history, "LOADTEST_PARQUET_DIR", output_dir)
    monkeypatch.setattr("sys.argv", ["synthetic_history.py", "--sites", "1", "--years", "1"])

    synthetic_history.main()

    assert [p.name for p in output_dir.iterdir()] == ["site_id=SITE001"]


def test_main_accepts_no_output_path_argument(tmp_path, monkeypatch):
    monkeypatch.setattr("sys.argv", ["synthetic_history.py", str(tmp_path / "ailleurs")])

    with pytest.raises(SystemExit) as exit_info:
        synthetic_history.main()

    assert exit_info.value.code == 2
    assert not (tmp_path / "ailleurs").exists()

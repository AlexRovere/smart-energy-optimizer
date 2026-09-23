# teste que le générateur d'historique synthétique refuse d'écrire hors du dépôt
import pytest
from fixtures import synthetic_history


def test_main_refuses_an_output_directory_outside_the_repository(tmp_path, monkeypatch):
    monkeypatch.setattr("sys.argv", ["synthetic_history.py", str(tmp_path / "parquet")])

    with pytest.raises(SystemExit) as exit_info:
        synthetic_history.main()

    assert exit_info.value.code == 2
    assert not (tmp_path / "parquet").exists()

# teste le confinement des chemins passés en ligne de commande aux scripts de charge
from pathlib import Path

import pytest
from path_guard import resolve_within


def test_a_path_inside_the_root_is_returned_resolved(tmp_path):
    result = resolve_within(str(tmp_path / "rapport" / ".." / "stats.csv"), tmp_path)

    assert result == (tmp_path / "stats.csv").resolve()


def test_a_relative_path_is_resolved_against_the_current_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    assert resolve_within("stats.csv", tmp_path) == (tmp_path / "stats.csv").resolve()


def test_a_path_escaping_the_root_is_refused(tmp_path):
    root = tmp_path / "depot"
    root.mkdir()

    with pytest.raises(ValueError):
        resolve_within(str(root / ".." / "ailleurs.csv"), root)


def test_a_sibling_directory_sharing_the_root_prefix_is_refused(tmp_path):
    root = tmp_path / "depot"
    root.mkdir()

    with pytest.raises(ValueError):
        resolve_within(str(tmp_path / "depot-voisin" / "stats.csv"), root)


def test_the_default_root_is_the_repository(tmp_path):
    from path_guard import REPO_ROOT

    assert (REPO_ROOT / "load-tests" / "path_guard.py").is_file()
    assert Path(__file__).resolve().is_relative_to(REPO_ROOT)

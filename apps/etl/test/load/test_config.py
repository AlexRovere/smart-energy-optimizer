# teste la lecture de la config de sortie Load (répertoire Parquet, connexion PostgreSQL)
import pytest

from load.config import get_output_dir, get_postgres_connection_params


def test_get_output_dir_returns_env_value(monkeypatch):
    monkeypatch.setenv("PARQUET_DIR", "/data/parquet")

    assert get_output_dir() == "/data/parquet"


def test_get_output_dir_raises_when_missing(monkeypatch):
    monkeypatch.delenv("PARQUET_DIR", raising=False)

    with pytest.raises(RuntimeError):
        get_output_dir()


def _set_postgres_env(monkeypatch):
    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "enervision")
    monkeypatch.setenv("POSTGRES_USER", "enervision")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secret")


def test_get_postgres_connection_params_returns_env_values(monkeypatch):
    _set_postgres_env(monkeypatch)

    assert get_postgres_connection_params() == {
        "host": "localhost",
        "port": "5432",
        "dbname": "enervision",
        "user": "enervision",
        "password": "secret",
    }


def test_get_postgres_connection_params_raises_when_a_variable_is_missing(monkeypatch):
    _set_postgres_env(monkeypatch)
    monkeypatch.delenv("POSTGRES_HOST", raising=False)

    with pytest.raises(RuntimeError):
        get_postgres_connection_params()

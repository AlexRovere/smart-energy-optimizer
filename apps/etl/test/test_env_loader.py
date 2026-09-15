# teste le chargement du .env racine du monorepo dans l'environnement du process
import os

from env_loader import load_root_env


def test_load_root_env_reads_repo_root_dotenv(tmp_path, monkeypatch):
    dotenv_file = tmp_path / ".env"
    dotenv_file.write_text("ENV_LOADER_TEST_VAR=hello\n", encoding="utf-8")
    monkeypatch.setattr("env_loader.REPO_ROOT", tmp_path)
    monkeypatch.delenv("ENV_LOADER_TEST_VAR", raising=False)

    try:
        load_root_env()
        assert os.getenv("ENV_LOADER_TEST_VAR") == "hello"
    finally:
        os.environ.pop("ENV_LOADER_TEST_VAR", None)


def test_load_root_env_does_not_override_existing_env_var(tmp_path, monkeypatch):
    dotenv_file = tmp_path / ".env"
    dotenv_file.write_text("ENV_LOADER_TEST_VAR=from_dotenv\n", encoding="utf-8")
    monkeypatch.setattr("env_loader.REPO_ROOT", tmp_path)
    monkeypatch.setenv("ENV_LOADER_TEST_VAR", "from_process")

    load_root_env()

    assert os.getenv("ENV_LOADER_TEST_VAR") == "from_process"

import mlflow.catboost as mlflow_catboost
from models.catboost import load_model


def test_load_model_charge_depuis_le_registre(monkeypatch):
    loaded_uri = {}

    def fake_load(uri):
        loaded_uri["value"] = uri
        return object()

    monkeypatch.setattr(mlflow_catboost, "load_model", fake_load)

    load_model()

    assert loaded_uri["value"] == "models:/enervision-catboost@champion"


def test_load_model_accepte_un_alias_different(monkeypatch):
    loaded_uri = {}

    def fake_load(uri):
        loaded_uri["value"] = uri
        return object()

    monkeypatch.setattr(mlflow_catboost, "load_model", fake_load)

    load_model(alias="challenger")

    assert loaded_uri["value"] == "models:/enervision-catboost@challenger"

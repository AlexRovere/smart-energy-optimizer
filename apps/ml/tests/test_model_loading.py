from models.catboost import load_model


class FakeCatBoost:
    loaded_path: str | None = None

    def load_model(self, path: str) -> None:
        self.loaded_path = path


def test_load_model_reads_existing_catboost_file(tmp_path, monkeypatch):
    model_path = tmp_path / "model.cbm"
    model_path.touch()
    monkeypatch.setattr("models.catboost.CatBoostRegressor", FakeCatBoost)

    model = load_model(model_path)

    assert model.loaded_path == str(model_path)

# Charge et performance — Locust

Mesures de charge et de performance pour le service ML (`/predictions` par horizon, `/training`) et pour le dashboard (historique Parquet, accès à l'API Mock). Voir [`docs/ci-cd.md`](../docs/ci-cd.md) pour ce que la CI en fait, et ce qui est bloquant ou non.

## Structure

| Fichier | Rôle |
|---|---|
| `fixtures/synthetic_history.py` | Écrit un historique Parquet synthétique, hive-partitionné, utilisable par le service ML (entraînement) et par le dashboard (lecture d'historique) |
| `mock_api_stub.py` | Stub de `/api/v1/sites/{id}/current` : même forme, même latence, même plafond (500 pts/h) que l'API Mock réelle. **CI et local uniquement, jamais la source réelle** |
| `locustfiles/ml_predictions.py` | `POST /predictions`, trois requêtes nommées `predictions_1h`, `predictions_24h`, `predictions_168h` |
| `locustfiles/ml_training.py` | `POST /training`, poids faible (coûteux, mute le registre MLflow partagé) |
| `locustfiles/dashboard_history.py` | Connexion puis `GET /sites/{id}/history` (Parquet direct) |
| `locustfiles/dashboard_mock.py` | Connexion puis `GET /sites/{id}/current` (API Mock ou son stub) |
| `thresholds.py` | Seuils de 95e percentile (ms) par requête nommée, une seule source |
| `check_thresholds.py` | Lit le CSV `--csv` de Locust, compare à `thresholds.py`, sort en erreur sur dépassement |

## Lancer un run en local

```bash
uv sync

# Historique synthétique
uv run python -m fixtures.synthetic_history ../data/loadtest-parquet

# Service ML (dans un autre terminal, apps/ml)
cd ../apps/ml
PARQUET_DIR=../../data/loadtest-parquet uv run ml-api
curl -X POST http://localhost:8000/training   # produit l'alias "champion"

# Charge, interface web (http://localhost:8089)
cd ../../load-tests
uv run locust -f locustfiles/ml_predictions.py -f locustfiles/ml_training.py --host http://localhost:8000
```

Pour le dashboard, démarrer en plus `mock_api_stub.py` (`uv run uvicorn mock_api_stub:app --port 9999`) et le dashboard lui-même (`NUXT_MOCK_API_URL=http://localhost:9999`), puis :

```bash
uv run locust -f locustfiles/dashboard_history.py -f locustfiles/dashboard_mock.py --host http://localhost:3000
```

`LOAD_TEST_DASHBOARD_EMAIL` (défaut `admin@enervision.local`) et `LOAD_TEST_DASHBOARD_PASSWORD` (défaut vide, à renseigner : le mot de passe des comptes de démonstration, `SEED_PASSWORD` au moment de l'amorçage) contrôlent la connexion.

## Étalonner les seuils

`thresholds.py` démarre avec des valeurs volontairement larges : personne n'avait encore mesuré de run réel au moment où ce fichier a été écrit. Après un premier passage de `ci.yml` (ou un run local), lire le CSV `_stats.csv` produit, et resserrer les seuils sur cette mesure, jamais sur une estimation.

## Constater le bottleneck réel de l'API Mock

`dashboard_mock.py` tape en CI sur `mock_api_stub.py`, jamais sur l'API Mock réelle (`MOCK_API_URL`, quota partagé de 500 points/heure/client, identifiants dans `.env`). Pour constater le bottleneck réel, lancer le dashboard en local avec `NUXT_MOCK_API_URL` pointé sur la vraie source, puis le même run Locust. À ne jamais automatiser sur push : le quota est partagé avec le reste de la formation.

# Service ML EnerVision

Ce service entraine un modele CatBoost puis expose des predictions horaires
avec FastAPI. Le CSV est temporaire : le lecteur accepte deja le futur Parquet.

## Configuration

Trois variables d'environnement permettent d'indiquer les fichiers a charger :

```text
ML_DATA_PATH=datas/all_sites_combined.csv
ML_MODEL_PATH=artifacts/catboost_model.cbm
ML_SITE_CONFIG_PATH=config/sites.json
```

Le fichier doit aussi fournir hour, day_of_week, month, is_weekend et
is_working_hours pour entrainer le modele avec les valeurs du dataset. Chaque
site doit posseder au moins 168 heures consecutives. Pour une prediction future,
les quatre premieres valeurs sont calculees depuis le timestamp et les heures
ouvrees viennent de config/sites.json.

## Demarrage

Depuis `apps/ml` :

```bash
uv sync --dev
uv run ml-api
```

La documentation interactive est disponible sur `http://localhost:8000/docs`.

## Docker

Construire l'image depuis `apps/ml` :

```bash
docker build -t enervision-ml .
```

Le CSV n'est pas inclus dans l'image. Le dossier `artifacts` est monte en
ecriture pour recevoir le modele entraine :

```powershell
New-Item -ItemType Directory -Force artifacts

docker run --rm -p 8000:8000 `
  -v "${PWD}/datas:/app/datas:ro" `
  -v "${PWD}/artifacts:/app/artifacts" `
  enervision-ml
```

Ouvrir ensuite `http://localhost:8000/docs`, appeler `POST /training`, puis
utiliser `POST /predictions`. L'entrainement peut durer plusieurs minutes.

## Entrainement

`POST /training` ne demande aucun corps JSON. Il reproduit la preparation et
la configuration finale du notebook, puis ecrit
`artifacts/catboost_model.cbm`. Le modele est recharge automatiquement lors de
la prediction suivante.

## Prediction

`POST /predictions` recoit directement une liste de 1 a 168 demandes :

```json
[
  {"site_id": "SITE001", "date": "2025-01-01", "hour": 1},
  {"site_id": "SITE001", "date": "2025-01-01", "hour": 2}
]
```

La reponse conserve le meme ordre :

```json
[
  {
    "site_id": "SITE001",
    "timestamp": "2025-01-01T01:00:00",
    "consumption_kwh": 112.4
  },
  {
    "site_id": "SITE001",
    "timestamp": "2025-01-01T02:00:00",
    "consumption_kwh": 115.1
  }
]
```

Les heures manquantes entre la derniere mesure et une demande sont predites en
interne. Une prediction devient ainsi l'historique de la suivante, sans jamais
utiliser une consommation future reelle.

MLflow n'est volontairement pas inclus dans cette premiere version.

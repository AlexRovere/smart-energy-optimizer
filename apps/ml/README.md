# Service ML EnerVision

Ce service entraine un modele CatBoost puis expose des predictions horaires
avec FastAPI.

## Configuration

Trois variables d'environnement permettent d'indiquer les fichiers a charger :

```text
PARQUET_DIR=datas/parquets
ML_MODEL_PATH=artifacts/catboost_model.cbm
ML_SITE_CONFIG_PATH=config/sites.json
```

`PARQUET_DIR` pointe un dossier contenant un ou plusieurs fichiers `.parquet`
ou `.pq`, produits par l'ETL (partition `site_id=...`). Ils sont lus ensemble
avec DuckDB, y compris dans les sous-dossiers.

Les colonnes attendues sont `site_id`, `site_type`, `timestamp`,
`consumption_kwh`, `hour`, `day_of_week`, `month`, `is_weekend` et
`is_working_hours`. Chaque site doit posseder au moins 168 heures consecutives.
Pour une prediction future, les quatre premieres valeurs calendaires sont
calculees depuis le timestamp et les heures ouvrees viennent de
`config/sites.json`.

## Demarrage

Depuis `apps/ml` :

```bash
uv sync --dev
uv run ml-api
```

`ml-api` est un raccourci defini dans `apps/ml/pyproject.toml`.

La documentation interactive est disponible sur `http://localhost:8000/docs`.

## Notebook Jupyter

Depuis `apps/ml`, installer les dependances puis lancer Jupyter Lab :

```powershell
uv sync --dev
uv run jupyter lab
```

Jupyter affiche son URL dans le terminal. Deux carnets, deux questions :

| Carnet | Question | Produit |
|---|---|---|
| `model_selection.ipynb` | quel algorithme, quelles variables | la configuration reproduite par `training/train.py` |
| `impact_kpi.ipynb` | ce que le modèle fait gagner à l'exploitant | deux KPI métier, repris dans [`docs/ml.md`](../../docs/ml.md) |

`impact_kpi.ipynb` rejoue la prévision sur le bloc de test. Il charge le modèle **depuis le registre
MLflow**, par son alias `champion`, donc il mesure celui que l'API sert : lancer `POST /training` au
moins une fois avant. Ses chemins d'entrée sont groupés dans la première cellule de code.

## Insights

Apercu de la qualite et de l'evolution des mesures, depuis `apps/ml` (necessite
`PARQUET_DIR` dans `.env`) :

```powershell
uv sync --dev
uv run python notebooks/insights/prepare_data.py
uv run python notebooks/insights/build_html.py
```

Ouvrir ensuite `notebooks/insights/apercu_sites_001_003.html` dans un navigateur.

## Docker

Construire l'image depuis `apps/ml` :

```bash
docker build -t enervision-ml .
```

Le dossier Parquet n'est pas inclus dans l'image. Il est monte en lecture
seule, et le dossier `artifacts` en ecriture pour recevoir le modele entraine :

```powershell
docker rm -f enervision-ml
New-Item -ItemType Directory -Force artifacts

docker run -d `
  --name enervision-ml `
  -p 8000:8000 `
  -e PARQUET_DIR=/data `
  --mount "type=bind,source=$((Resolve-Path '.\datas\parquets').Path),target=/data,readonly" `
  --mount "type=bind,source=$((Resolve-Path '.\artifacts').Path),target=/app/artifacts" `
  enervision-ml
```

Ouvrir ensuite `http://localhost:8000/docs`, appeler `POST /training`, puis
utiliser `POST /predictions`. L'entrainement peut durer plusieurs minutes.

## Entrainement

`POST /training` ne demande aucun corps JSON. Il charge les deux dernieres
annees disponibles, reproduit la preparation et la configuration finale du
notebook, puis ecrit
`artifacts/catboost_model.cbm`. Le modele est recharge automatiquement lors de
la prediction suivante.

## Prediction

`POST /predictions` relit l'historique a chaque appel afin d'utiliser les
mesures les plus recentes. Avec les Parquet, DuckDB ne selectionne que les sites
demandes et leur historique recent. Seuls le modele CatBoost et la configuration
des horaires restent en memoire.

Deux conditions sont verifiees pour chaque site avant la premiere prediction :

1. les 168 dernieres heures d'historique doivent etre presentes, consecutives
   et exploitables apres le nettoyage des donnees ;
2. la derniere heure demandee doit se situer au maximum 168 heures apres la
   derniere mesure historique connue.

La recursion commence uniquement apres cette validation. Les valeurs historiques
corrigees par forward fill restent des donnees historiques : elles ne proviennent
jamais d'une prediction du modele.

Il recoit directement une liste de 1 a 168 demandes :

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

Chaque entraînement enregistre une version dans le registre MLflow et lui repose l'alias
`champion` ; c'est cette version que la prédiction charge.

## Tests et couverture

Depuis `apps/ml`, lancer :

```powershell
uv sync --dev
uv run pytest
```

Pytest affiche le detail de la couverture des fichiers de `src`. Le seuil
minimal est fixe a 80 % dans `pyproject.toml` : la commande echoue
automatiquement si la couverture descend sous ce niveau.

## Architecture du microservice

Le microservice possede deux responsabilites principales : entrainer un modele
CatBoost a partir de l'historique et utiliser ce modele pour produire des
predictions horaires.

```mermaid
flowchart TB
    USER["Utilisateur<br/>Swagger ou application"]

    subgraph CONTAINER["Conteneur du microservice ML"]
        API["API FastAPI<br/>api/main.py"]
        SCHEMAS["Contrats API<br/>api/schemas.py"]

        subgraph DATA["Acces aux donnees"]
            READER["Lecteur d'historique<br/>data/history.py"]
            PARQUET["Dossier de Parquet<br/>PARQUET_DIR"]
            DUCKDB["Lecture et filtres DuckDB"]
        end

        subgraph FEATURES["Construction des features"]
            CALENDAR["Calendrier<br/>heure, jour, mois, week-end"]
            SCHEDULE["Horaires des sites<br/>config/sites.json"]
            HISTORY["Historique de consommation<br/>lags et moyennes glissantes"]
        end

        subgraph TRAINING["Entrainement"]
            TRAIN["training/train.py"]
            CATBOOST_TRAIN["CatBoostRegressor"]
        end

        subgraph PREDICTION["Prediction"]
            SERVICE["models/prediction.py"]
            RECURSIVE["Prediction recursive<br/>de 1 h a 168 h"]
        end

        MODEL_LOADER["Chargement du modele<br/>models/catboost.py"]
        ARTIFACT["Modele entraine<br/>artifacts/catboost_model.cbm"]
    end

    USER -->|"HTTP / Swagger"| API
    API <--> SCHEMAS

    PARQUET --> DUCKDB
    DUCKDB -. "alimente le lecteur" .-> READER

    READER --> TRAIN
    READER --> SERVICE

    TRAIN --> FEATURES
    FEATURES --> CATBOOST_TRAIN
    CATBOOST_TRAIN --> ARTIFACT

    ARTIFACT --> MODEL_LOADER
    MODEL_LOADER --> SERVICE

    CALENDAR --> FEATURES
    SCHEDULE --> FEATURES
    HISTORY --> FEATURES

    FEATURES --> RECURSIVE
    SERVICE --> RECURSIVE
    RECURSIVE --> API
    API -->|"Reponse JSON"| USER

    classDef user fill:#e1f5fe,stroke:#0288d1,color:#01579b
    classDef api fill:#fff3e0,stroke:#f57c00,color:#e65100
    classDef data fill:#e8f5e9,stroke:#388e3c,color:#1b5e20
    classDef feature fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    classDef train fill:#fff8e1,stroke:#f9a825,color:#f57f17
    classDef prediction fill:#e8eaf6,stroke:#3949ab,color:#1a237e
    classDef artifact fill:#fce4ec,stroke:#d81b60,color:#880e4f

    class USER user
    class API,SCHEMAS api
    class READER,PARQUET,DUCKDB data
    class CALENDAR,SCHEDULE,HISTORY feature
    class TRAIN,CATBOOST_TRAIN train
    class SERVICE,RECURSIVE,MODEL_LOADER prediction
    class ARTIFACT artifact
```

Les features proviennent de trois sources :

1. le timestamp cible pour l'heure, le jour de la semaine, le mois et le week-end ;
2. `config/sites.json` pour les heures ouvrees de chaque site ;
3. l'historique de consommation pour les lags et les moyennes glissantes.

## Flux des appels API

Le flux se separe selon l'endpoint appele depuis Swagger.

```mermaid
flowchart TD
    START["Appel depuis Swagger"]
    CHOICE{"Quel endpoint<br/>est appele ?"}

    START --> CHOICE

    CHOICE -->|"POST /training"| T1["1. Lecture du Parquet"]
    T1 --> T2["2. Tri chronologique<br/>par site"]
    T2 --> T3["3. Correction des consommations<br/>manquantes"]
    T3 --> T4["4. Construction des features"]

    T4 --> T5["Valeurs calendaires<br/>prises dans le dataset"]
    T4 --> T6["Lags<br/>1 h, 2 h, 24 h, 48 h, 168 h"]
    T4 --> T7["Moyennes glissantes<br/>24 h et 168 h"]

    T5 --> T8["5. Separation chronologique"]
    T6 --> T8
    T7 --> T8

    T8 --> T9["6. Entrainement CatBoost<br/>sur train et validation"]
    T9 --> T10["7. Sauvegarde du modele<br/>catboost_model.cbm"]
    T10 --> T11["8. Suppression de l'ancien<br/>modele mis en cache"]
    T11 --> T12["Reponse Swagger<br/>sites, lignes et periode"]

    CHOICE -->|"POST /predictions"| P1["1. Validation de la liste<br/>de 1 a 168 demandes"]

    P1 --> P2{"Modele deja<br/>en memoire ?"}
    P2 -->|"Non"| P3["Chargement de CatBoost"]
    P2 -->|"Oui"| P4["Reutilisation du modele"]
    P3 --> P5["Chargement de l'historique"]
    P4 --> P5

    P5 --> P6["2. Regroupement des demandes<br/>par site"]
    P6 --> P7["3. Recuperation des<br/>168 dernieres heures"]

    P7 --> P8{"Historique complet<br/>et horaire ?"}
    P8 -->|"Non"| ERROR["Erreur explicite"]
    P8 -->|"Oui"| P9["4. Premiere heure a predire"]

    P9 --> P10["Calcul depuis le timestamp<br/>heure, jour, mois, week-end"]
    P9 --> P11["Lecture de config/sites.json<br/>pour is_working_hours"]
    P9 --> P12["Calcul des lags et<br/>moyennes glissantes"]

    P10 --> P13["Prediction CatBoost"]
    P11 --> P13
    P12 --> P13

    P13 --> P14["Ajout de la prediction<br/>dans l'historique temporaire"]
    P14 --> P15{"Reste-t-il une heure<br/>a predire ?"}
    P15 -->|"Oui"| P9
    P15 -->|"Non"| P16["Conservation uniquement<br/>des heures demandees"]

    P16 --> P17["Remise dans l'ordre<br/>de la requete"]
    P17 --> P18["Reponse JSON<br/>avec les consommations prevues"]

    classDef start fill:#e1f5fe,stroke:#0288d1,color:#01579b
    classDef decision fill:#fff3e0,stroke:#f57c00,color:#e65100
    classDef training fill:#fff8e1,stroke:#f9a825,color:#f57f17
    classDef prediction fill:#e8eaf6,stroke:#3949ab,color:#1a237e
    classDef feature fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    classDef success fill:#e8f5e9,stroke:#388e3c,color:#1b5e20
    classDef error fill:#ffebee,stroke:#d32f2f,color:#b71c1c

    class START start
    class CHOICE,P2,P8,P15 decision
    class T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11 training
    class P1,P3,P4,P5,P6,P7,P9,P13,P14,P16,P17 prediction
    class P10,P11,P12 feature
    class T12,P18 success
    class ERROR error
```

## Prediction recursive

Pour produire plusieurs heures, CatBoost avance une heure apres l'autre.
Chaque prediction devient une valeur disponible pour construire les lags de
l'heure suivante.

```mermaid
flowchart LR
    REAL["Derniere consommation reelle"] --> H1["Prediction H+1"]
    H1 --> H2["Prediction H+2"]
    H2 --> H3["Prediction H+3"]
    H3 --> DOTS["..."]
    DOTS --> H168["Prediction H+168"]

    H1 -. "devient un lag" .-> H2
    H2 -. "devient un lag" .-> H3

    classDef real fill:#e8f5e9,stroke:#388e3c,color:#1b5e20
    classDef prediction fill:#e8eaf6,stroke:#3949ab,color:#1a237e

    class REAL real
    class H1,H2,H3,DOTS,H168 prediction
```

> Le modele predit la premiere heure, puis utilise cette prediction comme si
> elle faisait partie de l'historique pour calculer l'heure suivante.

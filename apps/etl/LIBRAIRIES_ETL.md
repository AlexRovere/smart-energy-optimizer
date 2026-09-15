# Librairies ETL

## Cœur pipeline

| Librairie | Version pinnée | Utilité |
|---|---|---|
| **pandas** | 2.2.3 | Manipulation de données tabulaires (DataFrames). |
| **pyarrow** | 18.1.0 | Lecture/écriture du format Parquet. |
| **numpy** | 1.26.4 | Calcul numérique vectorisé. |
| **python-dotenv** | 1.2.2 | Chargement de variables d'environnement depuis des fichiers `.env`. |
| **duckdb** | ≥1.0.0 | Moteur de requêtes analytiques (SQL) sur fichiers Parquet. |
| **psycopg2-binary** | 2.9.10 | Driver PostgreSQL, écriture du référentiel des sites (accès borné, voir `docs/architecture.md`). |

## Configuration

| Librairie | Version | Utilité |
|---|---|---|
| **PyYAML** | ≥6.0.0 | Lecture/écriture de fichiers YAML. |

## Tests

| Librairie | Version | Utilité |
|---|---|---|
| **pytest** | ≥8.0.0 | Framework de tests unitaires/fonctionnels. |

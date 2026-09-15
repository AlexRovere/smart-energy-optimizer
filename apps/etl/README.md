# ETL — Sites

Ingestion du référentiel des sites depuis l'API Mock IoT vers un fichier Parquet, avec ajout optionnel en base PostgreSQL.

## Commandes

```bash
python main.py sites             # extrait, transforme, écrit le référentiel en Parquet
python main.py sites --sync-db   # idem, + ajoute les sites manquants en base PostgreSQL
```

## Fonctionnement

### Extract

Appelle `GET /api/v1/sites` sur l'API Mock IoT et récupère le référentiel des sites tel quel (JSON → DataFrame). Aucune autre route n'est consommée pour l'instant.

### Transform

Dédoublonne le référentiel sur `site_id`, en gardant la première occurrence rencontrée. Pas d'autre règle métier appliquée à ce stade.

### Load

Écrit toujours le référentiel en Parquet (`sites.parquet`, dans le répertoire configuré). Avec `--sync-db`, compare en plus aux sites déjà en base et n'insère que ceux qui manquent — jamais de mise à jour ni de suppression sur les sites existants.

## Variables d'environnement

| Variable       | Utilisée pour |
|----------------|---|
| `MOCK_API_URL` | URL de base de l'API Mock IoT (Extract) |
| `PARQUET_DIR`  | Répertoire d'écriture du fichier Parquet (Load) |
| `POSTGRES_***` | Connexion PostgreSQL (Load, `--sync-db` uniquement) |


Toute modification de ces variables dans l'environnement du conteneur impacte directement son comportement au prochain démarrage.

# ETL — Sites & Historique des mesures

Ingestion depuis l'API Mock IoT vers Parquet : référentiel des sites et historique des mesures, avec ajout optionnel du référentiel en base PostgreSQL.

## Commandes

```bash
# Sites
python main.py sites                            # extrait, transforme, écrit le référentiel en Parquet
python main.py sites --sync-db                   # idem, + ajoute les sites manquants en base PostgreSQL

# Historique des mesures sur une période
python main.py periods                                                    # 7 derniers jours par défaut
python main.py periods --start-time 2026-09-01T00:00:00                   # ISO 8601 ; UTC si aucun décalage indiqué ; --end-time non donné = --start-time + 7 jours
python main.py periods --end-time 2026-09-08T00:00:00+02:00               # idem, --start-time non donné = --end-time - 7 jours ; décalage explicite conservé tel quel
python main.py periods --start-time 2026-09-01T00:00:00 --end-time 2026-09-08T00:00:00
python main.py periods --verbose                 # barre de progression (extract/transform/load) ; sans l'option : silencieux (adapté au cron)

# Historique des mesures, dernière heure glissante (adapté à un cron horaire)
python main.py hour                              # équivalent à periods --start-time {maintenant - 60mn} --end-time {maintenant}, toujours refetché
python main.py hour --verbose
```

## Fonctionnement

### Extract

- `sites` : `GET /api/v1/sites` sur l'API Mock IoT, JSON → DataFrame tel quel. Aucune autre route n'est consommée pour le référentiel.
- `periods` / `hour` : `GET /api/v1/readings`, découpé en fenêtres d'1 jour maximum pour `periods` (1 heure pour `hour`), un site à la fois. Le paramètre `limit` envoyé à l'API est calculé pour obtenir **exactement 1 point par heure**, quelle que soit la taille de la fenêtre. `periods` saute les jours déjà présents sur disque (sauf à la frontière d'un manque) ; `hour` refetch systématiquement sa fenêtre, y compris sur un jour déjà partiellement couvert.

### Transform

- `sites` : nettoie les noms de colonnes (`site_id → id`, `site_type → type`, `site_name → name`...), dédoublonne sur `id` (première occurrence gardée).
- `periods` / `hour` : arrondit chaque timestamp à l'heure la plus proche (minute et seconde à zéro), clone les colonnes corrigibles en `{colonne}_corrected` (forward-fill par site), calcule les lags de consommation (`1h`, `2h`, `24h`, `48h`, `168h`) et moyennes glissantes (`24h`, `168h`), ajoute les champs calendaires (`hour`, `day_of_week`, `month`, `is_weekend`, `is_working_hours`).

### Load

- `sites` : écrit toujours `sites.parquet`. Avec `--sync-db`, compare aux sites déjà en base et n'insère que ceux qui manquent — jamais de mise à jour ni de suppression. La table `sites` doit déjà exister (créée par ailleurs, hors périmètre ETL) : l'ETL n'y touche jamais.
- `periods` / `hour` : une partition Parquet par site et par jour (`site_id=.../year=.../month=.../day=.../readings.parquet`). Chaque écriture **fusionne** avec le contenu déjà présent sur cette partition (dédoublonné sur `timestamp`, la valeur la plus récente l'emporte) plutôt que de l'écraser, pour que `hour` accumule les heures d'une même journée sans effacer les précédentes.

## Variables d'environnement

| Variable       | Utilisée pour |
|----------------|---|
| `MOCK_API_URL` | URL de base de l'API Mock IoT (Extract) |
| `PARQUET_DIR`  | Répertoire d'écriture du fichier Parquet (Load) |
| `POSTGRES_***` | Connexion PostgreSQL (Load, `--sync-db` uniquement) |


Toute modification de ces variables dans l'environnement du conteneur impacte directement son comportement au prochain démarrage.

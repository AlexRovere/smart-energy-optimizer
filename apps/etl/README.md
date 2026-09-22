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
python main.py periods --verbose                 # barre de progression (extract/transform/load) sur stderr ; le journal JSON sort sur stdout dans les deux cas

# Historique des mesures, dernière heure glissante (adapté à un cron horaire)
python main.py hour                              # équivalent à periods --start-time {maintenant - 60mn} --end-time {maintenant}, toujours refetché
python main.py hour --verbose
```

### Analyses locales

Depuis la racine du dépôt sous PowerShell, les scripts d'insights lisent les
partitions Parquet sans les modifier :

```powershell
$env:PARQUET_DIR = "D:\enerVision\data\output"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\prepare_data.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_profiles_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_comparison_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_kpi_html.py"
```

`prepare_data.py` produit les JSON intermédiaires. Les quatre scripts suivants
génèrent `apercu_sites_001_003.html`, `profils_consommation.html` et
`comparaison_types_sites.html`, puis `tableau_kpi.html` dans
`apps/etl/insights`. Ces sorties sont locales et ignorées par Git.

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

## Journal d'exécution

Chaque exécution émet **une ligne JSON par phase sur la sortie standard**, `--verbose` ou pas. L'ETL n'écrit aucun fichier de journal : la redirection et la rotation appartiennent à la ligne de cron du playbook (#47).

```bash
python main.py hour > /var/log/enervision/etl.jsonl
```

```json
{"run": "2026-09-18T13:38:51Z", "command": "periods", "phase": "extract", "status": "ok", "ts": "2026-09-18T13:38:56Z", "duration_s": 5.046, "rows": 336, "rows_by_site": {"SITE001": 48}, "period": ["2026-09-14T00:00:00Z", "2026-09-15T23:00:00Z"], "period_requested": ["2026-09-14T00:00:00Z", "2026-09-16T00:00:00Z"]}
{"run": "2026-09-18T13:38:51Z", "command": "periods", "phase": "load", "status": "ok", "ts": "2026-09-18T13:38:57Z", "duration_s": 0.062, "rows": 336, "rows_by_site": {"SITE001": 48}, "files": 14}
{"run": "2026-09-18T13:38:51Z", "command": "periods", "phase": "run", "status": "ok", "ts": "2026-09-18T13:38:57Z", "duration_s": 5.171, "rows": 336}
```

| Champ | Contenu |
|---|---|
| `run` | horodatage de démarrage, identique sur toutes les lignes d'une même exécution |
| `command` | `sites`, `periods` ou `hour` |
| `phase` | `extract`, `transform`, `load`, puis `run` pour la synthèse |
| `status` | `ok` ou `error` |
| `ts` / `duration_s` | fin de la phase, et sa durée en secondes |
| `rows` / `rows_by_site` | lignes traitées, détaillées par site. Un site sans donnée apparaît à `0` plutôt que de disparaître |
| `period` | période **réellement** couverte par les lignes obtenues, à côté de `period_requested` : l'écart entre les deux est un trou de collecte |
| `files` | partitions Parquet écrites (phase `load`) |
| `error` | type et message de l'exception (`status: "error"`) |

Une phase qui casse est journalisée, la ligne `run` reprend l'échec, et le processus **sort en code 1** : le code de sortie déclenche l'alerte, le journal explique pourquoi. Le traceback complet part sur stderr, avec la barre de progression et les phrases de fin, pour que stdout ne porte que du JSON exploitable.

```bash
# combien de lignes chargées aujourd'hui
jq -s '[.[] | select(.phase == "load" and (.run | startswith("2026-09-18"))) | .rows] | add' etl.jsonl

# quelles exécutions ont échoué
jq -r 'select(.phase == "run" and .status == "error") | [.run, .command, .error.type] | @tsv' etl.jsonl

# quels sites sont restés muets
jq -r 'select(.phase == "extract") | .rows_by_site | to_entries[] | select(.value == 0) | .key' etl.jsonl
```

## Variables d'environnement

| Variable       | Utilisée pour |
|----------------|---|
| `MOCK_API_URL` | URL de base de l'API Mock IoT (Extract) |
| `PARQUET_DIR`  | Répertoire d'écriture du fichier Parquet (Load) |
| `POSTGRES_***` | Connexion PostgreSQL (Load, `--sync-db` uniquement) |


Toute modification de ces variables dans l'environnement du conteneur impacte directement son comportement au prochain démarrage.

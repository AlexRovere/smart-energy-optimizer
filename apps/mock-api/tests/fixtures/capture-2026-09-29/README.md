# Capture de l'API Mock réelle, 29 septembre 2026

Réponses brutes de l'API Mock de la formation (EnerVision Mock API 1.1.0), enregistrées le 29 septembre 2026 vers 08:07 UTC, tant que le service répondait encore. Elles sont la référence des tests de contrat : le simulateur doit rendre les mêmes formes.

Aucune ne porte d'identifiant : l'authentification de la source passe par l'URL, jamais par les réponses.

| Fichier | Requête |
|---|---|
| `openapi.json` | `GET /openapi.json`, le contrat complet |
| `root.json`, `health.json` | `GET /`, `GET /health` |
| `sites.json`, `site-SITE001.json` | `GET /api/v1/sites`, `GET /api/v1/sites/SITE001` |
| `current-SITE001.json`, `current-SITE003.json` | `GET /api/v1/sites/{id}/current` |
| `readings-defaut.json` | `GET /api/v1/readings`, sans paramètre |
| `readings-SITE001-48h.json` | `GET /api/v1/readings?site_id=SITE001&start_time=2026-09-27T00:00:00&end_time=2026-09-29T00:00:00&limit=1000`. **Tronqué aux 30 premiers points** (1 000 à l'origine, 285 Ko) : ils suffisent à fixer le pas de répartition |
| `semaine-SITE00x.json` | `GET /api/v1/readings?site_id=SITE00x&start_time=2026-09-22T00:00:00&end_time=2026-09-29T00:00:00&limit=168`, une semaine horaire par site. Source des profils et des taux de panne |
| `alerts.json`, `alerts-SITE001.json` | `GET /api/v1/alerts`, puis filtré par site |
| `sensors-status.json` | `GET /api/v1/sensors/status` |
| `stats-summary.json` | `GET /api/v1/stats/summary` |
| `erreur-404-site.json` | `GET /api/v1/sites/SITE999` |
| `erreur-422-readings.json` | `GET /api/v1/readings?limit=abc` |

`POST /api/v1/simulate/spike/{site_id}` n'a pas été appelée : elle modifie un service partagé avec les autres groupes.

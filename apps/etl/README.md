# ETL : ingestion des capteurs

Extrait les mesures de l'API Mock IoT, les transforme et les charge dans TimescaleDB.

Rôle porteur : Data & IA. Domaine : `domain:data`. Épreuve : EC05.

## Règles de qualité des données, non négociables

L'API Mock injecte volontairement des pannes de capteurs et des pertes réseau. Elle renvoie alors un **200 avec des champs `null`** et un `null_reasons` renseigné. Le sujet en fait un critère d'évaluation explicite.

- **Ne jamais filtrer une réponse 200 contenant des `null`.** Un null ignoré est une perte d'information sur la fiabilité des capteurs.
- **Conserver `data_quality` et `null_reasons` en base**, ce sont eux qui tracent cette fiabilité.
- **Stocker la valeur brute ET la valeur imputée dans deux colonnes distinctes.** Ne jamais écraser un null sans traçabilité.
- **Documenter la stratégie d'imputation** retenue et son risque : conserver le null, interpolation linéaire (panne courte), report de la valeur précédente (consommation stable), moyenne mobile (bruit isolé), exclusion (agrégats).
- `stats/summary` exclut les sites à `null` de son total : tout affichage agrégé doit signaler des données incomplètes.

## Endpoints consommés

| Endpoint | Usage |
|---|---|
| `GET /api/v1/sites` | référentiel des sites |
| `GET /api/v1/sites/{id}/current` | mesure instantanée, temps réel |
| `GET /api/v1/readings` | historique, alimentation en batch |
| `GET /api/v1/sensors/status` | santé des capteurs |
| `GET /api/v1/alerts` | alertes actives |

Base URL fournie par le formateur, à mettre dans `.env` (`MOCK_API_URL`).

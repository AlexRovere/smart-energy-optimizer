# Simulateur de l'API Mock

Rejoue l'API Mock de la formation (EnerVision Mock API 1.1.0) : mêmes routes, mêmes formes JSON, mêmes erreurs. L'ETL et le dashboard s'y branchent sans rien changer, `MOCK_API_URL` reste le seul interrupteur.

Il sert trois usages :

- **la pile de développement**, sans secret ni appel vers l'extérieur ;
- **les tests de charge** de la CI, qui ne doivent jamais toucher la source réelle (quota partagé) ;
- **la relève**, le jour où l'API de la formation s'éteint : sans source, l'ETL n'ingère plus rien, le temps réel tombe, et le ML finit par refuser de prédire faute d'heures récentes.

## D'où viennent les données

De l'API réelle elle-même, enregistrée le 29 septembre 2026 dans [`tests/fixtures/capture-2026-09-29/`](./tests/fixtures/capture-2026-09-29/README.md) :

- **les sites** sont recopiés tels quels ;
- **les profils de consommation** sont les moyennes horaires mesurées sur une semaine, en semaine et le week-end, par site (`catalog.py`) ;
- **les pannes** suivent les taux observés : capteur de consommation 4,6 %, électrique 3,4 %, température 7,7 %, humidité 6,4 %, perte réseau 1,5 %. Une perte réseau vide tout (`critical`), une panne donne `partial`, plusieurs `degraded`.

Une mesure est **déterministe** : un site à un instant donné rend toujours la même valeur. L'ETL relit des fenêtres déjà écrites et dédoublonne sur l'horodatage, une valeur qui changerait d'un appel à l'autre réécrirait l'historique à chaque passage.

## Routes

| Route | Comportement |
|---|---|
| `GET /`, `GET /health` | Comme l'original |
| `GET /api/v1/sites`, `/sites/{id}` | Le catalogue enregistré, `404` sur un site inconnu |
| `GET /api/v1/sites/{id}/current` | La mesure de l'instant, horodatée sans fuseau |
| `GET /api/v1/readings` | `limit` points répartis à pas constant sur `[start_time, end_time[`, sans pagination. Sans `site_id`, `limit` est partagé entre les sept sites. Défauts : 24 h avant maintenant, `limit=100` |
| `GET /api/v1/alerts` | Une alerte `sensor` par site en panne, une alerte `consumption` au-delà de 90 % de la capacité |
| `GET /api/v1/sensors/status` | Les capteurs en panne dans la mesure de l'instant |
| `GET /api/v1/stats/summary` | Synthèse du parc tirée des mesures de l'instant |

Alertes, état des capteurs et synthèse dérivent de la même mesure : un capteur en panne dans `/sensors/status` est une valeur nulle dans `/current` au même instant.

**Non reproduit** : `POST /api/v1/simulate/spike/{site_id}`. Rien ne l'appelle, et sa réponse n'a pas été enregistrée (appeler une route qui modifie un service partagé avec d'autres groupes n'était pas acceptable). Le seuil de 90 % des alertes de consommation est un choix du simulateur : aucune réponse enregistrée ne permettait de le déduire.

## Réglages

| Variable | Défaut | Effet |
|---|---|---|
| `MOCK_LATENCY_MS` | `0` | Latence ajoutée à chaque appel de `/api/v1/*` |
| `MOCK_RATE_LIMIT_PER_HOUR` | `0` (pas de quota) | Au-delà, `429 {"detail": "Quota horaire dépassé"}`. Le quota vaut pour tout le processus, plus strict que la source réelle (500 par heure **et par client**) |

La CI des tests de charge pose `150` et `500` pour retrouver le goulot de la source réelle.

## Lancer

```bash
uv sync
uv run uvicorn mock_api.app:app --port 9999
uv run pytest
```

Sous Windows, viser `127.0.0.1` plutôt que `localhost` depuis un client Python : `requests` essaie d'abord IPv6 et perd deux secondes par appel quand le serveur n'écoute qu'en IPv4.

L'image (`Dockerfile`) écoute sur le port 8000, sous un utilisateur sans droits, avec un healthcheck sur `/health`.

# Contrats d'interface

Ce que chaque brique expose, et sous quelle forme. Voir [`architecture.md`](./architecture.md) pour les briques et leurs frontières, [`data.md`](./data.md) pour le modèle relationnel et le contrat des fichiers.

Toute modification passe par une pull request qui dit ce qui change et pourquoi. Les arbitrages et leurs motifs vivent dans Supervisor, pas ici.

---

## Conventions

| Règle | Valeur |
| :--- | :--- |
| Routes et champs | anglais, comme l'API Mock |
| Format | JSON, UTF-8 |
| Nommage des champs | `snake_case`, entrées comprises |
| Horodatages | ISO 8601, UTC, suffixe `Z` |
| Identifiant de site | `SITE001` à `SITE007` |
| Timeout sortant | 5 s |
| Évolution | un champ **ajouté** n'est jamais une rupture ; un champ retiré ou renommé en est une |

Erreur, partout la même forme, sans trace d'exécution :

```json
{ "statusCode": 401, "message": "Identifiants invalides" }
```

Chaque entrée de l'applicatif est validée ; une entrée invalide reçoit `422`.

---

## 1. Applicatif vers navigateur

HTTPS via le proxy. Authentification par cookie `HttpOnly`, `Secure`, `SameSite`, portant un identifiant de session opaque.

La colonne « Rôle » décrit le mécanisme complet. **Un seul rôle est exploité au MVP**, `ADMIN`.

| Méthode | Route | Entrée | 200 | Erreurs | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | `{ email, password }` | `{ success: true }` + cookie | 401, 422, 429 | public |
| POST | `/api/auth/logout` | | `{ success: true }` | 401 | authentifié |
| GET | `/api/auth/session` | | `{ user: { id, email, role, sites } }` | 401 | authentifié |
| GET | `/api/health` | | `{ status, db, parquet, version, uptime }` | | public |
| GET | `/api/admin/users` | | `User[]` | 401, 403 | `ADMIN` |
| POST | `/api/admin/users` | `{ email, password, role, sites }` | `User` | 401, 403, 409, 422 | `ADMIN` |
| PUT | `/api/admin/users/{id}` | `{ email?, role?, sites?, is_active? }` | `User` | 401, 403, 404, 422 | `ADMIN` |
| DELETE | `/api/admin/users/{id}` | | `{ success: true }` | 401, 403, 404 | `ADMIN` |
| GET | `/api/sites` | | `Site[]` | 401 | tous |
| GET | `/api/sites/{id}/current` | | `EnergyReading` | 401, 403, 404, 503 | tous |
| GET | `/api/sites/{id}/history` | `?from=&to=&limit=` | `EnergyReading[]` | 401, 403, 404, 422 | tous |
| PUT | `/api/sites/{id}/settings` | `{ warning_threshold_kw }` | `Site` | 401, 403, 404, 422 | `ADMIN`, `OPERATOR` |
| GET | `/api/stats/summary` | | `ParkSummary` | 401, 503 | tous |
| GET | `/api/alerts` | `?site_id=&severity=` | `Alert[]` | 401, 422, 503 | tous |
| GET | `/api/sensors/status` | | `SensorStatus` | 401, 503 | tous |
| POST | `/api/sites/{id}/prediction` | `{ horizon_hours }`, 1 à 48, défaut 24 | `Prediction` | 401, 403, 422 | tous |
| GET | `/api/recommendations` | `?site_id=` | `Recommendation[]` | 401, 422 | tous |

Trois règles que le tableau ne dit pas :

- **`403` et non `404`** sur un site hors périmètre : distinguer « n'existe pas » de « pas pour vous » est nécessaire au diagnostic.
- **`401` et non `404`** sur un compte inconnu, avec le message d'un mot de passe faux : distinguer les deux ferait de `/api/auth/login` un annuaire des comptes. Pour la même raison, une adresse absente est tout de même confrontée à une empreinte leurre, sinon le temps de réponse rétablit la distinction.
- Un identifiant de site reçu du client est **comparé** au périmètre autorisé, il ne sert jamais de source.
- Le `POST` de prédiction **ne modifie rien** : un rejeu après timeout est sans risque. L'applicatif garde le résultat quelques secondes, le proxy ne pouvant pas le mettre en cache.

**Le `429` de `/api/auth/login`.** Cinq tentatives par fenêtre de quinze minutes, comptées sur **deux** clés à la fois, l'adresse et le compte visé, la plus restrictive l'emportant. L'adresse seule ne suffirait pas : un client industriel est derrière un NAT, donc tout un site partage une adresse et l'erreur d'un poste verrouillerait ses collègues. Le compte seul laisserait passer un balayage de comptes depuis une adresse unique. La réponse porte `Retry-After`, en secondes.

Le compteur vit en **mémoire du processus**, pas en base : c'est le raisonnement qui écarte déjà Redis dans `data.md`, il n'y a qu'une instance et rien à partager. Une table aurait coûté une migration et une purge, et offert une écriture en base à chaque tentative ratée. Un redémarrage remet les compteurs à zéro, faiblesse assumée : elle n'est pas provocable de l'extérieur.

**L'adresse du client** est celle de la connexion, et `X-Forwarded-For` n'est lu que si `NUXT_TRUST_PROXY` vaut vrai. Ce drapeau suit la mise en place du proxy de #39 et rien d'autre : activé sans proxy, l'en-tête se forge et l'attaquant se donne une adresse neuve à chaque essai ; laissé faux derrière le proxy, toutes les requêtes portent l'adresse du proxy et le premier balayage verrouille tout le monde.

---

## 2. Applicatif vers API Mock

Le temps réel passe par la source, pas par les fichiers. Base : `MOCK_API_URL`.

| Route de l'applicatif | Route appelée |
| :--- | :--- |
| `/api/sites/{id}/current` | `/api/v1/sites/{id}/current` |
| `/api/stats/summary` | `/api/v1/stats/summary` |
| `/api/alerts` | `/api/v1/alerts` |
| `/api/sensors/status` | `/api/v1/sensors/status` |

`/api/sites` n'est pas un relais : elle lit PostgreSQL, que l'ETL alimente.

Sur échec : trois tentatives avec attente croissante, puis `503`.

**Limite de la source : 500 points par heure et par client.** Elle contraint le chargement de l'historique, pas le temps réel.

---

## 3. Applicatif et service ML vers les fichiers Parquet

Pas d'interface réseau : le répertoire est **monté en lecture seule**, à `/data`, et chacun le lit avec sa bibliothèque. L'applicatif avec DuckDB (`@duckdb/node-api`), le service ML avec pandas. Le filtre sur les sites autorisés est appliqué dans la requête.

Si le répertoire est absent, l'historique est indisponible et le reste fonctionne.

---

## 4. Applicatif vers service ML

Réseau interne, pas d'authentification, non exposé par le proxy. Base : `ML_API_URL`.

| Méthode | Route | Entrée | Sortie |
| :--- | :--- | :--- | :--- |
| POST | `/predictions` | `{ site_id, horizon_hours }`, 1 à 48, défaut 24 | `Prediction` |
| GET | `/health` | | `{ status, model_version }` |

**Au-delà de 48 heures, `422`.** La prédiction est autorégressive : le modèle prévoit une heure puis réinjecte sa propre valeur, donc le coût croît avec la distance et les biais s'accumulent. Refuser vaut mieux que rendre une valeur à laquelle personne ne devrait croire.

Le service ML n'a **aucune notion d'utilisateur** : l'autorisation est résolue avant l'appel.

---

## 5. ETL

Vers l'**API Mock** en entrée, base `MOCK_API_URL`. Vers le **répertoire Parquet** en sortie, monté en écriture : l'ETL écrit des fichiers, il n'expose aucune route. Et vers **PostgreSQL** pour la seule table `sites`, avec un rôle aux droits limités à cette table.

Écriture atomique, fichier temporaire puis renommage, partition par site puis par période. Schéma déclaré dans un module unique. Voir [`data.md`](./data.md).

---

## 6. Schémas

### `Site`

```json
{
  "site_id": "SITE001",
  "site_type": "office",
  "site_name": "Bureau Paris La Défense",
  "location": "Paris, France",
  "capacity_kw": 200,
  "status": "active",
  "warning_threshold_kw": 160,
  "present_in_source": true
}
```

Les six premiers champs viennent de la source. `warning_threshold_kw` à `null` vaut 80 % de `capacity_kw`.

### `EnergyReading`

```json
{
  "timestamp": "2026-09-16T14:00:00Z",
  "site_id": "SITE001",
  "site_type": "office",
  "consumption_kw": 87.34,
  "consumption_kwh": 87.34,
  "voltage_v": 401.2,
  "current_a": 125.8,
  "power_factor": 0.94,
  "temperature_celsius": 18.6,
  "humidity_percent": 62.0,
  "null_reasons": [],
  "data_quality": "good"
}
```

**Les `null` sont normaux dans une réponse 200.** `data_quality` vaut `good`, `partial`, `degraded` ou `critical`, et `null_reasons` dit pourquoi. Les deux se propagent jusqu'à l'écran.

### `Alert`

```json
{
  "alert_id": "ALR-SITE002-1718458320",
  "timestamp": "2026-09-16T14:12:00Z",
  "site_id": "SITE002",
  "severity": "high",
  "type": "threshold",
  "message": "Risque de surcharge sur Usine Lyon Vénissieux",
  "value": 812.5,
  "threshold": 720.0
}
```

`severity` : `low`, `medium`, `high`, `critical`. `type` : `spike`, `threshold`, `anomaly`, `outage`, `sensor`. Une valeur inconnue ne doit pas casser l'affichage.

### `SensorStatus`

```json
{
  "SITE001": {
    "site_name": "Bureau Paris La Défense",
    "sensors": {
      "consumption": { "status": "ok", "failing_until": null },
      "electrical":  { "status": "ok", "failing_until": null },
      "temperature": { "status": "failing", "failing_until": "2026-09-16T16:00:00Z" },
      "humidity":    { "status": "ok", "failing_until": null },
      "network":     { "status": "ok", "failing_until": null }
    },
    "overall": "degraded"
  }
}
```

### `ParkSummary`

```json
{
  "timestamp": "2026-09-16T14:32:00Z",
  "total_sites": 7,
  "excluded_sites": ["SITE004"],
  "total_consumption_kw": 1842.30,
  "total_capacity_kw": 4130,
  "average_load_percent": 44.6,
  "sites": [
    {
      "site_id": "SITE001",
      "site_name": "Bureau Paris La Défense",
      "current_consumption_kw": 87.34,
      "capacity_kw": 200,
      "load_percent": 43.7,
      "data_quality": "good"
    }
  ]
}
```

Les sites sans mesure sont **exclus des totaux et nommés** dans `excluded_sites`. Les deux ensemble, sinon le total est faux sans le dire.

### `Prediction`

```json
{
  "site_id": "SITE001",
  "predicted_at": "2026-09-16T10:00:00Z",
  "horizon_hours": 24,
  "granularity": "hour",
  "model_version": "3",
  "predictions": [
    { "timestamp": "2026-09-16T11:00:00Z", "predicted_consumption_kw": 92.5 }
  ]
}
```

`granularity` est en **sortie seulement** : le modèle dit à quel pas il a travaillé. `model_version` est l'identifiant du registre MLflow.

### `Recommendation`

```json
{
  "recommendation_id": "REC-SITE001-1718458320",
  "site_id": "SITE001",
  "source": "threshold",
  "type": "scheduling",
  "priority": "high",
  "title": "Décaler la climatisation en heures creuses",
  "description": "Le site est à 92 % de sa capacité souscrite.",
  "trigger": { "timestamp": "2026-09-16T14:00:00Z", "value_kw": 184.0, "threshold_kw": 160 },
  "estimated_saving_kwh": 150.0
}
```

`source` vaut `threshold` ou `forecast`. Les recommandations de seuil sont calculées par l'applicatif et ne dépendent pas du modèle ; celles de prévision s'ajoutent quand le service ML répond. `trigger` porte la mesure qui a déclenché.

---

## 7. Dégradation

| Dépendance | Critique | Si indisponible |
| :--- | :--- | :--- |
| PostgreSQL | oui | `503` sur les routes authentifiées, `/api/health` dit `"db": "unavailable"` |
| API Mock | oui | trois tentatives, puis `503` sur le temps réel et bandeau à l'écran ; l'historique reste servi |
| Répertoire Parquet | non | historique indisponible, le temps réel fonctionne |
| Service ML | non | `{ available: false, reason }` ; l'écran affiche le réel et dit que la prévision manque. Les recommandations de seuil continuent |

Le tableau de bord ne tombe **jamais** parce que le service ML est absent.

---

## 8. Variables d'environnement

Deux nommages coexistent volontairement : `.env` porte des noms neutres, la composition les transmet à chaque conteneur sous le nom qu'il attend. Nuxt ne lit que des variables préfixées `NUXT_`.

| `.env` | Conteneur | Nom dans le conteneur |
| :--- | :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | applicatif | `NUXT_POSTGRES_USER`, `NUXT_POSTGRES_PASSWORD`, `NUXT_POSTGRES_DB`, plus `NUXT_POSTGRES_HOST` et `NUXT_POSTGRES_PORT` posés par la composition |
| `SESSION_SECRET` | applicatif | `NUXT_SESSION_PASSWORD`, nom lu par `nuxt-auth-utils` |
| `TRUST_PROXY` | applicatif | `NUXT_TRUST_PROXY`, faux par défaut, vrai seulement derrière le proxy de #39 |
| `MOCK_API_URL` | applicatif, ETL | `NUXT_MOCK_API_URL` / `MOCK_API_URL` |
| `PARQUET_DIR_HOST` | composition seule | sert au montage |
| *(constante `/data`)* | applicatif, ETL, ML | `NUXT_PARQUET_DIR` / `PARQUET_DIR` |
| `ML_API_URL` | applicatif | `NUXT_ML_SERVICE_URL`, la clé `mlServiceUrl` du `runtimeConfig` |
| `LOG_LEVEL` | tous | `NUXT_LOG_LEVEL` / `LOG_LEVEL` |

**L'URL de connexion ne se transporte pas, elle s'assemble.** L'applicatif la construit depuis ces morceaux, comme l'ETL, parce que l'hôte et le port ne sont pas des secrets et changent selon d'où l'on appelle. `NUXT_DATABASE_URL` reste une surcharge explicite, pour la boucle locale et les tests, et l'emporte quand elle est posée (#158).

**Hors composition**, personne ne traduit : l'applicatif lit directement les noms `NUXT_`. La boucle de développement les pose donc tels quels dans `.env.dev`, versionné parce qu'il ne contient aucun secret (voir le README et [`secrets.md`](./secrets.md)).

Aucun secret en clair dans un fichier versionné : SOPS et age.

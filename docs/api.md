# Contrats d'interface

Ce document est la **source unique** des contrats entre les quatre briques. Il n'est recopié nulle part : chaque README de service pointe vers sa section.

Il est issu du croisement de trois propositions envoyées le 15 septembre 2026, comme le daily du J2 l'avait décidé (« les contrats d'API, on va te les fournir à la mi-journée, tu le centralises et tu nous fais un fichier de synthèse »). Les arbitrages rendus et ce qui a été écarté sont en fin de document.

**Ce contrat ne change que par décision tracée**, c'est le dernier critère de #102. Concrètement : une modification passe par une PR qui dit ce qui change et pourquoi, et la section « Journal » en garde la trace.

Voir [`architecture.md`](./architecture.md) pour les principes dont ces contrats découlent, et [`data.md`](./data.md) pour le modèle relationnel et le contrat des fichiers.

---

## Vue d'ensemble

```mermaid
flowchart LR
    NAV[Navigateur]
    RP[Reverse proxy<br/>TLS]
    APP[Applicatif<br/>Nuxt, BFF]
    PG[(PostgreSQL)]
    MOCK[API Mock<br/>externe]
    PARQ[/Repertoire Parquet<br/>monte/]
    ETL[ETL<br/>Python]
    ML[Service ML<br/>Python]

    NAV -->|HTTPS| RP
    RP -->|HTTP interne| APP
    APP -->|TCP, SQL| PG
    APP -->|HTTP, temps reel| MOCK
    APP -->|DuckDB, lecture seule| PARQ
    APP -->|HTTP interne| ML
    ETL -->|HTTP, extraction| MOCK
    ETL -->|ecriture de fichiers| PARQ
    ML -->|pandas, lecture seule| PARQ
```

**Une seule brique est jointe par le navigateur**, l'applicatif, derrière le proxy. Le service ML n'est pas exposé : c'est la frontière de #39, rappelée par le dernier critère de #97.

**Le répertoire Parquet n'est pas un service.** Il n'a ni port, ni route, ni conteneur : c'est un répertoire de la machine monté dans les conteneurs qui en ont besoin. Lire une partition est une requête DuckDB sur un chemin local, pas un appel réseau. Voir « Ce qui a été écarté ».

---

## Conventions communes

| Règle | Valeur |
| :--- | :--- |
| Langue des routes et des champs | **anglais**, comme l'API Mock et les schémas |
| Format | JSON, UTF-8 |
| Horodatages | ISO 8601, **UTC**, suffixe `Z` |
| Identifiant de site | `SITE001` à `SITE007`, la chaîne de la source |
| Nommage des champs | **`snake_case` partout sur le fil**, entrées comprises |
| Versionnage d'URL | aucun au MVP, client unique |
| Évolution | **un champ ajouté à une réponse n'est jamais une rupture** ; un champ retiré ou renommé en est une, et passe par une décision tracée |
| Timeout par défaut sur un appel sortant | 5 s |

`snake_case` et pas `camelCase` : l'essentiel des données est relayé verbatim depuis l'API Mock, qui est en `snake_case`. Convertir la moitié des champs crée une couche de correspondance, et un champ oublié dans cette couche ne lève rien, il devient `undefined`. Le TypeScript garde du `camelCase` en interne, par un `transform` Zod à la frontière.

### Format d'erreur, partout

```json
{ "statusCode": 401, "message": "Identifiants invalides" }
```

Jamais de trace d'exécution ni de détail technique dans une réponse d'erreur.

### Validation

Chaque entrée de l'applicatif est validée par un schéma **Zod**, défini une fois dans `shared/schemas/` et importé des deux côtés.

```typescript
// shared/schemas/history.ts
export const historyQuerySchema = z.object({
  from:  z.string().datetime(),
  to:    z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
})

// A la frontiere seulement, le TypeScript retrouve ses habitudes :
export const settingsBodySchema = z.object({
  alert_threshold_kw: z.number().int().positive().nullable(),
}).transform(({ alert_threshold_kw }) => ({ alertThresholdKw: alert_threshold_kw }))
```

---

## 1. Applicatif vers navigateur

L'API du tableau de bord. Producteur : l'applicatif, routes `/server/api/`. Transport : HTTPS via le proxy. Authentification : cookie de session `HttpOnly`, `Secure`, `SameSite`, portant un **identifiant de session opaque** (cf. [`data.md`](./data.md)).

La colonne « Rôle » décrit le mécanisme complet. **Un seul rôle est exploité au MVP**, `ADMIN` : les profils restreints se montrent à l'oral et se lisent dans les tests.

### Authentification

| Méthode | Route | Entrée | 200 | Erreurs | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | `{ email, password }` | `{ success: true }` + cookie | 401, 422, **429** | public |
| POST | `/api/auth/logout` | | `{ success: true }`, cookie effacé et session révoquée en base | 401 | authentifié |
| GET | `/api/auth/session` | | `{ user: { id, email, role, sites: string[] } }` | 401 | authentifié |

`429` est le critère de limitation par adresse IP de #29. `sites` rend le périmètre résolu côté serveur : l'interface s'en sert pour n'afficher que ce qui est accessible, **sans que ce soit la source de l'autorisation**, qui reste le filtre SQL.

### Santé

| Méthode | Route | 200 | Rôle |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | `{ status, db, parquet, version, uptime }` | public |

`db` et `parquet` rendent `"connected"` ou `"unavailable"` : le contrôle de santé dit ce qui manque, sinon il ne sert qu'à dire que le processus est vivant.

### Administration

| Méthode | Route | Entrée | 200 | Erreurs | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/api/admin/users` | | `User[]`, sans empreinte | 401, 403 | `ADMIN` |
| POST | `/api/admin/users` | `{ email, password, role, sites[] }` | `User` | 401, 403, 409, 422 | `ADMIN` |
| PUT | `/api/admin/users/{id}` | `{ email?, role?, sites?, is_active? }` | `User` | 401, 403, 404, 422 | `ADMIN` |
| DELETE | `/api/admin/users/{id}` | | `{ success: true }` | 401, 403, 404 | `ADMIN` |
| POST | `/api/admin/sites/reload` | | `{ loaded, updated, missing }` | 401, 403, 503 | `ADMIN` |

`sites` est un tableau d'identifiants dans la charge utile ; en base ce sont des lignes de `user_sites`. Le rechargement du référentiel répond au critère « un rechargement met à jour les sites existants sans les dupliquer » de #21, et il fournit au passage l'action réservée à l'administrateur que demande #95.

### Données

Toutes authentifiées, et **filtrées par le périmètre du compte**. Un identifiant de site reçu du client est comparé au périmètre autorisé ; il ne sert jamais de source.

| Méthode | Route | Paramètres | 200 | Erreurs | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/api/sites` | | `Site[]` | 401 | tous |
| GET | `/api/sites/{id}/current` | | `EnergyReading` | 401, 403, 404, 503 | tous |
| GET | `/api/sites/{id}/history` | `?from=&to=&limit=` | `EnergyReading[]` | 401, 403, 404, 422 | tous |
| PUT | `/api/sites/{id}/settings` | `{ alert_threshold_kw }` | `Site` | 401, 403, 404, 422 | `ADMIN`, `OPERATOR` |
| GET | `/api/stats/summary` | | `ParkSummary` | 401, 503 | tous |
| GET | `/api/alerts` | `?site_id=&severity=` | `Alert[]` | 401, 422, 503 | tous |
| GET | `/api/sensors/status` | | `SensorStatus` | 401, 503 | tous |

**`403` et non `404` sur un site hors périmètre** : le compte sait que le site existe, il n'y a rien à cacher de plus, et un `404` rendrait indistinguables « n'existe pas » et « pas pour vous » au moment de diagnostiquer.

`PUT /api/sites/{id}/settings` est la seule écriture non administrative, et c'est ce qui distingue `OPERATOR` de `VIEWER`. Elle sert le critère « les seuils sont configurables, pas codés en dur » de #43.

### Prédiction et recommandations

| Méthode | Route | Entrée | 200 | Dégradé | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/api/sites/{id}/prediction` | `{ horizon_hours }` | `Prediction` | `{ available: false, reason }` | tous |
| GET | `/api/recommendations` | `?site_id=` | `Recommendation[]` | les recommandations de seuil seules | tous |

**Ce `POST` ne modifie rien.** C'est une lecture, dont l'entrée passe par un corps parce qu'elle est appelée à grandir. Deux conséquences à respecter : un rejeu après timeout est sans risque, et comme le proxy ne peut pas mettre la réponse en cache, **l'applicatif garde le résultat quelques secondes de son côté**.

---

## 2. Applicatif vers API Mock

Le **temps réel ne passe pas par les fichiers Parquet** : l'applicatif appelle la source directement. Décidé au daily du J2. Base : variable `MOCK_API_URL`.

| Route de l'applicatif | Route appelée | Note |
| :--- | :--- | :--- |
| `/api/sites/{id}/current` | `/api/v1/sites/{id}/current` | relais direct |
| `/api/stats/summary` | `/api/v1/stats/summary` | relais direct |
| `/api/alerts` | `/api/v1/alerts` | **les alertes viennent de la source**, on ne les calcule pas |
| `/api/sensors/status` | `/api/v1/sensors/status` | relais direct |

`/api/sites` n'est pas dans cette table : elle lit **PostgreSQL**, pas la source. Le référentiel y est chargé par `POST /api/admin/sites/reload`, qui appelle `/api/v1/sites` et fait un `UPSERT`. Voir [`data.md`](./data.md).

Sur échec : trois tentatives avec attente croissante, puis `503` et bandeau dégradé à l'écran.

---

## 3. Applicatif vers les fichiers Parquet

**Ce n'est pas une interface réseau.** Le répertoire exposé est monté en lecture seule dans le conteneur, et l'applicatif l'interroge avec **DuckDB par son API Node officielle** `@duckdb/node-api`. Le chemin arrive par variable d'environnement.

```sql
SELECT horodatage, consommation_kw, data_quality
  FROM read_parquet('${PARQUET_DIR_EXPOSE}/site_id=*/**/*.parquet', hive_partitioning := true)
 WHERE site_id IN (...)          -- le perimetre resolu, jamais le parametre du client
   AND horodatage BETWEEN ? AND ?
 ORDER BY horodatage;
```

C'est ce qui sert `/api/sites/{id}/history`. Le cloisonnement se lit à deux endroits : dans le `WHERE`, et dans le fichier de composition, puisque **ce qui n'est pas monté n'est pas lisible**.

Si le répertoire est absent ou vide, l'historique est indisponible et le reste du tableau de bord fonctionne.

---

## 4. Applicatif vers service ML

Réseau interne uniquement, pas d'authentification, pas d'exposition par le proxy. Base : variable `ML_API_URL`.

| Méthode | Route | Entrée | Sortie |
| :--- | :--- | :--- | :--- |
| POST | `/predictions` | `{ site_id, horizon_hours }` | `Prediction` |
| GET | `/health` | | `{ status, model_version }` |

**L'intervalle de confiance est obligatoire**, c'est le deuxième critère de #38 et le troisième de #97 : l'interface doit le représenter, pas seulement la valeur centrale. Une valeur sans intervalle est une affirmation ; avec l'intervalle, le lecteur juge de ce qu'il peut en faire.

`granularity` **n'est pas une entrée**, elle est dans la réponse : le modèle dit à quel pas il a travaillé. Un paramètre d'entrée qui n'accepte qu'une valeur ment au consommateur et n'est jamais testé. Le jour où le modèle sait produire un autre pas, l'ajouter en entrée ne casse rien.

Le service ML **n'a aucune notion d'utilisateur** : l'autorisation est résolue avant l'appel.

---

## 5. ETL vers les fichiers Parquet

L'ETL **écrit des fichiers**, il n'appelle aucune route. Le répertoire est monté en écriture.

- Deux sous-répertoires : le répertoire **exposé** (séries nettoyées, lues par l'applicatif) et le répertoire d'**entraînement** (lu par le service ML).
- Partition par `site_id`, puis par période. La granularité temporelle reste ouverte dans #26.
- Écriture **atomique** : fichier temporaire, puis renommage. Un Parquet porte son index en pied de page et reste illisible tant qu'il n'est pas complet.
- Schéma **déclaré dans un module unique**, l'écriture caste dessus. Voir [`data.md`](./data.md).

L'ETL est un travailleur planifié, pas un serveur : son état de santé se vérifie par un contrôle de santé Docker sur une commande, pas par une route HTTP.

## 6. ETL vers API Mock

Extraction. Base : `MOCK_API_URL`. `GET /api/v1/sites` pour le référentiel, `/api/v1/sites/{id}/current` et l'historique pour les mesures. Sur échec de la source, l'ETL réessaie et journalise ; il n'écrit pas de fichier partiel.

## 7. ML vers les fichiers Parquet

Le service ML lit le répertoire d'entraînement avec **pandas**, pas avec DuckDB et pas par une route.

```python
df = pd.read_parquet(f"{PARQUET_DIR_ENTRAINEMENT}/site_id={site_id}",
                     columns=["horodatage", "consommation_kw"])
```

`read_parquet` lit un répertoire partitionné entier et reconsolide les morceaux : c'est la réponse à l'objection « je vais demander six mois et les fichiers sont découpés ». `columns` et `filters` évitent de charger ce dont on n'a pas besoin.

---

## 8. Schémas partagés

### `Site`

```json
{
  "site_id": "SITE001",
  "site_type": "office",
  "site_name": "Bureau Paris La Défense",
  "location": "Paris, France",
  "capacity_kw": 200,
  "status": "active",
  "alert_threshold_kw": 160,
  "present_in_source": true
}
```

Les six premiers champs viennent de la source et sont ceux que #21 exige de conserver. Les deux derniers sont à nous.

### `EnergyReading`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | datetime | ISO 8601, UTC |
| `site_id` | string | `SITE001` à `SITE007` |
| `site_type` | string | `office`, `factory`, `datacenter`, `hospital`, `retail`, `warehouse`, `campus` |
| `consumption_kw` | float, nullable | Puissance instantanée |
| `consumption_kwh` | float, nullable | Énergie sur la période |
| `voltage_v` | float, nullable | Tension |
| `current_a` | float, nullable | Intensité |
| `power_factor` | float, nullable | Facteur de puissance |
| `temperature_celsius` | float, nullable | Température extérieure |
| `humidity_percent` | float, nullable | Humidité relative |
| `null_reasons` | string[] | Causes des valeurs manquantes |
| `data_quality` | string | `good`, `partial`, `degraded`, `critical` |

**Les `null` sont normaux dans une réponse 200.** `null_reasons` dit pourquoi, `data_quality` résume. L'applicatif propage les deux jusqu'à l'écran : c'est le critère de #33.

### `Alert`

```json
{
  "alert_id": "ALR-SITE002-1718458320",
  "timestamp": "2026-06-15T14:12:00Z",
  "site_id": "SITE002",
  "severity": "low | medium | high | critical",
  "type": "spike | threshold | anomaly | outage | sensor",
  "message": "Risque de surcharge sur Usine Lyon Vénissieux",
  "value": 812.5,
  "threshold": 720.0
}
```

Une `severity` inconnue ne doit pas casser l'affichage : quatrième critère de #34.

### `ParkSummary`

```json
{
  "timestamp": "2026-06-15T14:32:00Z",
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

Les sites dont la mesure est absente sont **exclus des totaux et nommés** dans `excluded_sites`. Les deux ensemble, sinon le total est faux sans le dire : c'est le troisième critère de #30 et toute la raison d'être de #33.

### `Prediction`

```json
{
  "site_id": "SITE001",
  "predicted_at": "2026-09-15T10:00:00Z",
  "horizon_hours": 24,
  "granularity": "hour",
  "model_version": "3",
  "confidence_level": 0.95,
  "predictions": [
    {
      "timestamp": "2026-09-15T11:00:00Z",
      "predicted_consumption_kw": 92.5,
      "confidence_lower": 85.0,
      "confidence_upper": 100.0
    }
  ]
}
```

`model_version` est l'identifiant du registre MLflow de #37, pour que le jury puisse le rapprocher du registre : deuxième critère de #97.

### `Recommendation`

```json
{
  "recommendation_id": "REC-SITE001-1718458320",
  "site_id": "SITE001",
  "source": "threshold | forecast",
  "type": "scheduling | load_balancing | maintenance | efficiency",
  "priority": "low | medium | high",
  "title": "Décaler la climatisation en heures creuses",
  "description": "Le site est à 92 % de sa capacité souscrite.",
  "trigger": { "timestamp": "2026-09-15T14:00:00Z", "value_kw": 184.0, "threshold_kw": 160 },
  "estimated_saving_kwh": 150.0
}
```

`trigger` porte la mesure qui a déclenché la recommandation : troisième critère de #43.

`source` distingue les deux origines. **`threshold` est la voie principale**, calculée par l'applicatif à partir du seuil en base et de la mesure courante, sans aucune dépendance au modèle : c'est l'objet de #43, « garantir que la fonctionnalité existe même si l'épique Prédiction déborde ». `forecast` vient de la prévision (#44) et s'ajoute quand le modèle répond.

---

## 9. Dégradation

| Dépendance | Critique | Comportement si indisponible |
| :--- | :--- | :--- |
| PostgreSQL | oui | `503` sur les routes authentifiées, `/api/health` dit `"db": "unavailable"` |
| API Mock | oui | trois tentatives, puis `503` sur le temps réel et bandeau à l'écran. L'historique reste servi |
| Répertoire Parquet | non | historique indisponible, le temps réel fonctionne |
| Service ML | non | `{ available: false, reason }`, l'écran affiche le réel et dit que la prévision manque. Les recommandations de seuil continuent |

Le tableau de bord ne doit **jamais** tomber parce que le service ML est absent : c'est le quatrième critère de #97 et le troisième de #44.

---

## 10. Variables d'environnement

Deux nommages coexistent, et c'est **volontaire** : `.env.example` porte des noms neutres, partagés par les trois services, et la composition les transmet à chaque conteneur sous le nom qu'il attend. Nuxt, lui, ne lit que des variables préfixées `NUXT_`, une par clé de son `runtimeConfig`.

C'est la correspondance qui manquait, et son absence est la raison pour laquelle aucune variable de `.env.example` n'atteignait l'applicatif.

| `.env.example` | Conteneur | Nom dans le conteneur | Clé `runtimeConfig` |
| :--- | :--- | :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | applicatif | `NUXT_DATABASE_URL`, composée | `databaseUrl` |
| `SESSION_SECRET` | applicatif | `NUXT_SESSION_SECRET` | `sessionSecret` |
| `MOCK_API_URL` | applicatif, ETL | `NUXT_MOCK_API_URL` / `MOCK_API_URL` | `mockApiUrl` |
| `PARQUET_DIR_EXPOSE` | applicatif, ETL | `NUXT_PARQUET_DIR_EXPOSE` / `PARQUET_DIR_EXPOSE` | `parquetDirExpose` |
| `PARQUET_DIR_ENTRAINEMENT` | ETL, ML | `PARQUET_DIR_ENTRAINEMENT` | sans objet |
| `ML_API_URL` | applicatif | `NUXT_ML_API_URL` | `mlApiUrl` |
| `LOG_LEVEL` | tous | `NUXT_LOG_LEVEL` / `LOG_LEVEL` | `logLevel` |

Exemple du côté de la composition :

```yaml
dashboard:
  environment:
    NUXT_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    NUXT_SESSION_SECRET: ${SESSION_SECRET:?}
    NUXT_MOCK_API_URL: ${MOCK_API_URL:?}
    NUXT_PARQUET_DIR_EXPOSE: /data/expose
    NUXT_ML_API_URL: ${ML_API_URL:-http://ml:8000}
```

**Trois écarts restent à corriger dans le code**, tous introduits par le scaffold de #110 :

- `runtimeConfig` déclare `dataServiceUrl`, une URL vers un service qui n'existe pas. Il doit devenir `parquetDirExpose`, un chemin. En l'état, **l'applicatif ne sait pas où sont les fichiers Parquet**.
- `runtimeConfig` déclare `mlServiceUrl` quand `.env.example` et la composition disent `ML_API_URL`.
- `SESSION_SECRET` n'est pas dans `.env.example`.

Le port du service ML reste `8000`, comme déjà écrit dans la composition, à confirmer avec #117.

Aucun secret en clair dans un fichier versionné : ils passent par SOPS et age (#52).

---

## 11. Ce qui a été écarté, et pourquoi

**Le service Data Parquet.** Deux des trois propositions le faisaient revenir : une API HTTP sur le port 8001 avec une variable `DATA_SERVICE_URL` d'un côté, `POST /readings`, `GET /datasets/training` et un `/health` de l'autre. Il n'existe pas, et c'est la quatrième et la cinquième fois qu'il est proposé en trois jours. Il n'y a ni conteneur, ni port, ni route devant les fichiers : l'ETL écrit dans un répertoire monté, l'applicatif et le service ML le lisent. Écrit ainsi dans `architecture.md`, section « Points tranchés depuis ».

**Les routes en français et la notion d'entreprise.** `/entreprises/{id}/sites`, `/consommation/{siteId}`, `/alertes` : le MVP sert un client pilote, la dimension de cloisonnement est le site, et mélanger des routes françaises avec des champs anglais ne rend service à personne.

**`granularity` en entrée de la prédiction.** Gardée en sortie. Voir section 4.

**« Recommandations statiques de repli ».** Les recommandations de seuil ne sont pas un repli du service ML, elles sont la voie principale et elles ont leur propre ticket, #43.

**`GET /health` sur l'ETL.** Un travailleur planifié n'a pas besoin d'embarquer un serveur HTTP pour dire qu'il est vivant.

---

## 12. Ce qui reste ouvert

- La **granularité temporelle** de la partition Parquet, dans #26. Elle ne change aucun contrat de ce document, seulement le nombre de fichiers qu'une requête ouvre.
- Les **variables d'entrée** de la prédiction au-delà du site et de l'horizon. Le daily du J2 a laissé la question des caractéristiques météo sans conclusion. Le corps du `POST` est fait pour grandir.
- **#44** n'est assigné à personne, donc `source: "forecast"` n'a pas de porteur.

---

## Journal

| Date | Changement |
| :--- | :--- |
| 15 septembre 2026 | Première version, croisement des trois propositions. |
| 15 septembre 2026 | `snake_case` fixé sur le fil, les entrées suivent. Variables d'environnement réconciliées avec `.env.example` et le `runtimeConfig`. `ML_SERVICE_URL` devient `ML_API_URL`, port 8000. |

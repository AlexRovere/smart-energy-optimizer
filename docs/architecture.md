# Architecture EnerVision

Référence commune de l'équipe, figée le **lundi 14 septembre 2026** lors de la séance de cadrage du J1 (issue #98), à partir des cinq dossiers de conception individuels.

**Ce fichier est la source de vérité de l'architecture**, et il n'en existe pas de seconde : toute autre copie est un export, jamais l'original. Toute évolution s'y écrit le jour où elle est décidée, avec sa raison, et la section « Points tranchés depuis » garde la trace de ce qui a changé, parce qu'une décision effacée est une décision qui se rediscute. Les décisions datées vivent aussi dans Supervisor, écran Décisions ; les tickets qui les réalisent vivent dans le projet GitHub.

## Principes retenus

1. **Tout est hébergé sur la VM on-premise.** Aucune donnée d'exploitation ne sort. L'hybride a été écarté explicitement.
2. **Tout est conteneurisé**, pour qu'une brique puisse basculer vers un fournisseur cloud plus tard sans réécriture.
3. **Un seul point d'entrée public**, le reverse proxy. Aucun autre service n'est joignable de l'extérieur.
4. **L'autorisation vit dans l'applicatif.** L'ETL et le ML n'ont aucune notion d'utilisateur.
5. **Une seule écriture de la donnée transformée**, lue par deux consommateurs. Pas de duplication.
6. **Le plus simple qui fonctionne.** Ce qui n'est pas nécessaire au MVP est documenté comme évolution, pas construit.

## Vue d'ensemble

```mermaid
flowchart TB
    U["Navigateur"] --> RP["Reverse proxy<br/>TLS, 443"]
    RP --> APP["Applicatif Nuxt<br/>BFF + dashboard"]
    APP --> PG[("PostgreSQL<br/>comptes, roles, referentiel des sites")]
    APP --> ML["Service ML<br/>MLflow + FastAPI"]
    MOCK["API Mock IoT"] --> ETL["Service ETL"]
    subgraph VOL["Volume de donnees Parquet"]
        BEX[("dossier expose")]
        BML[("dossier entrainement")]
    end
    ETL -->|ecriture| BEX
    ETL -->|ecriture| BML
    APP -->|montage lecture seule, DuckDB| BEX
    ML -->|montage lecture seule, DuckDB| BML
```

## Les briques

| Brique | Techno | Responsabilité | Exposition |
|---|---|---|---|
| Reverse proxy | à définir | Terminaison TLS, porte d'entrée unique, en-têtes de sécurité, limitation de débit | Public, 443 |
| Applicatif | Nuxt, Vue 3, TypeScript | Dashboard, BFF, authentification, autorisation, règles métier, recommandations. Architecture en couches en interne | Réseau interne |
| ETL | Python | Extraction depuis l'API Mock, nettoyage, transformation, écriture Parquet | Réseau interne |
| ML | Python, MLflow, FastAPI | Entraînement, registre de modèles, endpoint de prédiction | Réseau interne |
| Base relationnelle | PostgreSQL | Comptes, rôles, référentiel des sites et leurs réglages. Rien d'autre | Réseau interne |
| Volume de données | Fichiers Parquet | Deux répertoires : séries exposées, jeux d'entraînement | Montages |

## Données

**Format.** Fichiers Parquet partitionnés par site, puis par période. Interrogés en SQL par **DuckDB**, embarqué chez le consommateur, sans serveur.

**Deux répertoires, deux usages.** Le répertoire exposé alimente le dashboard, celui d'entraînement alimente le modèle. L'ETL est le seul à écrire ; chaque consommateur ne monte que son répertoire, en lecture seule. Un composant ne peut pas lire ce qui n'est pas monté dans son conteneur.

**Qualité.** Les mesures sont stockées telles que l'API Mock les renvoie, avec leurs indicateurs de qualité, et jamais filtrées. Valeur brute et valeur imputée restent distinctes. Un agrégat qui exclut des sites le signale à l'écran.

**Traçabilité du modèle.** Assurée par **MLflow seul**, sans second outil. Chaque exécution d'entraînement enregistre ses paramètres, ses métriques et la **fenêtre temporelle** du jeu utilisé. Cela suffit à rattacher un modèle à l'état exact des données qui l'a produit, parce que l'ETL écrit de façon incrémentale et ne réécrit jamais une période déjà close : une fenêtre de dates désigne donc toujours le même contenu. Aucune donnée n'est dupliquée pour être versionnée.

**Données personnelles.** Les mesures de consommation sont des données d'entreprise. Les seules données personnelles sont les comptes utilisateurs, qui vivent dans PostgreSQL et ne quittent jamais la machine.

## Flux

```mermaid
flowchart LR
    MOCK["API Mock IoT"] -->|extraction| T["Transformation<br/>qualite conservee"]
    T -->|ecriture| BEX[("dossier expose<br/>series par site")]
    T -->|ecriture| BML[("dossier entrainement<br/>jeux et variables")]
    BEX -->|DuckDB, filtre sur les sites autorises| APP["BFF, dashboard"]
    BML -->|DuckDB| ML["Entrainement, MLflow"]
    ML -->|modele promu| PRED["Endpoint de prediction"]
    APP -->|horizon et site| PRED
    PRED -->|valeur et intervalle| APP
```

## Sécurité

- **Un seul port public**, le 443 sur le reverse proxy. Aucun port des services internes n'est publié sur l'hôte.
- **Session** : cookie httpOnly, Secure, SameSite. Le jeton n'est jamais lisible par un script.
- **Cloisonnement par site** : le rôle et la liste des sites autorisés sont résolus côté serveur, à partir de la session, et **injectés** dans la requête de données. Un identifiant de site reçu du client est comparé au périmètre autorisé, il ne sert jamais de source. Une seule fonction rend cette liste et le filtre est toujours appliqué, y compris pour un administrateur, à qui elle rend la liste complète.
- **Rôles** : la table existe et le mécanisme est en place, mais **un seul rôle est exploité au MVP**, l'administrateur. Les rôles restreints sont montrés à l'oral, pas construits.
- **Secrets** : SOPS et age pour ce qui est versionné, chaque membre et la CI ayant sa clé ; secrets de la forge pour la CI. Une procédure écrite permet à chacun de chiffrer et déchiffrer sans assistance.
- **Machine** : accès SSH par clé, compte mutualisé donc aucun secret en clair déposé et **aucun commit depuis la VM**, l'historique devant rester nominatif.

## Dépôt et conventions

**Monorepo.** Un répertoire par service applicatif, chacun avec son fichier Docker et sa documentation ; une composition à la racine ; un répertoire d'infrastructure (Ansible) ; un répertoire de workflows d'intégration continue.

**Branches.** Une seule branche durable. Une branche par ticket, nommée selon la convention imposée, créée depuis la carte du Kanban. Une tâche tient dans la journée.

**Revue.** Chaque domaine a un relecteur désigné, responsable de son périmètre ; un second relecteur est facultatif. C'est aussi le mécanisme de partage de compétences de l'équipe.

**Intégration continue.** Lint, tests, scan de sécurité (Trivy sur les dépendances, les images et les secrets, bloquant), construction des images. **Le déploiement est déclenché explicitement**, uniquement depuis la branche principale et seulement si tout ce qui précède est vert.

**Exploitation.** Rien n'est modifié à la main sur la VM : le pipeline est le seul chemin. On développe sur son poste, la machine ne reçoit que ce qui vient du pipeline. L'exception admise est l'exploitation (lancer, lire des logs, diagnostiquer), jamais l'édition de code.

**Documentation.** Ce fichier pour la vue d'ensemble, un document par service pour ses endpoints, ses variables d'environnement et son démarrage. Diagrammes en Mermaid dans les fichiers, jamais en image collée : ils doivent rester corrigeables jusqu'à la soutenance.

## Hors périmètre du MVP, documenté comme évolution

| Sujet | Raison du report |
|---|---|
| Stockage objet local compatible S3 | Un service permanent de plus, non justifié à cette volumétrie. DuckDB lit un chemin local et une adresse d'objet de la même façon : la bascule est un changement de chaîne de connexion. |
| Distribution du calcul (Ray) | Sept sites et quelques dizaines de mégaoctets ne donnent rien à distribuer. Les traitements sont écrits sans état partagé pour que la bascule reste possible. |
| Terraform | Pas d'API de fournisseur à piloter sur une VM unique. Ansible couvre le besoin réel, la configuration de la machine. |
| Kubeflow | Même logique que Terraform, côté chaîne ML. MLflow suffit au MVP. |
| **Plusieurs entreprises clientes** | Le MVP sert un client pilote. Les sites portent le cloisonnement, ce qui suffit à le démontrer ; une table entreprise serait une dimension sans données, la source n'en fournissant aucune. |
| **DVC** | MLflow versionne déjà modèles, paramètres et métriques, et la fenêtre temporelle du jeu suffit à identifier les données, l'ETL étant incrémental. Un second outil de versionnement pour une propriété déjà tenue. |
| **Rôles restreints exploités** | Le mécanisme et la table existent ; les distinguer dans l'interface multiplierait les cas de test des règles métier sans rien ajouter à la démonstration. |

## Points ouverts

1. **Reverse proxy** : acté, mais absent du schéma proposé en séance. À harmoniser.
2. **Contrats d'interface** des trois services : séance prévue au J2, avant tout développement parallèle.
3. **Protection de la branche principale** : impossible tant que le dépôt est privé sur une organisation en offre gratuite. Décision à prendre sur le passage en public.
4. **Supervision** : Prometheus et Grafana prévus, pas encore positionnés dans le schéma.

## Points tranchés depuis

**Accès aux données : montages, et non service.** Tranché le mardi 15 septembre 2026. Le schéma proposé en séance de cadrage faisait des fichiers Parquet un service interrogé par les autres briques ; c'est la lecture directe qui l'emporte. DuckDB est embarqué chez chaque consommateur et lit les fichiers d'un volume Docker partagé, que l'ETL est seul à monter en écriture.

Les raisons : un service de plus à construire et à maintenir dans un MVP de dix jours ; un service ML qui récupérerait ses jeux d'entraînement par HTTP, cas où une API coûte sans rien apporter puisque DuckDB lit le fichier sans copie ; et surtout un cloisonnement qui redeviendrait du code applicatif au lieu de tenir dans les montages du fichier de composition, donc vérifiable sans lire une ligne de programme.

**Un seul client, cloisonnement par site.** Tranché le mardi 15 septembre 2026, au daily. Le MVP sert un client pilote : il n'y a pas de table entreprise, et la dimension de cloisonnement est le site. Les fichiers Parquet sont partitionnés par site, et le périmètre d'un compte est une liste de sites.

Le motif est qu'une table entreprise serait une dimension sans données : l'API Mock ne renvoie que des sites, et toute correspondance site vers entreprise serait inventée. Le cloisonnement se démontre aussi bien sur des sites, et il se teste avec moins de cas.

**Rôles : le mécanisme, pas les profils.** Tranché le même jour. La table des rôles et la résolution côté serveur existent, mais un seul rôle est exploité au MVP. Les profils restreints se montrent à l'oral et se lisent dans les tests, plutôt que de multiplier les règles métier à vérifier en deux semaines.

**DVC écarté.** Tranché le même jour. Voir la table du hors périmètre ci-dessus : MLflow tient déjà la propriété recherchée.

## Où trouver le reste

Ici, dans ce dépôt :

- `data.md` : le modèle relationnel et le contrat des fichiers Parquet. **Arrive séparément**, le schéma relationnel demandant encore un tour de relecture ; l'index de `docs/` l'annonce déjà.
- [`README.md`](./README.md) : ce que contient chaque document et pour quelle épreuve.
- Le document de chaque service, dans `apps/<service>/README.md` : ses entrées, ses sorties, son démarrage.

Dans le dépôt de pilotage (Supervisor), qui n'est pas celui-ci :

- `docs/ligne-de-coupe.md` : le socle, le hors périmètre et les règles des dix jours.
- `docs/couverture-backlog.md` : quel critère d'évaluation est porté par quelle issue.
- `docs/kpi-pilotage.md` : les six indicateurs suivis chaque soir.
- `docs/routine-equipe.md` : ce que chaque membre fait chaque jour.
- `docs/EADL-synthese.md` : les consignes, le calendrier des rendus, l'API Mock.

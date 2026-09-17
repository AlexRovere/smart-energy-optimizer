# Smart Energy Optimizer

MVP d'optimisation énergétique par l'IA, pour EnerVision. Projet piscine EADL, 2 semaines, 5 personnes.

Collecter les données de consommation de sites industriels, anticiper les pics via un modèle prédictif, recommander des actions correctives, et exposer le tout par une API sécurisée et un tableau de bord.

## Structure

Monorepo. La structure du dépôt n'est pas l'architecture de déploiement : les trois applications ci-dessous restent des conteneurs séparés, tous déployés sur la même machine sur site, l'architecture hybride ayant été écartée lors de la séance de cadrage du J1.

| Chemin               | Rôle                                                                     | Domaine                      |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `apps/dashboard/`    | BFF Nuxt : API de restitution et tableau de bord                         | `domain:front`, `domain:api` |
| `apps/etl/`          | Ingestion Python des capteurs simulés vers les fichiers Parquet          | `domain:data`                |
| `apps/ml/`           | Service de prédiction (FastAPI, Prophet, MLflow)                         | `domain:ml`                  |
| `infra/ansible/`     | Configuration de la machine sur site, rejouable                          | `domain:cloud`               |
| `.github/workflows/` | Pipeline build, test, scan, deploy                                       | `domain:cicd`                |
| `docs/`              | Livrables et documentation technique                                     | `domain:doc`                 |
| `docker-compose.yml` | La pile complète, à la racine pour un `docker compose up` direct         | `domain:cloud`               |
| `docker-compose.dev.yml` | Le seul PostgreSQL, pour la boucle de développement locale           | `domain:cloud`               |

## Démarrage

Deux façons de lancer le projet, qui ne servent pas la même chose et ne partagent
aucun fichier de valeurs.

### Développer

Un PostgreSQL dans Docker, l'applicatif sur le poste avec rechargement à chaud.
Prérequis : Docker et Node 22 ou plus. `pnpm` passe par corepack, il n'a pas à
être installé.

```bash
corepack pnpm@10.11.0 --dir apps/dashboard install
corepack pnpm@10.11.0 --dir apps/dashboard dev:db   # base, migrations, amorçage
corepack pnpm@10.11.0 --dir apps/dashboard dev      # http://localhost:3000
```

**Rien à copier, rien à renseigner** : les valeurs de la boucle locale vivent
dans [`.env.dev`](./.env.dev), versionné parce qu'il ne contient aucun secret.
Depuis `apps/dashboard/`, les mêmes commandes s'écrivent `pnpm install`,
`pnpm dev:db`, `pnpm dev`.

La connexion se fait avec `admin@enervision.local` et le `SEED_PASSWORD` de
`.env.dev`. Deux autres comptes existent, `operator@` et `viewer@`.

`pnpm dev:db` est rejouable : un second passage ne casse rien.
`pnpm dev:db:stop` arrête la base et libère le port, `pnpm dev:db:reset` jette
en plus le volume et rend une base vide au passage suivant.

La version longue des commandes est dans le [README du
dashboard](./apps/dashboard/README.md).

### Déployer

La pile complète, qui construit ses images et exige toutes ses variables. Rien
ne démarre sur une valeur oubliée, c'est voulu.

```bash
cp .env.example .env      # renseigner les valeurs
docker compose up -d      # la pile complète
docker compose ps
```

Sur la machine sur site, c'est le pipeline qui joue cette commande, les valeurs
venant de `sops exec-env` et non d'un `.env`. Voir [`docs/secrets.md`](./docs/secrets.md).

Chaque application a son propre README avec ses prérequis.

## Conventions

**Branches.** Le type de l'issue donne le préfixe :

| Type d'issue | Préfixe |
| ------------ | ------- |
| Feature      | `feat`  |
| Bug          | `fix`   |
| Task         | `chore` |
| Docs         | `docs`  |
| Spike        | `spike` |

Nommage complet : `EADL_2025_NANTES_G1/<préfixe>-<numéro issue>-<slug>`.
Exemple : `EADL_2025_NANTES_G1/feat-18-ingestion-etl`.

> L'année est **2025**, comme le nom de la machine fournie par le formateur et le document de consignes. À ne pas confondre avec `EADL-2026`, qui est le nom de l'organisation GitHub.

**Commits.** Même préfixe que la branche, en conventional commits : `feat(etl): ...`, `fix(ml): ...`.

**Pull requests.** Une seule branche durable, `main`. Sa protection par règle n'est pas activable tant que le dépôt est privé sur une organisation en offre gratuite (point ouvert de la séance de cadrage) : la revue tient donc par convention, pas par contrainte technique. Toute évolution passe par une PR avec revue. Le fichier `.github/CODEOWNERS` route automatiquement la revue vers le propriétaire du répertoire touché.

**Labels.** `domain:*` qualifie la zone du système, le type d'issue qualifie la nature du travail. Les deux sont indépendants.

## Secrets

Aucun secret en clair dans le dépôt. Les secrets applicatifs sont chiffrés au repos avec SOPS et age (`secrets.enc.yaml`), les secrets de la CI vivent dans GitHub Secrets.

La procédure complète est dans [`docs/secrets.md`](./docs/secrets.md) : installer les outils, générer sa clé, se faire ajouter comme destinataire, lire et modifier une valeur. Elle est à suivre avant de toucher à `secrets.enc.yaml`, l'ajout d'un destinataire et le rechiffrement du fichier allant ensemble sous peine de voir la CI refuser la pull request.

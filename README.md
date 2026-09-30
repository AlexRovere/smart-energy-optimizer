# Smart Energy Optimizer

[![CI](https://github.com/AlexRovere/smart-energy-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexRovere/smart-energy-optimizer/actions/workflows/ci.yml) [![Sécurité](https://github.com/AlexRovere/smart-energy-optimizer/actions/workflows/security.yml/badge.svg)](https://github.com/AlexRovere/smart-energy-optimizer/actions/workflows/security.yml) [![Couverture](https://sonarcloud.io/api/project_badges/measure?project=AlexRovere_smart-energy-optimizer&metric=coverage)](https://sonarcloud.io/summary/overall?id=AlexRovere_smart-energy-optimizer) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=AlexRovere_smart-energy-optimizer&metric=alert_status)](https://sonarcloud.io/summary/overall?id=AlexRovere_smart-energy-optimizer)

MVP d'optimisation énergétique par l'IA, pour EnerVision. Projet piscine EADL, 2 semaines, 5 personnes.

> **Reprise du projet.** Livré en `v1.0.0` par l'équipe EADL Nantes G1 (Alex Rovere, Antoine Coulon, Hugo Mrnth, Tanguy Raguenes, Pierrick Anceaux) dans le dépôt de l'école, `EADL-2026/enerVision`. Depuis le 29 septembre 2026, Alex Rovere le poursuit seul ici, historique complet conservé. Les issues ouvertes ont été reprises avec de nouveaux numéros, chacune renvoyant à son original. L'infrastructure de l'école (VM, runner auto-hébergé) n'est plus utilisée et doit laisser place à Kubernetes ; en attendant, le déploiement continu est suspendu.

Collecter les données de consommation de sites industriels, anticiper les pics via un modèle prédictif, recommander des actions correctives, et exposer le tout par une API sécurisée et un tableau de bord.

## Structure

Monorepo. La structure du dépôt n'est pas l'architecture de déploiement : les trois applications ci-dessous restent des conteneurs séparés, tous déployés sur la même machine sur site, l'architecture hybride ayant été écartée lors de la séance de cadrage du J1.

| Chemin               | Rôle                                                                     | Domaine                      |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `apps/dashboard/`    | BFF Nuxt : API de restitution et tableau de bord                         | `domain:front`, `domain:api` |
| `apps/etl/`          | Ingestion Python des capteurs simulés vers les fichiers Parquet          | `domain:data`                |
| `apps/ml/`           | Service de prédiction (FastAPI, Prophet, MLflow)                         | `domain:ml`                  |
| `apps/mock-api/`     | Simulateur de l'API Mock : même contrat, données déterministes           | `domain:data`                |
| `infra/ansible/`     | Configuration de la machine sur site, rejouable                          | `domain:cloud`               |
| `infra/grafana/`      | Supervision : source de données et tableaux, provisionnés depuis le dépôt   | `domain:cloud`               |
| `.github/workflows/` | Pipeline build, test, scan, deploy                                       | `domain:cicd`                |
| `docs/`              | Livrables et documentation technique                                     | `domain:doc`                 |
| `DEPLOIEMENT.md`     | Procédure pas à pas de préparation de la VM, Ansible et runner GitHub    | `domain:cloud`, `domain:cicd` |
| `docker-compose.yml` | La pile complète, à la racine pour un `docker compose up` direct         | `domain:cloud`               |
| `docker-compose.dev.yml` | Le seul PostgreSQL, pour la boucle de développement locale           | `domain:cloud`               |

## Démarrage

Deux façons de lancer le projet, qui ne servent pas la même chose et ne partagent
aucun fichier de valeurs.

### Développer

Toute la pile sur le poste, avec des données fictives : le simulateur de l'API
Mock ([`apps/mock-api`](./apps/mock-api/README.md)), PostgreSQL migré et amorcé,
l'ETL réel qui écrit un an d'historique Parquet puis le tient à jour d'heure en
heure, le ML entraîné sur cet historique, et le dashboard. Aucun secret, aucun
appel vers l'extérieur. Prérequis : Docker et Node 22 ou plus.

```bash
node scripts/dev-stack.mjs up        # http://localhost:3000, quelques minutes la première fois
node scripts/dev-stack.mjs down      # arrête, garde les données
node scripts/dev-stack.mjs reset     # repart de zéro
```

Connexion avec `admin@enervision.local` et le `SEED_PASSWORD` de
[`dev.env`](./dev.env). Deux autres comptes existent, `operator@` et `viewer@`.
Le cookie de session est `Secure` : Chrome, Edge et Firefox l'acceptent sur
`http://localhost`, pas Safari.

**Travailler sur le dashboard**, avec le rechargement à chaud : démarrer la pile
sans lui, puis Nuxt sur le poste, branché sur le reste.

```bash
node scripts/dev-stack.mjs up --without-dashboard
corepack pnpm@10.11.0 --dir apps/dashboard install
corepack pnpm@10.11.0 --dir apps/dashboard dev
```

Dans ce mode, l'historique fictif est écrit dans `data/parquet-dev`, que Nuxt
lit depuis le poste, et non dans le volume nommé de la pile complète : il est
amorcé une seconde fois au premier passage (trois minutes sous Windows). Le ML
y relit aussi l'historique à travers le montage : sous Windows, une prédiction
prend alors une minute et demie contre moins d'une seconde dans le volume, et
les écrans qui en dépendent se replient sur les seules recommandations à seuil.

Depuis `apps/dashboard/`, les mêmes commandes s'écrivent `pnpm dev:stack`,
`pnpm dev:stack:backend`, `pnpm dev:stack:stop`, `pnpm dev:stack:reset` et
`pnpm dev`.

**Rien à copier, rien à renseigner** : les valeurs vivent dans
[`dev.env`](./dev.env), versionné parce qu'il ne contient aucun secret. Une
surcharge propre au poste va dans `.env.local`, ignoré par git, qui l'emporte :
par exemple `POSTGRES_PUBLISHED_PORT` et `NUXT_DATABASE_URL` si le port 55432
est déjà pris. La pile de développement est une surcharge de
[`docker-compose.yml`](./docker-compose.yml) par
[`docker-compose.dev.yml`](./docker-compose.dev.yml) : les services ne sont
décrits qu'une fois.

### Déployer

La procédure complète de la VM, depuis les répertoires et la clé age jusqu'au
runner GitHub et à la CD automatique, est détaillée dans
[`DEPLOIEMENT.md`](./DEPLOIEMENT.md).

La pile complète, qui construit ses images. Les réglages ont leurs défauts dans
la composition, les secrets n'en ont aucun : rien ne démarre sur un secret
oublié, c'est voulu.

```bash
cp .env.example .env      # renseigner les secrets, et eux seuls
docker compose build etl ml dashboard migrate
docker compose up -d --wait postgres
docker compose run --rm migrate
docker compose run --rm seed
docker compose up -d --wait
docker compose ps
```

**La même pile sur son poste, sans écrire un seul secret dans un fichier** :
`sops exec-env` les fournit, et les réglages ont leurs défauts dans la
composition. Il n'y a donc **rien à copier**, le `.env` n'est utile que pour
surcharger un réglage.

```bash
sops exec-env secrets.enc.yaml 'docker compose build etl ml dashboard migrate'
sops exec-env secrets.enc.yaml 'docker compose up -d --wait postgres'
sops exec-env secrets.enc.yaml 'docker compose run --rm migrate'
sops exec-env secrets.enc.yaml 'docker compose run --rm seed'
sops exec-env secrets.enc.yaml 'docker compose up -d --wait'
```

L'environnement prime sur le `.env`, donc les valeurs déchiffrées l'emportent
sur ce que le fichier contiendrait. C'est la raison pour laquelle
`secrets.enc.yaml` ne porte **que** des secrets : un réglage qui s'y glisse ne
peut plus être surchargé localement, et rien ne le signale (#197). Sur la VM, le
playbook
[`infra/ansible/playbook.yml`](./infra/ansible/playbook.yml) construit les
images, applique les migrations puis démarre la pile avec ce même mécanisme. Il
demande que la machine soit destinataire des secrets :
[`docs/secrets.md`](./docs/secrets.md).

Cette pile et celle de développement cohabitent sans se gêner : ni le même port,
ni le même nom de projet Docker.

Deux choses à savoir avant d'essayer. Si un PostgreSQL est déjà installé en
service sur le poste, il tient 5432 et le lancement échoue sur `ports are not
available` : poser `POSTGRES_PUBLISHED_PORT=15432` dans le `.env` suffit. C'est
bien ce nom-là, et pas `POSTGRES_PORT`, qui reste le port joint à l'intérieur du
réseau Docker et n'a aucune raison de bouger. Et le dashboard ne publie aucun
port : il se parcourt sur <https://localhost>, par Caddy, avec l'avertissement de
certificat que produit sa CA interne ([`infra/caddy/README.md`](./infra/caddy/README.md)).
Pour développer, la boucle plus haut reste plus rapide.

**La supervision part avec la pile**, sans rien de plus à lancer : Grafana sur
<https://localhost:3001> (compte `admin`, mot de passe `GRAFANA_ADMIN_PASSWORD`), servi par
Caddy comme le dashboard, et Prometheus sur <http://127.0.0.1:9090>. Le tableau est déjà là, il est provisionné
depuis `infra/grafana/`. Les indicateurs et leur motif :
[`docs/supervision.md`](./docs/supervision.md).

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

Nommage complet : `<préfixe>-<numéro issue>-<slug>`.
Exemple : `fix-18-graphiques`.

Les branches de l'école portaient le préfixe `EADL_2025_NANTES_G1/`, abandonné avec la reprise.

**Commits.** Même préfixe que la branche, en conventional commits : `feat(etl): ...`, `fix(ml): ...`.

**Pull requests.** Une seule branche durable, `main`. Sa protection par règle n'est pas activable tant que le dépôt est privé sur une organisation en offre gratuite (point ouvert de la séance de cadrage) : la revue tient donc par convention, pas par contrainte technique. Toute évolution passe par une PR avec revue. Depuis la reprise en solo, `.github/CODEOWNERS` est retiré : la revue est une relecture de sa propre PR, CI verte et liste de vérification remplie, avant de fusionner.

**Labels.** `domain:*` qualifie la zone du système, le type d'issue qualifie la nature du travail. Les deux sont indépendants.

## Secrets

Aucun secret en clair dans le dépôt. Les secrets applicatifs sont chiffrés au repos avec SOPS et age (`secrets.enc.yaml`), les secrets de la CI vivent dans GitHub Secrets.

La procédure complète est dans [`docs/secrets.md`](./docs/secrets.md) : installer les outils, générer sa clé, se faire ajouter comme destinataire, lire et modifier une valeur. Elle est à suivre avant de toucher à `secrets.enc.yaml`, l'ajout d'un destinataire et le rechiffrement du fichier allant ensemble sous peine de voir la CI refuser la pull request.

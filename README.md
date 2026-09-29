# Smart Energy Optimizer

MVP d'optimisation énergétique par l'IA, pour EnerVision. Projet piscine EADL, 2 semaines, 5 personnes.

> **Reprise du projet.** Livré en `v1.0.0` par l'équipe EADL Nantes G1 (Alex Rovere, Antoine Coulon, Hugo Mrnth, Tanguy Raguenes, Pierrick Anceaux) dans le dépôt de l'école, `EADL-2026/enerVision`. Depuis le 29 septembre 2026, Alex Rovere le poursuit seul ici, historique complet conservé. Les issues ouvertes ont été reprises avec de nouveaux numéros, chacune renvoyant à son original. L'infrastructure de l'école (VM, runner auto-hébergé) n'est plus utilisée et doit laisser place à Kubernetes ; en attendant, la CI est réduite tant que le dépôt reste privé.

Collecter les données de consommation de sites industriels, anticiper les pics via un modèle prédictif, recommander des actions correctives, et exposer le tout par une API sécurisée et un tableau de bord.

## Structure

Monorepo. La structure du dépôt n'est pas l'architecture de déploiement : les trois applications ci-dessous restent des conteneurs séparés, tous déployés sur la même machine sur site, l'architecture hybride ayant été écartée lors de la séance de cadrage du J1.

| Chemin               | Rôle                                                                     | Domaine                      |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `apps/dashboard/`    | BFF Nuxt : API de restitution et tableau de bord                         | `domain:front`, `domain:api` |
| `apps/etl/`          | Ingestion Python des capteurs simulés vers les fichiers Parquet          | `domain:data`                |
| `apps/ml/`           | Service de prédiction (FastAPI, Prophet, MLflow)                         | `domain:ml`                  |
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

Nommage complet : `EADL_2025_NANTES_G1/<préfixe>-<numéro issue>-<slug>`.
Exemple : `EADL_2025_NANTES_G1/feat-18-ingestion-etl`.

> L'année est **2025**, comme le nom de la machine fournie par le formateur et le document de consignes. À ne pas confondre avec `EADL-2026`, qui est le nom de l'organisation GitHub.

**Commits.** Même préfixe que la branche, en conventional commits : `feat(etl): ...`, `fix(ml): ...`.

**Pull requests.** Une seule branche durable, `main`. Sa protection par règle n'est pas activable tant que le dépôt est privé sur une organisation en offre gratuite (point ouvert de la séance de cadrage) : la revue tient donc par convention, pas par contrainte technique. Toute évolution passe par une PR avec revue. Depuis la reprise en solo, `.github/CODEOWNERS` est retiré : la revue est une relecture de sa propre PR, CI verte et liste de vérification remplie, avant de fusionner.

**Labels.** `domain:*` qualifie la zone du système, le type d'issue qualifie la nature du travail. Les deux sont indépendants.

## Secrets

Aucun secret en clair dans le dépôt. Les secrets applicatifs sont chiffrés au repos avec SOPS et age (`secrets.enc.yaml`), les secrets de la CI vivent dans GitHub Secrets.

La procédure complète est dans [`docs/secrets.md`](./docs/secrets.md) : installer les outils, générer sa clé, se faire ajouter comme destinataire, lire et modifier une valeur. Elle est à suivre avant de toucher à `secrets.enc.yaml`, l'ajout d'un destinataire et le rechiffrement du fichier allant ensemble sous peine de voir la CI refuser la pull request.

# Smart Energy Optimizer

MVP cloud-native d'optimisation énergétique par l'IA, pour EnerVision. Projet piscine EADL, 2 semaines, 5 personnes.

Collecter les données de consommation de sites industriels, anticiper les pics via un modèle prédictif, recommander des actions correctives, et exposer le tout par une API sécurisée et un tableau de bord.

## Structure

Monorepo. La structure du dépôt n'est pas l'architecture de déploiement : les trois applications ci-dessous restent des conteneurs déployés séparément, dans deux zones de confiance (voir le dossier de conception).

| Chemin | Rôle | Domaine |
|---|---|---|
| `apps/dashboard/` | BFF Nuxt : API de restitution et tableau de bord | `domain:front`, `domain:api` |
| `apps/etl/` | Ingestion Python des capteurs simulés vers TimescaleDB | `domain:data` |
| `apps/ml/` | Service de prédiction (FastAPI, Prophet, MLflow) | `domain:ml` |
| `infra/terraform/` | Provisionnement de la zone AWS (S3, compute ML) | `domain:cloud` |
| `.github/workflows/` | Pipeline build, test, scan, deploy | `domain:cicd` |
| `docs/` | Livrables et documentation technique | `domain:doc` |
| `docker-compose.yml` | Pile on-premise complète, à la racine pour un `docker compose up` direct | `domain:cloud` |

## Démarrage

```bash
cp .env.example .env      # renseigner les valeurs
docker compose up -d      # pile on-premise
docker compose ps
```

Chaque application a son propre README avec ses prérequis.

## Conventions

**Branches.** Le type de l'issue donne le préfixe :

| Type d'issue | Préfixe |
|---|---|
| Feature | `feat` |
| Bug | `fix` |
| Task | `chore` |
| Docs | `docs` |
| Spike | `spike` |

Nommage complet : `EADL_2026_<VILLE>_G<N>/<préfixe>-<numéro issue>-<slug>`.
Exemple : `EADL_2026_RENNES_G2/feat-18-ingestion-etl`.

> À confirmer avec le formateur : le document de consignes indique `EADL_2025_`, l'organisation s'appelle `EADL-2026`.

**Commits.** Même préfixe que la branche, en conventional commits : `feat(etl): ...`, `fix(ml): ...`.

**Pull requests.** `main` est protégée. Toute évolution passe par une PR avec revue. Le fichier `.github/CODEOWNERS` route automatiquement la revue vers le propriétaire du répertoire touché.

**Labels.** `domain:*` qualifie la zone du système, le type d'issue qualifie la nature du travail. Les deux sont indépendants.

## Secrets

Aucun secret en clair dans le dépôt. Les secrets applicatifs sont chiffrés au repos avec SOPS et age (`secrets.enc.yaml`), les secrets de la CI vivent dans GitHub Secrets. Voir `docs/`.

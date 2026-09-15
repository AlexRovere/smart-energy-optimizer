# Repères pour travailler sur ce dépôt

Le [`README.md`](./README.md) porte la structure, les conventions de branches, de commits et de pull requests. Ce fichier ne les répète pas : il dit **où est la vérité** et **ce qui est déjà tranché**.

## Où est la vérité

| Question | Document |
| :--- | :--- |
| Quelles briques, quels flux, quelles frontières | [`docs/architecture.md`](./docs/architecture.md) |
| Schéma PostgreSQL, contrat des fichiers Parquet | [`docs/data.md`](./docs/data.md) |
| Routes, schémas de réponse, dégradation, variables | [`docs/api.md`](./docs/api.md) |
| Ce que chaque document couvre | [`docs/README.md`](./docs/README.md) |

Ces trois documents sont la référence commune. Une décision qui les contredit se **trace** : elle passe par une PR qui dit ce qui change et pourquoi, et le document concerné est mis à jour dans la même PR. Pas de décision qui vit seulement dans une discussion.

## Ce qui est déjà tranché

Ces points reviennent régulièrement. Ils ont été arbitrés, le motif est écrit dans le document indiqué, et les rouvrir demande une décision tracée, pas une reformulation.

- **Il n'y a pas de service Data Parquet.** Ni conteneur, ni port, ni route devant les fichiers. Un répertoire de la machine, monté en écriture chez l'ETL et en lecture seule chez les consommateurs. L'applicatif le lit avec DuckDB (`@duckdb/node-api`), le service ML avec pandas. Le chemin arrive par variable d'environnement. `architecture.md`, `api.md`.
- **Pas de table entreprise.** Un seul client pilote, la dimension de cloisonnement est le **site**, et le périmètre d'un compte est une liste de sites dans `user_sites`. `data.md`, #26.
- **Trois rôles, un seul vocabulaire** : `ADMIN`, `OPERATOR`, `VIEWER`. Un seul est exploité au MVP. Le rôle est **relu en base à chaque requête**, jamais porté par le cookie. `data.md`, #95.
- **Sessions révocables en base.** Le cookie ne porte qu'un identifiant opaque, l'état vit dans la table `sessions`, la déconnexion pose `revoked_at`. `data.md`, #29.
- **Argon2id** pour les mots de passe, `m=19456` `t=2` `p=1`. Pas bcrypt. `data.md`, #29.
- **Drizzle** est la source de vérité du schéma, et le SQL généré est commité. Le schéma ne se modifie jamais à la main sur la machine. `data.md`, #26.
- **`snake_case` partout sur le fil**, entrées comprises. Le `camelCase` reste interne, par un `transform` Zod à la frontière. `api.md`.
- **Le temps réel passe par l'API Mock en direct**, pas par les fichiers Parquet. Ceux-ci servent l'historique. `architecture.md`, `api.md`.
- **L'applicatif est le seul service à toucher PostgreSQL.** L'ETL écrit des fichiers, il n'a aucun accès à la base.

## Écriture

- **Français accentué partout** : documentation, commentaires de code, messages de commit. Si un encodage résiste, corriger l'encodage plutôt que retirer les accents.
- Pas de tiret cadratin ni de double tiret dans les textes : deux points, parenthèses, ou une phrase de plus.
- Les identifiants techniques, les routes et les champs restent en **anglais**, comme l'API Mock.

## Commits et pull requests

Le format est dans le `README.md`. Deux règles en plus :

- **Aucun trailer d'attribution d'outil** dans les messages de commit. L'historique doit rester nominatif, comme la règle qui interdit de commiter depuis la machine.
- Un message de commit dit **pourquoi**, pas seulement quoi. Le quoi se lit dans le diff.

## Suppressions

Ne jamais supprimer définitivement un fichier. Sur Windows, passer par la corbeille. Avant toute suppression, vérifier que le contenu est bien suivi par git : ce qui est non suivi n'est pas récupérable.

## Périmètres

`apps/dashboard/CLAUDE.md` couvre l'applicatif en propre et reste la référence pour ce répertoire. `.github/CODEOWNERS` dit qui relit quoi.

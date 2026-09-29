# Repères pour travailler sur ce dépôt

Ce fichier dit **où est la vérité**, **ce qui est déjà tranché**, et **comment on travaille**. Le [`README.md`](./README.md) reste la version complète des conventions et la description de la structure ; ce qui est repris ici l'est parce qu'il faut l'avoir en tête **avant** de créer une branche ou un commit, pas après.

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
- **Un propriétaire du schéma, deux écrivains de données.** Le schéma PostgreSQL appartient à Drizzle, dans l'applicatif, et à lui seul : l'ETL écrit des lignes, jamais du DDL. Il écrit le référentiel `sites` et rien d'autre, et ses droits en base le lui interdisent. `data.md`, #21.

## Écriture

- **Français accentué partout** : documentation, commentaires de code, messages de commit. Si un encodage résiste, corriger l'encodage plutôt que retirer les accents.
- Pas de tiret cadratin ni de double tiret dans les textes : deux points, parenthèses, ou une phrase de plus.
- Les identifiants techniques, les routes et les champs restent en **anglais**, comme l'API Mock. Cela vaut pour le code : noms de fichiers, fonctions, types et constantes exportées. Les commentaires, les noms de cas de test et les messages affichés restent en français, et une variable locale suit la langue du fichier qui l'héberge.

## Branches, commits, revue

**Rien ne part directement sur `main`.** La protection par règle n'est pas activable tant que le dépôt est privé sur une organisation en offre gratuite : rien ne refusera le `push`, et c'est précisément pour ça que la règle doit être écrite. Un changement arrivé sans revue se rattrape ensuite par une PR, ce qui coûte deux fois le temps qu'il fallait pour l'ouvrir.

**Une branche par issue**, nommée `EADL_2025_NANTES_G1/<préfixe>-<numéro>-<slug>`.

| Type d'issue | Préfixe |
| :--- | :--- |
| Feature | `feat` |
| Bug | `fix` |
| Task | `chore` |
| Docs | `docs` |
| Spike | `spike` |

Exemple : `EADL_2025_NANTES_G1/feat-18-ingestion-etl`. Le type `Epic` ne porte pas de branche.

> L'année est **2025**, comme le nom de la machine et le document de consignes. L'organisation GitHub, elle, s'appelle `EADL-2026`. Les deux se ressemblent et ce n'est pas une faute de frappe.

**Commits** en conventional commits, même préfixe que la branche : `feat(etl): ...`, `docs(data): ...`. Trois règles en plus du format :

- Le message dit **pourquoi**, pas seulement quoi. Le quoi se lit dans le diff.
- **Aucun trailer d'attribution d'outil.** L'historique doit rester nominatif, comme la règle qui interdit de commiter depuis la machine.
- Français accentué, y compris dans le sujet du commit.

**Toute évolution passe par une pull request avec revue.** Le projet se poursuit en solo depuis le 29 septembre 2026 : plus de `CODEOWNERS`, la revue est une relecture de sa propre PR, CI verte, avant de fusionner. La description dit ce qui change **et pourquoi**, et la liste de vérification du gabarit est remplie honnêtement : une case cochée qui ne correspond à rien vaut moins que la case décochée avec sa raison à côté.

Une PR qui contredit `architecture.md`, `data.md` ou `api.md` met le document à jour **dans la même PR**. Un écart non écrit se redécouvre à l'intégration.

**Une seule branche durable, `main`.** Les branches de travail sont supprimées après fusion.

## Suppressions

Ne jamais supprimer définitivement un fichier. Sur Windows, passer par la corbeille. Avant toute suppression, vérifier que le contenu est bien suivi par git : ce qui est non suivi n'est pas récupérable.

## Méthodologies

- API / Dashboard : méthodologie TDD systématiques (tests red, implémentation, tests green).